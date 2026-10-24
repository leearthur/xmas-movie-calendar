// Encryption shared by the page (in the browser) and the curator tool (in Node); both have Web Crypto
import type { Film } from "./types.js";

const encoder = new TextEncoder();
const ITERATIONS = 100000;

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** A random value, base64 encoded, for door keys and salts */
export const randomBase64 = (byteCount: number): string => toBase64(crypto.getRandomValues(new Uint8Array(byteCount)));

async function pbkdf2(secret: string, salt: string): Promise<ArrayBuffer> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: ITERATIONS, hash: "SHA-256" }, base, 256);
}

// Each door has its own AES-GCM key, derived from the door key and the door number
async function doorCipherKey(doorKey: string, n: number): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", await pbkdf2(doorKey, `door-${n}`), "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Encrypt door n's film; the result is base64(iv + ciphertext + auth tag) */
export async function encryptFilm(film: Film, doorKey: string, n: number): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await doorCipherKey(doorKey, n);
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(film)));
  return toBase64(new Uint8Array([...iv, ...new Uint8Array(sealed)]));
}

export async function decryptFilm(message: string, doorKey: string, n: number): Promise<Film> {
  const raw = fromBase64(message);
  const key = await doorCipherKey(doorKey, n);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
  return JSON.parse(new TextDecoder().decode(plain)) as Film;
}

/** Hash the curator's passphrase; only the hash and salt are stored */
export async function hashPassphrase(passphrase: string, salt: string): Promise<string> {
  return toBase64(new Uint8Array(await pbkdf2(passphrase, salt)));
}
