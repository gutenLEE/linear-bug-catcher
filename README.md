# Linear Bug Catcher

> Capture a screenshot and the page's network logs, annotate, and file a [Linear](https://linear.app) ticket — without ever leaving the page.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853.svg)
![React](https://img.shields.io/badge/React-18-149ECA.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)

A Chrome (MV3) extension for QA engineers and developers. When you hit a bug, press a shortcut: the current tab is captured, the recent API requests are already buffered, you annotate the screenshot, pick the failed requests, and a Linear issue is created with everything embedded in the body.

---

## Features

- **📸 One-shot capture** — grabs the visible tab the moment you open it (`chrome.tabs.captureVisibleTab`).
- **✏️ Annotate** — rectangle, arrow, text, and a **destructive mosaic** tool that pixelates sensitive data directly into the image bitmap (the original pixels are gone in the uploaded PNG — not just a visual overlay).
- **🌐 Network log buffer** — a `fetch`/`XHR` interceptor records the most recent requests (with request/response bodies) into a rolling buffer, so the failing request is already there when you open the reporter.
- **✅ Allowlist filtering** — only requests whose URL matches your glob patterns are stored, so Datadog RUM and other telemetry never pollute the buffer. Datadog/OpenTelemetry tracing headers are stripped automatically.
- **🎯 Straight to Linear** — pick a team and project, write `Problem` / `Requirements`, and the ticket is created with the screenshot and selected logs embedded in the description.
- **🔒 Local-only key** — your Linear API key lives in `chrome.storage.local`; nothing is sent anywhere except Linear's own API.

## How it works

```
[ page load ]
  MAIN-world interceptor (document_start)
    └─ overrides fetch + XHR, filters by your allowlist patterns
         └─ postMessage → ISOLATED content script
              └─ rolling buffer (N most-recent matching requests)

[ shortcut / toolbar icon ]
  background service worker
    └─ captureVisibleTab → injects/messages the content script
         └─ React modal mounts in a shadow DOM (isolated from page styles)

[ Create ticket ]
  modal → background:
    fileUpload (Linear) → PUT image → assetUrl
    issueCreate { teamId, projectId?, title, description }
      (Problem + Requirements + screenshot + logs, assembled as one markdown body)
```

The network buffer lives in the content script (not the background worker), so it survives the MV3 service worker going idle. All Linear network calls run from the background worker to avoid page CORS/CSP interference.

## Getting started

**Requirements:** Node 18+ and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/gutenLEE/linear-bug-catcher.git
cd linear-bug-catcher
pnpm install
pnpm build      # type-checks, then builds to dist/
```

### Load in Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `dist/` folder.
3. Pin the extension. Open it with the toolbar icon or **Alt+Shift+B**.

> First run opens **Settings**. Create a Linear **Personal API key**
> (Linear → Settings → Security & access → Personal API keys), paste it,
> click **Connect**, pick a default team/project, and save.

## Configuration

### Network capture allowlist

Only requests whose **full URL** matches a glob pattern (Settings) are stored:

```
/api/*
*/graphql
```

Everything else — analytics, RUM, telemetry — is dropped before it reaches the buffer. Patterns are matched against the whole URL, so host patterns like `api.example.com/*` work too.

### Ticket format

The created issue's description is assembled as:

```markdown
## Problem
<your text>

## Requirements
<your text>

## Screenshot
![screenshot](<linear-asset-url>)

## Network logs
### `GET https://api.example.com/... — 200`
​```json
{ "request": { ... }, "response": { ... } }
​```
```

## Security notes

This is a developer tool that handles credentials and captured traffic. Read before using on anything sensitive:

- The Linear **Personal API key is stored in plaintext** in `chrome.storage.local`. Anything with local OS/filesystem access can read it. Prefer a managed device; scoped OAuth is a planned improvement.
- Captured request/response bodies are **not masked** — they're attached to the ticket verbatim. Use the **mosaic** tool to hide sensitive info in the screenshot, and only check the requests you actually need.

## Limitations (MVP)

- Only `fetch` and `XMLHttpRequest` are captured (no WebSocket / `sendBeacon`).
- Viewport screenshot only — no full-page scroll capture or video.
- Requests fired before the interceptor loads on a fresh tab may be missed. Reload the tab after (re)loading the extension for full capture.
- Chromium browsers only (Chrome, Edge, …).

## Tech stack

- [Vite](https://vitejs.dev) + [`@crxjs/vite-plugin`](https://crxjs.dev) (MV3)
- [React](https://react.dev) 18 + [TypeScript](https://www.typescriptlang.org)
- [Tabler Icons](https://tabler.io/icons) (inline SVG — works inside the shadow DOM, no webfont)

## Development

```bash
pnpm dev      # HMR dev build
pnpm build    # type-check + production build → dist/
```

```
src/
├── manifest.config.ts     MV3 manifest (crxjs)
├── background/            service worker: capture + all Linear API calls
├── inject/interceptor.ts  MAIN-world fetch/XHR override + allowlist filter
├── content/              ISOLATED content script: buffer + shadow-DOM modal mount
├── lib/                  types · glob match · header filter · Linear client · storage · messages
└── ui/                   App · ReportModal · SettingsView · Annotator · NetworkList
```

## Contributing

Issues and PRs are welcome. Please run `pnpm build` (type-check + build) before opening a PR. See [docs/PRD-v2.md](docs/PRD-v2.md) for the product spec and design decisions.

## License

[MIT](LICENSE) © youhee lee
