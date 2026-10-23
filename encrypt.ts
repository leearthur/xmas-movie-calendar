// Usage: npm run encrypt   (reads messages.txt, writes calendar-data.js)
// A passphrase is required: set the PASSPHRASE environment variable (or pass it as the first argument).
//   PowerShell: $env:PASSPHRASE="your-passphrase"; npm run encrypt
//   bash:       PASSPHRASE="your-passphrase" npm run encrypt
const PASSPHRASE: string = (process.env.PASSPHRASE ?? process.argv[2] ?? "").trim();
if (!PASSPHRASE) {
  console.error("A passphrase is required. Set the PASSPHRASE environment variable, e.g. PASSPHRASE=\"your-passphrase\" npm run encrypt");
  process.exit(1);
}

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

interface Film { title: string; year: string; rating: string; service: string }

const lines: string[] = fs
  .readFileSync(path.join(__dirname, "messages.txt"), "utf8")
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith("#"));

if (lines.length !== 24) {
  console.error(`messages.txt needs exactly 24 films (one per line); found ${lines.length}.`);
  process.exit(1);
}

const messages: string[] = lines.map((line, i) => {
  const day = i + 1;
  const parts = line.split("|").map((p) => p.trim());
  if (parts.length !== 4 || parts.some((p) => !p)) {
    console.error(`Line for door ${day} must be: Film name | Year | IMDb rating | Streaming service\n  Got: ${line}`);
    process.exit(1);
  }
  const film: Film = { title: parts[0], year: parts[1], rating: parts[2], service: parts[3] };
  const key = crypto.pbkdf2Sync(PASSPHRASE, `door-${day}`, 100000, 32, "sha256");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(film), "utf8"), cipher.final()]);
  return Buffer.concat([iv, enc, cipher.getAuthTag()]).toString("base64");
});

fs.writeFileSync(
  path.join(__dirname, "calendar-data.js"),
  `window.CALENDAR = ${JSON.stringify({ passphrase: PASSPHRASE, messages }, null, 1)};\n`
);
console.log("Wrote calendar-data.js with 24 encrypted messages.");
