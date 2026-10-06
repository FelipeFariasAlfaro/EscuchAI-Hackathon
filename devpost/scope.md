---
doc: scope
status: approved
---

> **Note:** The build and all planning interactions were done in Spanish. These documents were translated to English only for the judges' convenience; the original work was carried out in Spanish.

# EscuchAI

Chrome extension that transcribes a live meeting from the tab audio, shows it in a side panel, and lets you ask an AI about the meeting while it happens.

## The Unique Kernel
The **Transcript** section is the core: live meeting text, with the least possible delay, that you can **interact with the AI in real time** over, without waiting for a transcript that arrives late.

## Who It's For
For the author, in work and study meetings. Meetings are usually in Spanish; for the hackathon, also in English. Today transcripts reach him too late and he can't work with what's being said while the meeting is still going.

## The Core Loop
Open the Transcript view during a meeting, press Record (the button turns red with the "Recording" text), watch the text appear live, and ask the AI questions about what's being said.

## Inspiration & Identity
Not set. Defined in the PRD. (Volunteered direction: the "My data" tab is an about screen, with the app icon centered.)

## Why This Matters to the Learner
"Transcripts arrive too late and I can't interact with the knowledge generated in the meeting while it happens." Also, audio and transcription are processed on his own machine, for security.

## What "Working" Looks Like
One-minute demo: open the Transcript view in a **Google Meet** meeting, record a basic interaction, watch the text appear live, and ask the AI (**Gemini**) questions about that interaction and get answers based on what was said.

## The POC Boundary
- Google Meet only.
- Record/Recording button and live transcription (Spanish and English).
- Chat with the AI about the meeting, using Gemini.
- Minimal Gemini configuration so the chat works (API key, validate, choose model, save).
- Identify who is speaking by reading the Meet DOM: **pending, resolved in `3-prd` / `4-spec`** (decide whether it enters the proof of concept or moves to "Later", based on technical feasibility).
- Everything is stored only locally in the browser. The only thing that leaves the machine is the text sent to the AI.

## Later
- Sub-tabs Tasks, Conflicts, Participation (% per participant), and Alerts (configurable words, who and at what minute).
- Summarize, copy, and export TXT/MD.
- History tab: search by title or date, modal on open, delete with confirmation.
- OpenAI, Claude, and Ollama (local) providers.
- My data tab: icon, title, version, name, email, LinkedIn, GitHub, and repository.
- Teams, Skype, and Discord.

## Explicitly Cut
Nothing for now. Everything mentioned stays in "Later".
