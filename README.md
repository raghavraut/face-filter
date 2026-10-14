# Mira

A camera-first frontend with a black, full-screen interface, a rounded viewfinder, and three circular look choices. The selected choice sits inside the capture ring, with a name bar, gallery, and camera switch below.

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

No backend, account, analytics, uploads, or image processing is included. Photos live in browser memory for the current visit. Camera access requires localhost or HTTPS.

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

Use the HTTPS deployment URL for camera access. No database or server setup is needed. See the [Cloudflare Pages static HTML guide](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) for the connection steps.

## Assets

The look thumbnails are decorative CSS artwork. Manrope is distributed under the SIL Open Font License; its license notice is in `assets/`. Icons and the Mira mark are local SVG assets.
