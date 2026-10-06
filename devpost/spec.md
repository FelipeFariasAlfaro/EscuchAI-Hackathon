---
doc: spec
status: approved
---

> **Note:** The build and all planning interactions were done in Spanish. These documents were translated to English only for the judges' convenience; the original work was carried out in Spanish.

# EscuchAI — Technical Spec

## How This Works, In Plain Language
EscuchAI is a Chrome extension (Manifest V3) that lives in the browser **side panel**. When you're on a Google Meet tab and press Record, the extension takes that tab's audio and turns it into text on your own machine, without sending the audio to any server. Each text block is then sent to Gemini only to polish it (punctuation, capitalization, corrections) and is shown as a line with the speaker's name. Below you have a chat where you ask Gemini about what was said, with the whole available transcript as context.

The extension has four pieces, because Manifest V3 forces the work to be split:

- **Side panel** — the interface (your tabs and sub-tabs from the mock). It's what you see and interact with.
- **Service worker** — the coordinator. It starts the tab audio capture and passes messages between the pieces. In MV3 it can't run heavy code or use audio APIs for long, so it delegates.
- **Offscreen document** — a hidden page where Whisper (the transcription model) runs over the captured audio. MV3 doesn't allow doing this in the service worker, so this document is used.
- **Content script** — injected into the Meet page, it reads the DOM to know who's speaking at each moment.

The audio never leaves your machine. The only thing that travels to Gemini is text: the blocks to polish and your chat questions. The configuration (provider, API key, model) is stored in the extension's local storage.

## The Core Journey Through the System
Implements `prd.md > The Core Journey`.

1. You open the side panel on a Meet tab. The panel asks the service worker whether AI is configured.
2. You press **Start recording**. If Gemini isn't configured → modal "configure the AI first". If the tab isn't Meet → notice "only available in Google Meet".
3. The service worker calls `chrome.tabCapture` to get the tab's audio stream and hands it to the **offscreen document**.
4. The offscreen document cuts the audio into blocks and runs them through **Whisper (transformers.js)** → raw block text.
5. That raw text is sent to **Gemini** (`generateContent` endpoint) to polish it → final block text.
6. In parallel, the **content script** in Meet reports who had the "speaking" indicator during that block. If there's no data → "Unrecognized participant".
7. The side panel shows the `Name: polished sentence` line. The button is in the red "Recording" state.
8. You type a question in the chat → it's sent to Gemini along with the whole accumulated transcript → the answer is appended to the chat (with history).
9. **Success:** live lines with names + AI answers based on what was said.

## Stack
- **Manifest V3 Chrome Extension** (JavaScript). Docs: https://developer.chrome.com/docs/extensions/develop
- **`chrome.tabCapture`** for the tab audio. Docs: https://developer.chrome.com/docs/extensions/reference/api/tabCapture
- **`chrome.offscreen`** to run Whisper outside the service worker. Docs: https://developer.chrome.com/docs/extensions/reference/api/offscreen
- **`chrome.sidePanel`** for the UI. Docs: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- **transformers.js (Hugging Face)** with a Whisper model (e.g. `Xenova/whisper-base` or `whisper-tiny` for less weight/latency). WebGPU if available, with WASM fallback. Docs: https://huggingface.co/docs/transformers.js · WebGPU: https://huggingface.co/docs/transformers.js/guides/webgpu · Reference: https://github.com/xenova/whisper-web
- **Gemini API** (`v1beta`), direct REST call with the user's API key. Docs: https://ai.google.dev/api/models · https://ai.google.dev/gemini-api/docs
- **No UI framework**: plain HTML/CSS/JS, matching the mock. Keeps the build small.

Rationale for the user's decisions:
- **Local Whisper + Gemini polishing per block**: meets "audio on the machine" (Whisper is local) and improves text quality. Accepted tradeoff: per-line latency = Whisper + round-trip to Gemini, and many Gemini calls during recording (possible free-plan rate limits).
- **AI required to record**: since polishing goes through Gemini, recording without AI configured makes no sense.

Not verified live, to confirm early in the build: exact transformers.js version and the Whisper model that best balances latency/quality; `tabCapture` + offscreen behavior in the user's Chrome version.

## Where It Runs and How Someone Tries It
- **Runtime:** desktop Chrome (ideally with WebGPU; WASM as fallback). Requires a Gemini API key.
- **Install:** `chrome://extensions` → enable developer mode → "Load unpacked" → select the project folder.
- **Use / recording the demo:** open a Google Meet meeting, open the EscuchAI side panel, go to Settings and configure Gemini (key → validate → choose model → save), go back to Meeting, press Start recording, talk, watch the lines appear, and ask the AI a question.
- **Deployment:** not applicable. The deliverable is the demo video + the public GitHub repository. The extension runs locally.

## Look and Feel
Loads from `prd.md > Look and Feel` (based on the user's mock):
- Dark theme, blue-gray background (~`#1a2130` / `#0f1420`).
- Turquoise/cyan accent (~`#39c0c8`) for buttons and the active tab/sub-tab.
- Record button: normal state in accent; active state in **red** with a red dot and "Recording" text.
- System sans-serif typography; placeholders in muted italics.
- Narrow vertical panel; active tab underlined.
- Plain CSS, no framework.

## Components

### Side Panel UI
The interface: tabs (Meeting, History, Settings, About), Meeting sub-tabs, transcript area, actions row (disabled), and chat box. The Tasks/Conflicts/Participation/Alerts sub-tabs and the Summarize/Copy/TXT/MD buttons are rendered disabled ("Coming soon").
PRD ref: `prd.md > Screens and Layout`, `prd.md > Live recording and transcription`, `prd.md > AI chat about the meeting`.

### Service Worker (coordinator)
Listens for the Record button, checks that the tab is Meet and that AI is configured, launches `chrome.tabCapture`, creates the offscreen document, and routes messages between side panel ↔ offscreen ↔ content script.
PRD ref: `prd.md > Live recording and transcription`, `prd.md > States and Boundaries`.

### Offscreen Document (transcription)
Receives the audio stream, cuts it into blocks, runs Whisper (transformers.js) over each block, and returns the raw text. Loads the model once (initial download, then cache).
PRD ref: `prd.md > Live recording and transcription`.

### Content Script (speaker in Meet)
Injected into `meet.google.com`. Watches the DOM to detect the participant with the "speaking" indicator and reports it with a timestamp. Best effort; fallback "Unrecognized participant".
PRD ref: `prd.md > Live recording and transcription` (name per line).

### Gemini Client
Shared module with two uses: (a) polish each text block, (b) answer the chat with the transcript as context. Also validates the key and lists models in Settings.
PRD ref: `prd.md > AI chat about the meeting`, `prd.md > AI configuration (Settings)`.

### Settings / Storage
Settings flow (provider → key → validate → models → choose → save) and persistence in `chrome.storage.local`.
PRD ref: `prd.md > AI configuration (Settings)`, `prd.md > States and Boundaries` (persistence).

## Data Model
Data in `chrome.storage.local` (persists across sessions, never in the cloud):
```
aiConfig = {
  provider: "gemini",
  apiKey: "<string>",
  model: "<chosen modelId>"
}
```
In-memory data during the session (lost on close; transcripts are not persisted in the POC):
```
transcript = [ { speaker: "Name" | "Unrecognized participant", text: "...", ts } ]
chatHistory = [ { role: "user" | "model", text: "..." } ]
```
- **aiConfig**: written when saving in Settings; read when opening the panel and before recording.
- **transcript / chatHistory**: live while the panel is open. (Persistent history is "Later".)

## File Structure
```
escuchai-2/
├── manifest.json              # MV3: permissions (tabCapture, offscreen, sidePanel, storage), host meet.google.com
├── src/
│   ├── sidepanel/
│   │   ├── sidepanel.html      # mock UI
│   │   ├── sidepanel.css       # dark theme + turquoise accent
│   │   └── sidepanel.js        # tabs, transcript render, chat
│   ├── background/
│   │   └── service-worker.js   # coordinator, tabCapture, message routing
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   └── offscreen.js        # Whisper (transformers.js), audio blocks
│   ├── content/
│   │   └── meet-speaker.js      # reads the Meet DOM, reports speaker
│   └── lib/
│       ├── gemini.js            # validate key, list models, polish, chat
│       └── storage.js           # chrome.storage.local wrapper
├── vendor/
│   └── transformers.min.js      # transformers.js (or CDN import with fallback)
├── assets/
│   └── icon.png
├── devpost/                     # planning workspace
└── README.md
```

## External Services and Dependencies

### Gemini API
- **Validate key + list models:** `GET https://generativelanguage.googleapis.com/v1beta/models` with header `x-goog-api-key: <API_KEY>`. Response: list of models with `name`, limits, and capabilities. Success ⇒ valid key; 400/403 error ⇒ invalid key (modal). Docs: https://ai.google.dev/api/models
- **Polish block and chat:** `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` with `x-goog-api-key` and body `{ contents: [...] }`. Docs: https://ai.google.dev/gemini-api/docs
- **Key:** provided by the user. **Rate limits:** the free plan has per-minute limits; per-block polishing may approach them. **Cost:** free within the quota.

### transformers.js (Whisper)
- Client library, no external service. Downloads the Whisper model (hundreds of MB) the first time from the Hugging Face Hub; then kept in the browser cache. Docs: https://huggingface.co/docs/transformers.js

## Important Failure Modes
- **Meet DOM selectors change / speaker not detected** → the line uses "Unrecognized participant". Validate early in the build.
- **Gemini slow or rate-limited when polishing** → show the line in a "polishing…" state and, if it fails, fall back to Whisper's raw text so the sentence isn't lost. (Minimum: visible error message.)
- **The Whisper model takes a while to download/load** → show a "loading model…" state when starting the recording the first time.
- **Invalid API key** → error modal in Settings.
- **WebGPU not available** → transformers.js falls back to WASM (slower). Validate on the user's machine.

## What Was Simplified and Why
- **No transcript persistence** (they live in memory) instead of a browsable local history — History is "Later" in the PRD. The full version would require storing and searching recordings.
- **Gemini only and Meet only** — one provider and one platform so the build fits in the POC. The other providers and platforms are "Later".
- **No-framework UI** — plain HTML/CSS/JS, enough for the mock and faster to build.

## Decisions and Open Issues
User decisions:
- **Local Whisper + Gemini polishing per block** (not deferred). Accepted tradeoff: higher per-line latency and more Gemini calls.
- **AI configuration required to record.**
- **Speaker name via Meet DOM, best effort, with fallback.**
- **Split into 4 pieces** (side panel, service worker, offscreen, content script).

Genuine user uncertainty (their learning goal = having the technical constraints surface in the spec, not in the code): **whether Whisper-WASM in the browser can give an acceptable "live" feel chained with Gemini polishing.** How it's verified: in the first build step the real end-to-end latency of a block is measured; if it's too high, the recorded plan B is to use `whisper-tiny`, shorter blocks, or defer polishing to on-demand.

Open for the build:
- Confirm the real Meet DOM selectors for the speaker.
- Choose a concrete Whisper model based on measured latency/quality.
- **About tab:** enters the POC (confirmed by the user). Static screen: icon, title, version, name, email, LinkedIn, GitHub, link to the repository.
