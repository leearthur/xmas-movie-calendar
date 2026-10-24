# xmas-movie-calendar

A Christmas film advent calendar website. There are 24 doors, one for each day from 1 to 24 December. Opening a door reveals that day's film, with its year, IMDb rating and streaming service.

It is a static site with no backend, so it can be hosted on GitHub Pages.

> https://leearthur.github.io/xmas-movie-calendar

## How it works

- Door *n* unlocks in December on or after day *n*, based on the visitor's device clock. Opened doors are remembered in the browser's `localStorage`.
- The doors appear in a fixed shuffled order, the same for everyone.
- Film details are stored encrypted (AES-256-GCM) in `calendar-data.js` and decrypted in the browser with the Web Crypto API when a door is opened.
- The page has snow and a sparkle effect when a door opens, and respects `prefers-reduced-motion` (the snow becomes slower and sparser, and the sparkle is skipped).

The key that opens the doors is shipped in `calendar-data.js` alongside the encrypted data. This keeps the films from being stumbled on, by you or anyone browsing the repo, but it is not real protection against someone determined to read them.

## Setup

```sh
npm install
```

### Choosing the films

Whoever picks this year's films runs:

```sh
npm run curate
```

and opens the address it prints (http://localhost:5174). The form has a row for each door (film name, year, IMDb rating and streaming service) and asks the curator to choose a passphrase. Saving encrypts the films straight into `calendar-data.js`; nothing is written in plain text. Then commit and push `calendar-data.js`.

The passphrase is not stored anywhere (only a salted hash of it is), so the curator should remember it. It is needed to:

- **Test with the real films:** open the site with `?preview` and enter it when asked.
- **Edit the list:** run `npm run curate` again and unlock the existing list with it.

A new curator who doesn't know last year's passphrase can choose **start a new list**, which replaces the old one when saved.

### Build and run locally

```sh
npm run build    # compile src/ to dist/ and type-check curate.ts (or `npm run watch` for src/ only)
npm run serve    # serve the site locally
```

Doors need a secure context to decrypt, so use `localhost` or HTTPS (GitHub Pages is HTTPS).

## Testing URL options

Outside December only (they are ignored during December):

- `?preview` unlocks every door.
- `?date=2026-12-05` pretends it is that date.

Either one puts the page in test mode. It asks for the curator's passphrase: with it, the doors show the real films; without it, they show made-up test films (not real titles, years or ratings), so testing never gives the list away. Doors opened in test mode are remembered separately from real ones.

`?reset` clears the opened doors and works at any time.

## Publishing

Pushing to `main` runs the `.github/workflows/deploy.yml` workflow, which builds the site and publishes it to GitHub Pages. In the repository settings, Pages → Source must be set to **GitHub Actions**.

`dist/` is built by the workflow and is not committed. `calendar-data.js` is committed, because it is made by `npm run curate` rather than the build. Commit it whenever the films change.
