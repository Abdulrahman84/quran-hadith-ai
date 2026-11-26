# Mobile apps (iOS and Android)

Sanad AI ships as a Capacitor app for iOS and Android. The app bundles the UI
and calls the deployed API over HTTPS.

## How it fits together

- `/api/search` and `/api/check` need Node, the Hadith and Tafsir MCP
  processes and server-side OpenRouter keys, so they stay on the deployed web
  app (`https://sanaddai.com`, see `DEPLOY.md`).
- `npm run mobile:build` runs `next build` with `MOBILE_EXPORT=1`. In that mode
  `next.config.ts` switches to `output: "export"` and only treats `.tsx` files
  as app entries. That leaves the route handlers (`route.ts`) and the CORS
  proxy (`src/proxy.ts`) out of the bundle. The static UI lands in `out/`, and
  Capacitor copies it into the native projects.
- Fetches go through `fetchApi()` in `src/lib/api-url.ts`. On the web the base
  URL is empty, so requests stay same-origin. The mobile build bakes in
  `NEXT_PUBLIC_API_BASE_URL`, which defaults to `https://sanaddai.com`.
- `src/proxy.ts` answers CORS preflights on `/api/*` and allows the app
  origins only: `capacitor://localhost` (iOS) and `https://localhost`
  (Android). Add more with `CORS_ALLOWED_ORIGINS` (comma-separated) on the
  server. **The server needs this change deployed before the apps can reach
  it.**
- No API keys or server secrets go into the app. The bundle only contains
  `NEXT_PUBLIC_*` values.

The mobile build also sets `NEXT_PUBLIC_NATIVE_APP=1`. That switches on the app
shell, which the website never ships:

- a bottom tab bar (Ask, How it works, Sources) with light haptics instead of
  the web header menu and footer, and a compact header with a one-tap
  language toggle;
- safe-area padding for the notch, Dynamic Island and home indicator
  (`viewport-fit=cover` plus `env(safe-area-inset-*)`), and dark status bar
  icons on the sand background;
- the keyboard resizes the webview and the tab bar hides while it is open;
- the Android back button goes back in history and exits on the first screen;
- the splash screen stays up until React has mounted;
- when the API can't be reached, an "offline" message replaces the raw error.

RTL Arabic and LTR English both work in the webview. The language toggle flips
`dir` on `<html>` exactly as on the web.

## Prerequisites

- Node and `npm install`.
- `NEXT_PUBLIC_CONVEX_URL` in `.env.local` or the environment (see
  `.env.example`).
- iOS: Xcode 16+ (Swift Package Manager, no CocoaPods needed).
- Android: Android Studio with SDK 36 and JDK 21.

## Commands

| Command | What it does |
| --- | --- |
| `npm run mobile:build` | Export the UI to `out/` and `cap sync` it into `ios/` and `android/` |
| `npm run mobile:ios` | `mobile:build`, then open the Xcode project |
| `npm run mobile:android` | `mobile:build`, then open Android Studio |
| `npm run mobile:assets` | Regenerate the logo files, app icons and splash screens from the vector mark |

To run on a simulator or device without opening the IDE:

```bash
npm run mobile:build
```

```bash
npx cap run ios
```

```bash
npx cap run android
```

To point a build at a different API (for example a staging deploy), set the
base URL when building:

```bash
NEXT_PUBLIC_API_BASE_URL=https://staging.example.com npm run mobile:build
```

The server you point at must have the CORS proxy deployed, and its allowed
headers (`src/lib/cors.ts`) must include every header the app sends.

For a local API on `http://localhost:3000`, add `ALLOW_INSECURE_API_BASE_URL=1`.
That works as is in the iOS Simulator. On the Android emulator, run
`adb reverse tcp:3000 tcp:3000` and also add
`android:usesCleartextTraffic="true"` to `<application>` in
`android/app/src/main/AndroidManifest.xml` for that local build only, because
Android blocks plain HTTP by default. Neither setting may ship.

## Logo, icons and splash screens

The Sanad mark is an open book on a rahl (رحل), the folding stand used for
the Quran, under a seal with a check: the text, verified from its source. It
is flat colour on a 64-unit grid; the book sits in front of the stand with a
transparent gap (an SVG mask), so it works on any background. It lives as
vector markup in `src/lib/brand-mark.ts`, with a light tone for sand and
paper and a dark tone for the green app icon. Everything else is drawn from
it:

- the header and footer logo (`SanadLogo`: the mark plus a live-text
  "سند / Sanad AI" wordmark set in Readex Pro);
- `public/brand/sanad-favicon.svg`, the browser tab icon: the seal alone,
  because the book and stand blur at 16-32px;
- `public/brand/sanad-mark.svg` (the full mark), `public/brand/sanad-app-icon.png`
  (touch icon) and `src/app/icon.png`;
- `assets/*.png`: the deep-green app icon tile, the Android adaptive icon
  layers, and splash screens (sand in light mode, deep green in dark mode).

`npm run brand:assets` regenerates the web files and `assets/`.
`npm run mobile:assets` does that and then writes every iOS and Android size
with `@capacitor/assets`. Both scripts need Node 23 or later, because they
import the `.ts` mark directly. The generated images are committed.

## Notes

- `out/` and the copied web assets inside `ios/App/App/public` and
  `android/app/src/main/assets/public` are build output and gitignored. Run
  `npm run mobile:build` after pulling changes.
- `mobile:build` reuses `.next/` with the export config. Run `npm run build`
  again before `npm start` on the same checkout.
- Hard reloads inside the app always land on the home screen, because
  Capacitor serves `index.html` for extensionless paths. Navigation between
  screens is client-side, so this only matters for a manual reload.
- Release signing (Apple team and provisioning, Android keystore) and store
  listings aren't set up yet.
