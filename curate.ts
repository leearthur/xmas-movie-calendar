// Usage: npm run curate, then open the address it prints.
// Serves a form (curate.html) for entering the 24 films, on this machine only, and writes calendar-data.js.
// The films are never written anywhere in plain text.
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { decryptFilm, encryptFilm, hashPassphrase, randomBase64 } from "./src/crypto.js";
import type { CalendarData, Film } from "./src/types.js";

const PORT = 5174;
const DATA_FILE = path.join(import.meta.dirname, "calendar-data.js");
const FORM_FILE = path.join(import.meta.dirname, "curate.html");
const PREFIX = "window.CALENDAR = ";

// Lists from before the curator passphrase existed stored a single passphrase, which was also the door key
interface LegacyData { passphrase: string; messages: string[] }

function readData(): CalendarData | LegacyData | null {
  if (!fs.existsSync(DATA_FILE)) return null;
  const text = fs.readFileSync(DATA_FILE, "utf8").trim();
  return JSON.parse(text.slice(PREFIX.length).replace(/;$/, ""));
}

const isLegacy = (data: CalendarData | LegacyData): data is LegacyData => "passphrase" in data;

/** The films in an existing list, or null if the passphrase is wrong */
async function unlock(passphrase: string): Promise<Film[] | null> {
  const data = readData();
  if (!data) return null;
  const doorKey = isLegacy(data) ? data.passphrase : data.doorKey;
  const ok = isLegacy(data)
    ? passphrase === data.passphrase
    : (await hashPassphrase(passphrase, data.passphraseSalt)) === data.passphraseHash;
  return ok ? Promise.all(data.messages.map((m, i) => decryptFilm(m, doorKey, i + 1))) : null;
}

async function save(passphrase: string, films: Film[]): Promise<void> {
  const doorKey = randomBase64(32);
  const passphraseSalt = randomBase64(16);
  const data: CalendarData = {
    doorKey,
    passphraseSalt,
    passphraseHash: await hashPassphrase(passphrase, passphraseSalt),
    messages: await Promise.all(films.map((film, i) => encryptFilm(film, doorKey, i + 1))),
  };
  fs.writeFileSync(DATA_FILE, `${PREFIX}${JSON.stringify(data, null, 1)};\n`);
}

/** Why the films can't be saved, or null if they're fine */
function problem(passphrase: unknown, films: unknown): string | null {
  if (typeof passphrase !== "string" || passphrase.length < 6) return "The passphrase needs at least 6 characters.";
  if (!Array.isArray(films) || films.length !== 24) return "There must be exactly 24 films.";
  const fields: (keyof Film)[] = ["title", "year", "rating", "service"];
  const gap = films.findIndex((f) => fields.some((k) => typeof f?.[k] !== "string" || !f[k].trim()));
  return gap === -1 ? null : `Door ${gap + 1} is missing some details.`;
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || "{}");
}

const server = http.createServer(async (req, res) => {
  const reply = (status: number, body: unknown): void => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(fs.readFileSync(FORM_FILE));
    } else if (req.method === "GET" && req.url === "/api/status") {
      reply(200, { exists: readData() !== null });
    } else if (req.method === "POST" && req.url === "/api/unlock") {
      const { passphrase } = await readBody(req);
      const films = await unlock(String(passphrase ?? ""));
      if (films) reply(200, { films });
      else reply(403, { error: "That passphrase isn't right." });
    } else if (req.method === "POST" && req.url === "/api/save") {
      const { passphrase, films } = await readBody(req);
      const error = problem(passphrase, films);
      if (error) return reply(400, { error });
      await save(passphrase as string, films as Film[]);
      console.log("Saved calendar-data.js. Commit and push it to publish the films.");
      reply(200, {});
    } else {
      reply(404, { error: "Not found" });
    }
  } catch (err) {
    console.error(err);
    reply(500, { error: "Something went wrong; see the terminal." });
  }
});

// 127.0.0.1 only, so nobody else on the network can reach the form
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Film curator form: http://localhost:${PORT}/  (Ctrl+C to stop)`);
});
