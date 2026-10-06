---
doc: prd
status: approved
---

> **Note:** The build and all planning interactions were done in Spanish. These documents were translated to English only for the judges' convenience; the original work was carried out in Spanish.

# EscuchAI — Product Requirements

Chrome extension that transcribes a live Google Meet meeting and lets you ask Gemini about what's being said, while it happens. For the author, in work and study meetings.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey
Develops `scope.md > The Core Loop` and `scope.md > What "Working" Looks Like`.

1. The user is in a Google Meet meeting and opens the EscuchAI panel.
2. They see the **Meeting** tab active, with the **Start recording** button, the sub-tabs (Transcript active), and the transcript area with the text "The transcript will appear here once you start recording."
3. They press **Start recording**. The button turns red with the text **"Recording"** and a red dot.
4. As people speak, live transcript lines appear, each with the speaker's name: `Name: sentence`.
5. The user types a question in the chat box below (e.g. "summarize what Pepito said about system X") and sends it.
6. The AI (Gemini) receives the whole transcript available up to that point and answers. The answer is appended to the chat, which keeps its history.
7. The user can keep asking while recording is still active, using whatever has been transcribed at each moment.
8. **Success:** the user sees live text with names and gets AI answers based on what was said, without waiting for a later transcript. Demonstrable in one minute on screen.

## Screens and Layout
Four main tabs in the header, next to the microphone icon and the "EscuchAI" name: **Meeting**, **History**, **Settings**, **About**.

### Meeting (the only functional tab in the POC)
- Top: **Start recording** / **Recording** button (with a dot that turns red when recording).
- Sub-tabs: **Transcript** (functional), **Tasks**, **Conflicts**, **Participation**, **Alerts** (visible but disabled / "Coming soon").
- Center: live transcript area. Placeholder before recording.
- Bottom (actions row): **Summarize**, **Copy**, **TXT**, **MD** (enabled in the POC by a decision in the final review; see `checklist.md > Revisions`). Copy/TXT/MD are local and export only the transcript; Summarize uses Gemini and shows the summary in the flow.
- Footer: **AI chat** box with placeholder and a send button.

### Settings
AI configuration flow. In the POC, only **Gemini**: choose provider, enter API key, **validate**, fetch available models, choose model, **save**.

### History and About
Visible as tabs. History is deferred (see below). **About** enters the POC: static screen with the app icon centered, title and version, name, email, LinkedIn, GitHub, and a link to the repository.

## Look and Feel
Taken from the mock provided by the user:
- **Dark** theme (dark blue-gray background).
- **Turquoise / cyan accent** color for buttons and active elements.
- Record button: normal state in light accent; active state in **red** with "Recording" text.
- Clean **sans-serif** typography; placeholder text in italics and a muted color.
- Narrow vertical panel layout (extension side panel).
- Tabs with an underline on the active one.

## Features and Behavior

### Live recording and transcription
Develops `scope.md > The Core Loop`.
- The user starts and stops recording with the top button.
- When recording, the button shows "Recording" in red with a red dot.
- The Meet tab audio is transcribed on the user's machine (ES and English).
- Each sentence is shown as a `Name: sentence` line.
- The speaker's name is obtained by reading the Meet DOM (active participant indicator) and cross-referenced with the transcript moment. Attribution is **approximate** and accepted as sufficient for the POC.
- If the speaker can't be determined at that moment, the line is attributed to **"Unrecognized participant"**.

Acceptance criteria:
- [ ] When Start recording is pressed, the button changes to red with "Recording".
- [ ] While someone speaks, new text lines appear in the format `Name: sentence`.
- [ ] When no name is available, the line uses "Unrecognized participant".
- [ ] Transcription works with Spanish and English audio.

### AI chat about the meeting
Develops `scope.md > The Unique Kernel`.
- The user types a question and sends it.
- The AI receives **the whole transcript available** up to that point as context.
- You can ask **while still recording**, using what's been transcribed so far.
- The chat keeps **history**: new messages are appended without clearing previous ones.
- Provider in the POC: **Gemini**.

Acceptance criteria:
- [ ] Sending a question appends the question and the answer to the chat without clearing previous messages.
- [ ] The answer reflects transcript content (e.g. asking about what a specific person said).
- [ ] A question can be sent during recording.

### AI configuration (Settings)
Develops `scope.md > The POC Boundary`.
- Flow: choose Gemini → enter API key → validate → load available models → choose model → save.
- The API key and configuration are saved in **local storage** and persist across sessions.

Acceptance criteria:
- [ ] With a valid API key, validating loads the models and you can choose and save.
- [ ] With an invalid API key, a **modal** appears warning of the error.
- [ ] After saving and reopening the browser, the configuration is still present.

## States and Boundaries
- **First use / AI not configured** — Trying to use the chat without Gemini configured shows a **modal/warning** indicating you must configure the AI in Settings first.
- **Before recording** — The transcript area shows "The transcript will appear here once you start recording."
- **Outside Google Meet** — Trying to record in a tab that isn't Meet indicates the feature **is only available in Google Meet**.
- **Invalid API key** — Error modal in Settings.
- **Undetermined speaker** — The line is attributed to "Unrecognized participant".
- **Persistence** — The AI configuration (provider, API key, model) persists in local storage. Nothing is stored in the cloud.
- **Deferred sub-tabs and actions** — Tasks, Conflicts, Participation, Alerts, Summarize, Copy, TXT, MD are shown disabled or with "Coming soon".

## Product Decisions
- **Show the full UI, build only the core** — the deferred sub-tabs and buttons appear disabled so the demo shows the full vision without building it.
- **Speaker attribution via Meet DOM, approximate** — it's the only realistic path in an extension; imprecision is accepted in the POC.
- **"Unrecognized participant"** as the label when no name is available.
- **Chat with history** and context = full transcript available, queryable during recording.
- **Config in local storage**, persistent, no cloud.
- **Google Meet only and Gemini only** in the POC.
- The **About** tab enters the POC (confirmed): static about screen.

## What We're Building
- Meeting tab with Record/Recording button.
- Live transcription (ES/EN) with speaker name per line and "Unrecognized participant" as fallback.
- Chat with Gemini about the transcript, with history, queryable during recording.
- Settings with the full Gemini flow (validate key, load models, save), persisted in local storage.
- States: not configured, before recording, outside Meet, invalid key.
- Deferred sub-tabs and buttons visible but disabled.

## Deferred From the POC
- **Tasks**, **Conflicts**, **Participation**, **Alerts** sub-tabs — valuable, but they don't prove the core; shown disabled.
- **Summarize**, **Copy**, **Export TXT/MD** — outside the demonstrable core.
- **History** (search by title/date, modal on open, delete with confirmation) — requires persisting recordings; deferred.
- **OpenAI, Claude, Ollama** providers — Gemini only in the POC.
- **Teams, Skype, Discord** — Meet only in the POC.
- **About** tab — included if there's time left.

## Possible Later Enhancements
- Live analysis (tasks, conflicts, participation, alerts via word dictionary).
- Export and summary of transcripts.
- Browsable and searchable local history.
- Multi-provider and multi-platform meeting support.

## Non-Goals
- No transcripts or data are stored in the cloud or in external databases.
- Perfect speaker attribution is not pursued.
- Other meeting platforms are not supported in this POC.

## Open Questions
- **Local transcription engine and tab audio capture** — how it's implemented (Web Speech API, local model, etc.) is decided in `4-spec`. It's the key technical constraint the user wants to resolve before writing code. **Must be resolved in `4-spec`.**
- **Reading the Meet DOM for the speaker** — concrete feasibility and selectors; validated in `4-spec`.
- **Inclusion of the About tab** — can be decided during the build.
