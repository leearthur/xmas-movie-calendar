// Shared by the page (src/main.ts) and the curator tool (curate.ts)

/** One door's film, as encrypted in calendar-data.js */
export interface Film { title: string; year: string; rating: string; service: string }

/** The contents of calendar-data.js, exposed to the page as window.CALENDAR */
export interface CalendarData {
  /** Random key the page uses to open each door on its day */
  doorKey: string;
  /** Salted hash of the curator's passphrase, which unlocks preview and editing */
  passphraseSalt: string;
  passphraseHash: string;
  /** One encrypted Film per door, in door order */
  messages: string[];
}
