import { startSnow, sparkle } from "./effects.js";
const DATA = window.CALENDAR;
const params = new URLSearchParams(location.search);
const realNow = new Date();
const LIVE = realNow.getMonth() === 11; // in December the test overrides (?preview, ?date) are ignored
const PREVIEW = !LIVE && params.has("preview"); // add ?preview to unlock every door
const STORE = "advent-opened";
// Add ?reset to the URL to close every door again (works on any device, no need to clear browser data)
if (params.has("reset")) {
    try {
        localStorage.removeItem(STORE);
    }
    catch { /* ignore */ }
    params.delete("reset");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
}
const enc = new TextEncoder();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function el(id) {
    const e = document.getElementById(id);
    if (!e)
        throw new Error(`Missing #${id}`);
    return e;
}
// Remembered doors (storage can fail in private mode, so guard it)
let opened = new Set();
try {
    opened = new Set(JSON.parse(localStorage.getItem(STORE) ?? "[]"));
}
catch { /* ignore */ }
const save = () => {
    try {
        localStorage.setItem(STORE, JSON.stringify([...opened]));
    }
    catch { /* ignore */ }
};
// Door n is unlocked in December on or after day n
// Test helper: add ?date=2026-12-05 to the URL to pretend it's that day
const dateParam = LIVE ? null : params.get("date");
const parsed = dateParam ? new Date(`${dateParam}T12:00:00`) : null;
const now = parsed && !isNaN(parsed.getTime()) ? parsed : realNow;
const isUnlocked = (n) => PREVIEW || (now.getMonth() === 11 && now.getDate() >= n);
// Same shuffled order for everyone, every visit
function seeded(seed) {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const order = Array.from({ length: 24 }, (_, i) => i + 1);
const rnd = seeded(2024);
for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
}
// Decrypt one message (AES-GCM, key from passphrase + door number)
async function decrypt(n) {
    const raw = Uint8Array.from(atob(DATA.messages[n - 1]), (c) => c.charCodeAt(0));
    const base = await crypto.subtle.importKey("raw", enc.encode(DATA.passphrase), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: enc.encode(`door-${n}`), iterations: 100000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
    return JSON.parse(new TextDecoder().decode(plain));
}
const grid = el("grid");
const dlg = el("dlg");
const toast = el("toast");
let toastTimer;
function say(text) {
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
async function openDoor(n, li) {
    if (!isUnlocked(n)) {
        li.classList.remove("shake");
        void li.offsetWidth; // restart the animation
        li.classList.add("shake");
        say(`Not yet! Come back on ${n} December to find out.`);
        return;
    }
    let film;
    try {
        film = await decrypt(n);
    }
    catch {
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
    const show = () => {
        el("dlgDay").textContent = `${n} December`;
        el("filmTitle").textContent = film.title;
        el("filmYear").textContent = film.year;
        el("filmRating").textContent = `★ ${film.rating}`;
        el("filmService").textContent = film.service;
        dlg.showModal();
    };
    if (reduceMotion || !firstTime)
        show();
    else
        setTimeout(show, 1500);
}
el("close").addEventListener("click", () => dlg.close());
dlg.addEventListener("click", (e) => { if (e.target === dlg)
    dlg.close(); }); // tap outside to close
startSnow();
