// Usage: npm run encrypt   (reads messages.txt, writes calendar-data.js)
// A passphrase is required: set the PASSPHRASE environment variable (or pass it as the first argument).
//   PowerShell: $env:PASSPHRASE="your-passphrase"; npm run encrypt
//   bash:       PASSPHRASE="your-passphrase" npm run encrypt
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { CalendarData, Film } from "./src/types.js";

const PASSPHRASE: string = (process.env.PASSPHRASE ?? process.argv[2] ?? "").trim();
if (!PASSPHRASE) {
  console.error("A passphrase is required. Set the PASSPHRASE environment variable, e.g. PASSPHRASE=\"your-passphrase\" npm run encrypt");
  process.exit(1);
}

const lines: string[] = fs
  .readFileSync(path.join(import.meta.dirname, "messages.txt"), "utf8")
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith("#"));

if (lines.length !== 24) {
  console.error(`messages.txt needs exactly 24 films (one per line); found ${lines.length}.`);
  process.exit(1);
}

function parseFilm(line: string, day: number): Film {
  const parts = line.split("|").map((p) => p.trim());
  if (parts.length !== 4 || parts.some((p) => !p)) {
    console.error(`Line for door ${day} must be: Film name | Year | IMDb rating | Streaming service\n  Got: ${line}`);
    process.exit(1);
  }
  const [title, year, rating, service] = parts;
  return { title, year, rating, service };
}

// AES-256-GCM with a key derived from the passphrase and door number; output is base64(iv + ciphertext + auth tag).
// src/main.ts decrypt() must stay in step with this.
function encrypt(film: Film, day: number): string {
  const key = crypto.pbkdf2Sync(PASSPHRASE, `door-${day}`, 100000, 32, "sha256");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(film), "utf8"), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64");
}

const data: CalendarData = {
  passphrase: PASSPHRASE,
  messages: lines.map((line, i) => encrypt(parseFilm(line, i + 1), i + 1)),
};

fs.writeFileSync(path.join(import.meta.dirname, "calendar-data.js"), `window.CALENDAR = ${JSON.stringify(data, null, 1)};\n`);
console.log("Wrote calendar-data.js with 24 encrypted messages.");
