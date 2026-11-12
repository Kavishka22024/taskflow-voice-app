# Task Assigning & Monitoring App - Phase 0 Prototype

Goal of this prototype: prove two risky things before building the full app.
1. The microphone records on your real phones / tablets / desktops.
2. Gemini understands your people's Sinhala voice notes and gives a useful task summary.

## Layout
- `backend/Code.gs`  - Google Apps Script API (holds the Gemini key; never put the key in `docs/`)
- `docs/index.html`  - test page, hosted free on GitHub Pages (must be in `docs/` for Pages)

## Setup (about 15 minutes)

### A. Gemini key (free)
1. Open https://aistudio.google.com/apikey and create an API key.

### B. Backend on Apps Script
1. Go to https://script.google.com > New project. Paste all of `backend/Code.gs` over the default code. Save.
2. Project Settings (gear icon) > Script properties > add:
   - `GEMINI_API_KEY` = your key
   - `PROTO_PASSCODE` = any passphrase you invent
   - `GEMINI_MODEL` = optional; set it to the current Flash model name in AI Studio if the default (`gemini-2.5-flash`) errors
3. Deploy > New deployment > type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   Approve the permission prompts, then copy the **Web app URL** (ends with `/exec`).
4. After any later code change: Deploy > Manage deployments > edit > Version: New version.

### C. Front end on GitHub Pages
1. Create a new **public** GitHub repo and upload this project (at least the `docs/` folder).
2. Repo Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/docs`.
3. Open the Pages URL it shows (https://<user>.github.io/<repo>/) on each device type.
4. In the page, paste the Apps Script URL and the passcode, press Save, then Test connection.

## What to test (record the results)
- Does "Start recording" work on: Android phone, iPhone, tablet, Windows desktop?
- Record 10-15 real Sinhala voice notes (quiet, noisy, mixed Sinhala + English words). Is the transcript right?
- Add 4-6 messages as Manager/Worker, press Summarize task. Is the summary accurate and useful?

## Notes
- The repo is public, so the front end code is public. That is fine: secrets live only in Apps Script properties.
- Free-tier Gemini may use content to improve Google models; use test recordings, not sensitive ones, for now.
- This prototype is protected only by a shared passcode. The real app will have per-user accounts.
