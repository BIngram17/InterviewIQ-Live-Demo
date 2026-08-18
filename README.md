# InterviewIQ Live Demo

[![Live Demo](https://img.shields.io/badge/Live_Demo-Azure_Static_Web_Apps-0ea5e9?style=for-the-badge)](https://wonderful-ocean-0c82eb910.7.azurestaticapps.net)
[![Next.js](https://img.shields.io/badge/Next.js-16-111827?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Azure Functions](https://img.shields.io/badge/Azure-Functions-2563eb?style=for-the-badge&logo=microsoftazure)](https://azure.microsoft.com/products/functions)
[![Google AI Studio](https://img.shields.io/badge/AI-Google_AI_Studio-4285f4?style=for-the-badge&logo=google)](https://aistudio.google.com/)

InterviewIQ is a production-deployed AI interview coaching application. It
analyzes a job description, generates fresh questions calibrated to the role and
seniority level, evaluates typed or spoken answers, and provides structured,
actionable coaching. Its Resume Studio also reviews resumes, recommends
job-specific improvements, and generates grounded, one-page cover letters with
Times New Roman 12-point DOCX export.

**[Launch the live application](https://wonderful-ocean-0c82eb910.7.azurestaticapps.net)**

![InterviewIQ Resume Studio with readiness tracking, tailored review, and cover-letter versions](public/resume-studio.png)

> This repository contains the public, serverless portfolio demo. The separate
> [InterviewIQ Lab](https://github.com/BIngram17/InterviewIQ) contains the
> original React, FastAPI, SQLite, SQLAlchemy, and local Ollama implementation.

## Highlights

- Generates six live behavioral, technical, and coding questions from the job
  title, description, interview type, company, and role level
- Supports internship, entry-level, mid-level, and senior interview calibration
- Imports public job-posting URLs and uses AI to prefill the title, company,
  role level, and description
- Produces fresh question sets when an interview is regenerated
- Scores answers and returns strengths, improvement areas, coaching notes, and
  an improved response
- Records voice answers in the browser and supports speech-to-text where the
  browser provides the Web Speech API
- Provides a coding workspace for JavaScript, Python, and Java
- Runs JavaScript tests inside a restricted browser iframe and automatically
  sends the result to the AI coding coach
- Reviews Python and Java solutions as inert text without executing them
- Provides IDE-style coding controls with Tab/Shift+Tab indentation, automatic
  indentation on Enter, and closing-brace outdent behavior
- Saves interview sessions and session-scoped answer attempts in browser storage
- Tracks application readiness and autosaves named drafts, extracted resume
  text, reviews, targeted edits, and versioned cover letters in device-local
  storage for up to 24 applications with restore, rename, confirmed delete,
  and undo controls
- Includes copy and downloadable text feedback reports
- Provides responsive light and dark themes
- Includes a dedicated Resume Studio for role-fit reviews, targeted resume
  changes linked to job requirements, ATS keyword guidance, and grounded cover
  letters with professional, concise, and conversational tones
- Distinguishes safe rewrites from recommendations that require candidate input,
  with per-change and bulk-copy controls
- Uses a transparent 100-point job-fit rubric, projected improvement score, and
  prioritized edits with estimated point impact to show the strongest path to a
  90%+ match without inventing qualifications
- Exports cover letters as TXT or DOCX and preserves up to ten generated versions
- Provides a persistent Interview Prep / Resume Studio switcher on desktop and mobile
- Accepts drag-and-drop PDF, DOCX, and TXT resumes and extracts their text
  without permanently storing the uploaded file
- Runs Playwright end-to-end tests for the tailored application flow, local
  memory, and mobile navigation before Azure deployment

## Architecture

```mermaid
flowchart LR
    U["Browser"] --> UI["Next.js + React static frontend"]
    UI --> INTERVIEW["Interview Prep"]
    UI --> RESUME["Resume Studio"]
    API["Azure Functions API"]
    AI["Google AI Studio / Gemini API"]
    RUNNER["Sandboxed JavaScript test runner"]
    STORE["Browser session memory"]
    JOB["Public job posting"]
    FILES["PDF / DOCX / TXT"]

    INTERVIEW --> API
    INTERVIEW --> RUNNER
    INTERVIEW --> STORE
    RESUME --> API
    RESUME --> STORE
    FILES --> API
    API --> AI
    API --> JOB
```

The frontend is statically exported by Next.js and hosted through Azure Static
Web Apps. AI requests are sent to managed Azure Functions so the Gemini API
credential never enters client-side code.

### API routes

| Route | Purpose |
| --- | --- |
| `POST /api/interview` | Analyze the role and generate a fresh interview set |
| `POST /api/feedback` | Score and coach a behavioral or technical answer |
| `POST /api/code-feedback` | Review JavaScript, Python, or Java code as text |
| `POST /api/job-import` | Safely fetch a public posting and extract structured job details |
| `POST /api/resume-extract` | Extract bounded plain text from an uploaded PDF, DOCX, or TXT resume |
| `POST /api/resume-tools` | Review resumes, suggest edits, or generate a grounded cover letter |

## Security Design

This demo treats job descriptions, answers, and source code as untrusted data.
Its defensive controls include:

- Server-side model credentials stored in Azure application settings
- Explicit prompt boundaries that prevent user data from becoming system
  instructions
- Length limits, control-character removal, input validation, and normalized
  structured outputs
- Request-size limits, AI timeouts, and basic per-IP request throttling
- Content Security Policy and restrictive browser security headers
- Sandboxed JavaScript execution in a dedicated iframe with network access
  disabled
- Code review prompts that treat submitted source code as inert text
- Public-job URL validation, redirect revalidation, response-size limits, and
  local/private network blocking to reduce server-side request forgery risk
- Resume file type, signature, and 5 MB size validation before text extraction

These controls reduce prompt-injection and code-execution risk, but they are not
presented as a guarantee against every possible attack.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, CSS, DOCX generation |
| API | Node.js 22, Azure Functions |
| AI | Google AI Studio / Gemini API, `gemini-3.6-flash` by default |
| Hosting | Azure Static Web Apps |
| Browser APIs | MediaRecorder, Web Speech, Clipboard, Blob |
| Security | CSP, iframe sandboxing, input validation, prompt boundaries, SSRF safeguards |
| Testing and CI/CD | Playwright, ESLint, GitHub Actions |

## Run Locally

### Prerequisites

- Node.js 22 or newer
- A Gemini API key from Google AI Studio

`gemini-3.6-flash` is available on the Gemini API free tier, subject to
[Google's current quotas and pricing](https://ai.google.dev/gemini-api/docs/pricing).
Free-tier request content may be used to improve Google's products; use a paid
tier if that data policy is not appropriate for your deployment.

Install dependencies:

```bash
npm install
npm --prefix api install
```

Create `api/local.settings.json` for local Azure Functions development:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "GEMINI_API_KEY": "your-key",
    "GEMINI_MODEL": "gemini-3.6-flash"
  }
}
```

Never commit `local.settings.json` or a real token.

For frontend-only development:

```bash
npm run dev
```

Run linting and the desktop/mobile browser suite:

```bash
npm run lint
npx playwright install chromium
npm run test:e2e
```

For the complete static frontend and managed API:

```bash
npm run build
npx @azure/static-web-apps-cli start out --api-location api
```

Open the local URL printed by the Static Web Apps CLI.

## Production Deployment

Build the static frontend:

```bash
npm run build
```

The frontend is exported to `out/`. Deploy it with the Azure Functions API:

```bash
npx @azure/static-web-apps-cli deploy out --api-location api --env production
```

Configure these Azure Static Web Apps environment variables:

```text
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_FALLBACK_MODEL
GEMINI_ATTEMPT_TIMEOUT_MS
GEMINI_TOTAL_TIMEOUT_MS
```

`GEMINI_MODEL` is optional and defaults to `gemini-3.6-flash`.
`GEMINI_FALLBACK_MODEL` is optional and defaults to
`gemini-3.5-flash-lite`. Transient provider failures are retried with bounded
exponential backoff. A stalled primary request is aborted independently so the
fallback model receives a fresh request budget instead of inheriting an expired
signal. The optional attempt and total timeout settings default to 17 and 50
seconds respectively. Gemini thinking is set to `low` for these latency-sensitive
structured JSON operations so reasoning does not consume the response budget.

## Project Structure

```text
interviewiq-live-demo/
|-- api/
|   |-- src/functions/       # Interview, resume, answer, and code endpoints
|   `-- src/lib/ai.js        # Gemini API client and API safeguards
|-- app/
|   |-- components/          # Job importer and persistent product switcher
|   |-- resume/              # Resume review and cover-letter workspace
|   |-- page.tsx             # Interview workflow and client state
|   |-- globals.css          # Responsive light/dark product interface
|   `-- layout.tsx           # Metadata and social preview configuration
|-- public/
|   |-- code-runner.html     # Restricted JavaScript runner frame
|   |-- code-runner.js
|   |-- resume-studio.png    # Browser-tested product screenshot
|   `-- staticwebapp.config.json
|-- e2e/                     # Playwright desktop and mobile flows
|-- playwright.config.ts
`-- README.md
```

## Demo Data and Limitations

- Interview and application sessions are stored in the current browser, not a
  hosted database or user account.
- The public demo does not require an account.
- Recorded audio remains in the browser and is not uploaded to the API.
- JavaScript is the only language executed by the built-in test runner.
- Python and Java receive AI review without server-side execution.
- AI availability and limits depend on the Gemini API and the configured model.
- The public demo's rate limiter is instance-local and does not replace a
  provider-side budget or quota cap.
- Job URL import works only for public HTML pages; sites that block automated
  access require the user to paste the job description manually.
- Image-only or heavily formatted PDFs may not contain enough readable text;
  DOCX or pasted text is the recommended fallback.

## Related Project

The [InterviewIQ Lab](https://github.com/BIngram17/InterviewIQ) demonstrates a
different full-stack architecture with React, Vite, FastAPI, SQLAlchemy, SQLite,
and a locally hosted Ollama model. Keeping the two repositories separate makes
the local product work and the publicly deployed serverless demo independently
understandable.

## License

Released under the [MIT License](LICENSE).
