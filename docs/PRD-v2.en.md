> 🌐 **English** · [한국어](PRD-v2.ko.md)

# [PRD v2] Linear-integrated Bug Reporting Chrome Extension (MVP)

Final revision after review. Changes from v1 are noted per item.

## 1. Overview

- **Product:** Linear Bug Catcher
- **Purpose:** Turn a bug found during QA/testing into a Linear ticket — with a
  screenshot and network logs — without leaving the browser.
- **Target users:** internal QA, PMs, front-end/back-end engineers
- **Supported browsers:** Chromium only (Chrome, Edge)

## 2. Locked design decisions

| # | Item | Decision |
|---|---|---|
| 1 | Network capture | **fetch/XHR override** (MAIN world, `document_start`). No `webRequest` / `devtools.network` |
| 2 | Capture timing | **Always-on rolling buffer** from page load; the popup/modal only reads it. Buffer size **20 per tab** |
| 3 | Capture filter | **Allowlist glob patterns**, matched against the **full URL**. Only matches are buffered → Datadog RUM etc. excluded automatically |
| 4 | Image attachment | Linear `fileUpload` → PUT → inline `assetUrl` in the body markdown. **No own server/S3 needed** |
| 5 | Auth | **Personal API key only** (OAuth is v2). Stored plaintext in `chrome.storage.local` |
| 6 | Capture scope | **Viewport only** (`captureVisibleTab`). No full-page or video capture |
| 7 | Masking | Network body/headers **not auto-masked**. On-screen sensitive data is hidden by the user via the **mosaic tool** |
| 8 | UI form | A **page-injected overlay modal** (shadow DOM), not a popup. Settings is a separate view inside the modal |

## 3. Functional requirements

### 3.1 Auth & settings
- **REQ-01 (changed):** On first run, connect with a Linear **Personal API key**. (OAuth removed.)
- **REQ-02 (changed):** After connecting, load the accessible **Team (required) + Project (optional)**
  lists and set defaults. (`teamId` is required to create a Linear issue.)
- **REQ-11 (new):** A **network capture path pattern (allowlist)** field in settings. glob (`*`),
  one per line, matched against the full URL. Defaults: `/api/*`, `*/graphql`.

### 3.2 Capture & annotation
- **REQ-03:** On launch, immediately capture the active tab's **viewport** (`captureVisibleTab`).
- **REQ-04 (changed):** Annotation tools = **rectangle · arrow · text · mosaic (destructive)**.
  The mosaic actually pixelates the canvas bitmap, destroying the originals → no original pixels
  remain in the uploaded PNG.

### 3.3 Network logs
- **REQ-05 (changed):** Intercept fetch/XHR from page load and store **only allowlist-matching requests**
  in the rolling buffer (20). Non-matching requests (incl. telemetry) are excluded. Datadog/OTel
  tracing headers are stripped at capture time.
- **REQ-06:** Show the buffer as a list in the reporter. **4xx/5xx highlighted at the top.**
- **REQ-07:** User **selects requests via checkboxes** (request/response bodies included).
- **REQ-08 (relaxed):** No auto-masking of bodies/headers. Sensitive data is handled with the screen mosaic.

### 3.4 Linear issue creation
- **REQ-09:** Enter a title and a description (Problem / Requirements).
- **REQ-10 (clarified):** Create the issue with `issueCreate`. The **description** =
  `## Problem` + `## Requirements` + `## Screenshot` image (`![](assetUrl)`) +
  `## Network logs` selected requests (json code block). The title maps to the issue Title; everything
  else is assembled into a single Description. The image is attached via the 3-step `fileUpload` flow.

## 4. User flow
1. Find a bug → 2. Alt+Shift+B (or the icon) → 3. Viewport auto-captured + failed requests auto-checked →
4. Annotate/mosaic + select requests + enter title → 5. "Create ticket" → 6. Linear issue created + link shown.

## 5. Tech stack
- React + TypeScript, Vite + `@crxjs/vite-plugin` (MV3)
- MAIN-world content script (fetch/XHR override), ISOLATED content script (buffer + shadow-DOM modal)
- Background service worker: `captureVisibleTab` + all Linear network calls (CORS avoidance)
- Icons: `@tabler/icons-react` (inline SVG, shadow-DOM compatible)

## 6. Distribution
- Publish an **unlisted** Chrome Web Store listing, then **force-install/restrict to the org via the
  Google Workspace admin console**. (Depends on Workspace admin rights.)

## 7. Out of scope / constraints
- No video recording or full-page scroll capture.
- No traffic beyond fetch/XHR (WebSocket, sendBeacon, etc.).
- No Safari/Firefox support.
- Plaintext API key storage (encryption & OAuth are v2).

## 8. Security notes
- `chrome.storage.local` is plaintext → readable by a local attacker. Assumes a managed device.
  Client-side encryption is security theater (the decryption key is exposed alongside it). Least
  privilege comes with v2 OAuth.
