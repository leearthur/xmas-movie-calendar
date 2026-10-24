import { decryptFilm, hashPassphrase } from "./crypto.js";
import { startSnow, sparkle } from "./effects.js";
import type { CalendarData, Film } from "./types.js";

declare global { interface Window { CALENDAR: CalendarData } }

const DATA: CalendarData = window.CALENDAR;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- The calendar's season: 1 December to 6 January, so people can come back after Christmas ---------- */
const SEASON_END = 7; // the calendar starts again on 7 January (the day after Twelfth Night)
const inSeason = (d: Date): boolean => d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() < SEASON_END);
// The year the calendar belongs to: the January days at the end of a season still belong to the year before
const seasonYear = (d: Date): number => d.getFullYear() - (d.getMonth() === 0 && d.getDate() < SEASON_END ? 1 : 0);

/* ---------- URL options (see "Testing URL options" in the README) ---------- */
const params = new URLSearchParams(location.search);
const realNow = new Date();
const LIVE = inSeason(realNow); // during the season the test overrides (?preview, ?date) are ignored
const PREVIEW = !LIVE && params.has("preview"); // ?preview unlocks every door

// ?date=2026-12-05 pretends it's that day
const dateParam = LIVE ? null : params.get("date");
const parsed = dateParam ? new Date(`${dateParam}T12:00:00`) : null;
const now = parsed && !isNaN(parsed.getTime()) ? parsed : realNow;

// Test mode shows made-up films unless the curator's passphrase is given, and remembers its opened doors separately
const TESTING = PREVIEW || parsed !== null;
// Opened doors are remembered per year, so last year's don't show as open this year
const STORE_PREFIX = "advent-opened";
const STORE = `${STORE_PREFIX}${TESTING ? "-test" : ""}-${seasonYear(now)}`; // test mode keeps its own doors, also per year
let showRealFilms = !TESTING; // set only in memory once the passphrase is given, so a reload asks again

// Not real films, years or ratings (IMDb ratings start at 1), so testing can never give the game away
const testFilm = (n: number): Film => ({ title: `Test film ${n}`, year: "0000", rating: "0.0", service: "Nowhere (test mode)" });

// ?reset closes every door again, for every year and in test mode (works on any device, no need to clear browser data)
if (params.has("reset")) {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(STORE_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  params.delete("reset");
  const rest = params.toString();
  history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
}

// Door n is unlocked in December on or after day n, and every door stays unlocked until the season ends
const isUnlocked = (n: number): boolean =>
  PREVIEW || (inSeason(now) && (now.getMonth() === 0 || now.getDate() >= n));

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

const filmFor = (n: number): Promise<Film> =>
  showRealFilms ? decryptFilm(DATA.messages[n - 1], DATA.doorKey, n) : Promise.resolve(testFilm(n));

// Show the calendar's year (follows ?date when testing)
el("calYear").textContent = String(seasonYear(now));
document.title += ` ${seasonYear(now)}`;

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
    film = await filmFor(n);
  } catch {
    say(window.isSecureContext
      ? "Couldn't open that door. calendar-data.js may be damaged; try saving the films again."
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

/* ---------- Test mode: ask for the curator's passphrase ---------- */
const unlockDlg = el<HTMLDialogElement>("unlockDlg");
const unlockPass = el<HTMLInputElement>("unlockPass");
const unlockError = el<HTMLParagraphElement>("unlockError");

el<HTMLFormElement>("unlockForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ok = (await hashPassphrase(unlockPass.value, DATA.passphraseSalt)) === DATA.passphraseHash;
  unlockPass.value = "";
  if (!ok) { unlockError.hidden = false; unlockPass.focus(); return; }
  showRealFilms = true;
  unlockDlg.close();
  say("Test mode: showing the real films.");
});
el("useTestFilms").addEventListener("click", () => {
  unlockDlg.close();
  say("Test mode: showing made-up test films.");
});
if (TESTING) unlockDlg.showModal();

startSnow();
