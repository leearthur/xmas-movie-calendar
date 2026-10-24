// Shared by the page (src/main.ts) and the encrypt script (encrypt.ts)

/** One door's film, as encrypted in calendar-data.js */
export interface Film { title: string; year: string; rating: string; service: string }

/** The contents of calendar-data.js, exposed to the page as window.CALENDAR */
export interface CalendarData { passphrase: string; messages: string[] }
