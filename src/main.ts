import { startSnow, sparkle } from "./effects.js";
import type { CalendarData, Film } from "./types.js";

declare global { interface Window { CALENDAR: CalendarData } }

const DATA: CalendarData = window.CALENDAR;
const STORE = "advent-opened";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- URL options (see "Testing URL options" in the README) ---------- */
const params = new URLSearchParams(location.search);
const realNow = new Date();
const LIVE = realNow.getMonth() === 11; // in December the test overrides (?preview, ?date) are ignored
const PREVIEW = !LIVE && params.has("preview"); // ?preview unlocks every door

// ?date=2026-12-05 pretends it's that day
const dateParam = LIVE ? null : params.get("date");
const parsed = dateParam ? new Date(`${dateParam}T12:00:00`) : null;
const now = parsed && !isNaN(parsed.getTime()) ? parsed : realNow;

// ?reset closes every door again (works on any device, no need to clear browser data)
if (params.has("reset")) {
  try { localStorage.removeItem(STORE); } catch { /* ignore */ }
  params.delete("reset");
  const rest = params.toString();
  history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
}

// Door n is unlocked in December on or after day n
const isUnlocked = (n: number): boolean => PREVIEW || (now.getMonth() === 11 && now.getDate() >= n);

/* ---------- Remembered doors (storage can fail in private mode, so guard it) ---------- */
let opened = new Set<number>();
try { opened = new Set<number>(JSON.parse(localStorage.getItem(STORE) ?? "[]")); } catch { /* ignore */ }
const save = (): void => {
  try { localStorage.setItem(STORE, JSON.stringify([...opened])); } catch { /* ignore */ }
};

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing #${id}`);
  return e as T;
}

// Same shuffled order for everyone, every visit
function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const order: number[] = Array.from({ length: 24 }, (_, i) => i + 1);
const rnd = seeded(2024);
for (let i = order.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}

// Decrypt one message: the reverse of encrypt() in encrypt.ts (AES-GCM, key from passphrase + door number)
async function decrypt(n: number): Promise<Film> {
  const encoder = new TextEncoder();
  const raw = Uint8Array.from(atob(DATA.messages[n - 1]), (c) => c.charCodeAt(0));
  const base = await crypto.subtle.importKey("raw", encoder.encode(DATA.passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode(`door-${n}`), iterations: 100000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
  return JSON.parse(new TextDecoder().decode(plain)) as Film;
}

// Show the calendar's year (follows ?date when testing)
el("calYear").textContent = String(now.getFullYear());
document.title += ` ${now.getFullYear()}`;

const grid = el<HTMLOListElement>("grid");
const dlg = el<HTMLDialogElement>("dlg");
const toast = el<HTMLDivElement>("toast");
let toastTimer: number | undefined;

function say(text: string): void {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

for (const n of order) {
  const li = document.createElement("li");
  li.className = "cell" + (isUnlocked(n) ? "" : " locked") + (opened.has(n) ? " open" : "");
  li.innerHTML = `<div class="inside" data-n="${n}" aria-hidden="true"></div>`;
  const b = document.createElement("button");
  b.className = "door";
  b.type = "button";
  b.dataset.n = String(n);
  b.setAttribute("aria-label", `Door ${n}`);
  // Listen on the cell so clicks on the revealed area behind an open door work too (the button's click bubbles up)
  li.addEventListener("click", () => void openDoor(n, li));
  li.appendChild(b);
  grid.appendChild(li);
}

async function openDoor(n: number, li: HTMLElement): Promise<void> {
  if (!isUnlocked(n)) {
    li.classList.remove("shake");
    void li.offsetWidth; // restart the animation
    li.classList.add("shake");
    say(`Not yet! Come back on ${n} December to find out.`);
    return;
  }
  let film: Film;
  try {
    film = await decrypt(n);
  } catch {
    say(window.isSecureContext
      ? "Couldn't open that door. Check the passphrase in calendar-data.js."
      : "This page needs HTTPS (or localhost) to open doors.");
    return;
  }
  const firstTime = !opened.has(n);
  li.classList.add("open");
  opened.add(n);
  save();
  if (firstTime) {
    // light up only the door that was just opened; re-viewing an open door leaves the lights where they are
    grid.querySelectorAll(".cell.lit").forEach((c) => c.classList.remove("lit"));
    li.classList.add("lit");
    const r = li.getBoundingClientRect();
    sparkle(r.left + r.width / 2, r.top + r.height / 2);
  }
  const show = (): void => {
    el("dlgDay").textContent = `${n} December`;
    el("filmTitle").textContent = film.title;
    el("filmYear").textContent = film.year;
    el("filmRating").textContent = `★ ${film.rating}`;
    el("filmService").textContent = film.service;
    dlg.showModal();
  };
  if (reduceMotion || !firstTime) show();
  else setTimeout(show, 1200);
}

el("close").addEventListener("click", () => dlg.close());
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // tap outside to close

startSnow();
