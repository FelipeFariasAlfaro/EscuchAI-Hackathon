# EscuchAI

A Chrome extension that transcribes a **Google Meet** meeting live and lets you ask an AI about what's being said, while it happens.

Audio is transcribed **on your own machine** with Whisper (running in the browser via [transformers.js](https://huggingface.co/docs/transformers.js)). Only **text** is sent to the AI: the polishing of each line, the summary, and your chat questions. No external databases or cloud storage are used; your configuration lives only in your browser.

## What it does

- **Live transcription** of the Meet tab audio, in Spanish and English.
- **Speaker identification**: each line shows up as `Name: sentence`. Your own voice is labeled `Tú` ("You"); if the speaker can't be determined, it falls back to `Participante Indistinguible` ("Indistinguishable participant").
- **AI chat** about the meeting, with history, using all available transcript text as context. It works while you keep recording.
- **Summarize** the meeting with the AI.
- **Copy** the transcript and **export** it as TXT or Markdown.

## Requirements

- Desktop Google Chrome (ideally with WebGPU; otherwise it falls back to WebAssembly, which is slower).
- A **Google Gemini API key**. You can get one at [Google AI Studio](https://aistudio.google.com/apikey).
- Internet access the first time (to download the Whisper model, which is then cached, and for the AI calls).

## Installation

1. Download or clone this repository:
   ```bash
   git clone https://github.com/FelipeFariasAlfaro/EscuchAI-Hackathon.git
   ```
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the project folder (the one containing `manifest.json`).
5. The EscuchAI icon (an ear) will appear in the extensions bar. You can pin it from the puzzle icon to keep it handy.

## Configure the AI (Gemini)

1. Click the EscuchAI icon to open the side panel.
2. Go to the **Ajustes** (Settings) tab.
3. Choose **Gemini** as the provider and paste your API key.
4. Click **Validar** (Validate): the list of models available for your key will load. If the key is invalid, you'll see a warning.
5. Pick a model and click **Guardar** (Save). The configuration is stored locally and persists between sessions.

> The API key is stored only in your browser's local storage (`chrome.storage.local`). It is never uploaded to any server nor included in this repository.

## Usage

1. Join a **Google Meet** meeting (`https://meet.google.com/...`).
2. With that tab active, **click the EscuchAI icon** to open the side panel.
   - This click matters: Chrome only allows capturing a tab's audio if you "invoke" the extension on it from the icon.
3. Click **Iniciar grabación** (Start recording). The button turns red with the text "Grabando" (Recording).
   - The first time, the transcription model is downloaded (a few hundred MB) and may take a moment. You'll see the progress in the panel.
4. As people speak in the meeting, transcript lines appear live.
5. Type a question in the box at the bottom to ask the AI about the meeting. You can also use **Resumir** (Summarize), **Copiar** (Copy), and export as **TXT/MD**.

### Microphone permission (optional)

The microphone is only used to transcribe **your own voice** (labeled `Tú`). The other participants' voices come through the tab audio and do **not** require the microphone.

- Recording **starts even without the microphone**: in that case only your own voice isn't transcribed.
- If you want to include your voice, EscuchAI will offer, once, to open a tab to grant the permission. Click **Permitir micrófono** (Allow microphone) and accept the Chrome dialog. Then go back to Meet and record.
- If you blocked it by mistake, you can re-enable it from the permissions icon in Chrome's address bar.

## Privacy

- The meeting audio is captured and transcribed **locally**; the audio never leaves your machine.
- The only thing sent to the AI (Gemini) is **text**: lines to polish, the summary, and your chat questions.
- There are no external databases or cloud storage. Configuration is saved only in your browser.

## How it's built

A Manifest V3 extension with four parts:

- **Side panel** (`src/sidepanel/`): the interface.
- **Service worker** (`src/background/`): coordinates capture and message passing.
- **Offscreen document** (`src/offscreen/`): runs Whisper on the captured audio.
- **Content script** (`src/content/`): reads the Meet DOM to identify the speaker.

The project planning docs (scope, PRD, spec, checklist, and an app map) are in the [`devpost/`](devpost/) folder.

## Limitations

- Google Meet only for now.
- Gemini provider only for now (OpenAI, Claude, and Ollama are left as future work).
- Speaker identification is best-effort: it depends on the Meet DOM and may fail in some cases.
