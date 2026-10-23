# xmas-movie-calendar

A Christmas film advent calendar website. There are 24 doors, one for each day from 1 to 24 December. Opening a door reveals that day's film, with its year, IMDb rating and streaming service.

It is a static site with no backend, so it can be hosted on GitHub Pages.

## How it works

- Door *n* unlocks in December on or after day *n*, based on the visitor's device clock. Opened doors are remembered in the browser's `localStorage`.
- The doors appear in a fixed shuffled order, the same for everyone.
- Film details are stored encrypted (AES-256-GCM) in `calendar-data.js` and decrypted in the browser with the Web Crypto API when a door is opened.
- The page has snow and a sparkle effect when a door opens, and respects `prefers-reduced-motion`.

The passphrase is shipped in `calendar-data.js` alongside the encrypted data, so this keeps the films out of casual view but is not real protection against someone reading the page source.

## Project layout

| Path | Purpose |
|---|---|
| `index.html` | Page markup and styles |
| `src/main.ts` | Calendar logic: unlocking, decryption, dialog |
| `src/effects.ts` | Snow and sparkle canvas effects |
| `dist/` | Compiled JavaScript served by the page (committed so GitHub Pages can serve it) |
| `encrypt.ts` | Builds `calendar-data.js` from `messages.txt` |
| `calendar-data.js` | Generated: passphrase and 24 encrypted films |
| `messages.txt` | Plaintext film list (git-ignored, so films are not spoiled in the repo) |

## Setup

```sh
npm install
```

### Choosing the films

Create `messages.txt` with 24 lines in door order (line 1 is 1 December), in the format:

```
Film name | Year | IMDb rating | Streaming service
```

Lines starting with `#` are ignored. Then encrypt them:

```sh
PASSPHRASE="your-passphrase" npm run encrypt    # PowerShell: $env:PASSPHRASE = "..."; npm run encrypt
```

### Build and run locally

```sh
npm run build    # compile src/ to dist/ (or `npm run watch`)
npm run serve    # serve the site locally
```

Doors need a secure context to decrypt, so use `localhost` or HTTPS (GitHub Pages is HTTPS).

## Testing URL options

Outside December only (they are ignored during December):

- `?preview` unlocks every door.
- `?date=2026-12-05` pretends it is that date.

`?reset` clears the opened doors and works at any time.

## Publishing

Commit `dist/` and `calendar-data.js`, push to GitHub, and enable GitHub Pages for the branch. Run `npm run build` before committing so `dist/` is current.
