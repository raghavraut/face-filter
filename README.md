# Mira

A camera-first frontend with a black, full-screen interface, a rounded viewfinder, and three circular look choices. The selected choice sits inside the capture ring, with a name bar, gallery, and camera switch below.

Mira can also run as a **recorder**: it records the camera continuously while the tab is open and visible, keeps the footage in Cloudflare R2, and pushes a clip to your Telegram bot when it detects motion. The relay credentials you supply are stored only in that browser's `localStorage` and are never written into the page bundle.

## Run locally

Node.js 22 or newer is all you need. There are no packages to install.

```sh
npm run dev
```

Open http://localhost:5173. The browser requests camera access immediately. If a camera is unavailable or access is declined, the viewfinder stays dark and shows a retry button. No placeholder photo is loaded.

## What works

- Three look choices with mouse, touch, and arrow-key selection. These are selection states only and do not change the camera image.
- Live camera preview, front/rear switching on supported devices, and mirrored selfies.
- Local photo capture using the center ring.
- Spacebar capture, a session gallery of the last 12 photos, and JPEG downloads.
- Responsive layouts, keyboard focus, native accessible dialogs, and reduced-motion support.

Stills live in browser memory for the current visit and are never uploaded. Camera access requires localhost or HTTPS.

## Continuous recording and Telegram alerts

Recording is off until you connect a relay. Tap the **REC** badge in the top-left of the viewfinder to open the settings dialog, paste the relay address and key, and choose a segment length and motion sensitivity. Once connected, a red REC badge with an elapsed timer stays visible for as long as recording is running.

The bot token never reaches the browser. The page talks to a small Cloudflare Worker that holds the token as a secret and relays messages to Telegram.

### What gets sent where

| Event | Destination |
| --- | --- |
| Every segment (30s / 1min / 5min) | R2, under `segments/` |
| Motion detected | A JPEG snapshot to R2 under `snapshots/`, plus a Telegram message |
| Next segment after motion | Also delivered to Telegram as a clip |

R2 lifecycle rules expire footage automatically: **7 days** for video segments and **30 days** for snapshots. The Telegram chat only receives motion events, not the continuous background recording.

### Before you rely on it

- **Browsers only capture in the foreground.** If the tab is backgrounded, minimised, or the device sleeps, `MediaRecorder` is throttled and frames stop. This works on a device propped up with its screen on, not as a hidden always-on camera.
- **Telegram cannot hold continuous video.** Bot uploads cap at 50 MB, so clips are short and everything else stays in R2.
- **WebM clips arrive as documents.** Telegram only plays back MPEG4 natively, so VP8/WebM is sent via `sendDocument` unless the source is MP4.

## Deploy the relay

The Worker source is in `worker/`, with `worker/wrangler.toml` already pointing at the `mira-footage` bucket. Create the bucket once if it does not exist, then deploy:

```sh
npx wrangler r2 bucket create mira-footage
cd worker && npx wrangler deploy
```

Set the three secrets. Each one prompts for input, so the values never reach your shell history or this repository:

```sh
npx wrangler secret put TELEGRAM_BOT_TOKEN   # from @BotFather
npx wrangler secret put TELEGRAM_CHAT_ID      # your chat id
npx wrangler secret put UPLOAD_KEY            # generate a long random string
```

`UPLOAD_KEY` is the shared secret between the page and the relay. Anyone who loads the public page can see the bundle but has no key, so they cannot upload anything or read footage. Put the same value in the app's settings dialog.

The relay serves at `https://<script-name>.<your-subdomain>.workers.dev`. If that URL returns 404, enable the script's workers.dev subdomain in the Cloudflare dashboard under **Workers & Pages → mira-relay → Settings → Domains & Routes**.

`worker/src/index.js` is covered by `npm run check` for syntax and by an auth-and-validation test pass covering bad keys, wrong content types, oversized payloads, path traversal, and forged or expired footage links.

## Build

```sh
npm run check
npm run build
```

Deploy `dist/` to any static host with HTTPS. Use `npm run dev -- --port 8080` to choose another local port.

## Cloudflare Pages

In Cloudflare, open **Workers & Pages → Create application → Pages → Import an existing Git repository** and select this repository.

Use these build settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Leave blank |
| Environment variables | None required |

The `.node-version` file selects Node.js 22 for the build. The source assets are bundled locally, and the build copies only the public frontend into `dist/`. After the initial deployment, pushes to `main` trigger new production builds.

Use the HTTPS deployment URL for camera access. See the [Cloudflare Pages static HTML guide](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) for the connection steps.

## Recording disclosure

Recording only ever captures through a camera that the person operating the device has deliberately pointed and authorised. The REC badge is visible whenever the camera is on, so anyone in frame can see the camera is running.

If other people can appear in frame — a shared home, an office, a hallway — make sure they know. Recording and cloud storage of images of people is regulated in many places, and in some jurisdictions notifying people is required rather than optional.

## Assets

The look thumbnails are decorative CSS artwork. Manrope is distributed under the SIL Open Font License; its license notice is in `assets/`. Icons and the Mira mark are local SVG assets.
