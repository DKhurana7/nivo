# Nivo: complete codebase reference

Updated 24 September 2026 after the account-first platform walkthrough. **Read the newest checkpoint at the top of HANDOVER.md for exact test results, runtime database selection, processes and remaining work.** This file describes the current product; historical handover sections are explicitly superseded. Implemented and locally tested source is not proof of public production readiness.

**Audit status.** All 12 Phase 0 tasks are complete and all 218 frozen inventory rows have recorded results. Six findings are fixed (rate validity, request throttling, workbook-deletion warning, modal focus, production font CSP and misleading overview voice status); callback authority and workspace-wide concurrency are explicitly deferred to Phase 1. See the latest HANDOVER checkpoint for current suite counts; the historical Phase 0 checks below remain recorded evidence. Live English browser voice and quotation extraction succeeded; later unverifiable model evidence was safely refused. The running local API has been restored to the real Raisina studio, so audit fixtures require an explicit switch back to `data/audit.sqlite`. See `docs/PRODUCTION_RELEASE.md` for outstanding deployment work.

## Product and scope

Nivo (nee-vo) is Technosmart Interiors' BOQ estimating and vendor quotation workspace for Indian interior/turnkey projects. Users create BOQs or receive client Excel workbooks, obtain prices from vendors/past projects/online references, review pricing evidence, calculate costs/selling prices and issue quotations. The new voice workflow requests vendor quotations through a self-hosted LiveKit agent. Human review separates transcript extraction from accepted rate evidence and BOQ application. Nivo never places purchase orders or invents live market prices.

Root: `/Users/dk/Desktop/DEV/TSInteriors/nivo`. Siblings `TSInteriors`, `LayoutEngine` and `TSInteriorsReel` are independent projects; do not modify them or read/reuse their secrets. Echo at `/Users/dk/Desktop/DEV/Comsync/Repositories/Echo` was an architectural reference for agents only, not a dependency or source of customer data/credentials. The Nivo name has not undergone trademark clearance.

Two operating modes now exist:

- Local demo: browser localStorage workspace, IndexedDB original workbooks, illustrative seed data; no authentication or calling.
- Signed-in studio: same-origin authenticated Node API, private SQLite workspace/file/call persistence, revision conflict protection, enquiry voice controls. One account owns one isolated studio. Shared staff roles and self-service account administration are not implemented.

The backend, synthetic English WebRTC conversation and real local-model extraction have passed. The continuation speech smoke exited 0 with four transcript turns, 54.4 seconds of received audio and a validated but human-unreviewed ₹125/m tax-exclusive draft. Browser checks covered disclosure/audio, mute/unmute, second-call refusal, end and cancellation cleanup. A later extraction failed exact-evidence validation and returned 422 while preserving the prior draft; model repeatability remains a release concern. **Public deployment, PSTN and Hindi/Hinglish are unvalidated.** Telephone calls require a SIP carrier and remain disabled. No paid infrastructure was provisioned or real vendor contacted.

## Architecture

React19/TypeScript/Vite frontend, plain CSS, Motion, self-hosted Manrope, original SVG brand/icons, lazy ExcelJS, PDF.js and LiveKit browser SDK. Fastify API uses Node's built-in SQLite module, native scrypt/session cryptography, private workbook BLOBs, call snapshots and audit events. Python LiveKit Agents1.8.2 worker uses STT→LLM→TTS, Silero VAD, optional DPDFNet and signed callbacks. Linux deployment separates app, LiveKit, Redis, worker, Caddy and opt-in SIP.

```text
StudioAccess -> /api/session + /api/workspace -> App -> screen callbacks
       local demo fallback                   -> useWorkspace
                                                 local: localStorage
                                                 studio: serialized revision-checked PUT
Excel upload -> explicit mapping -> structured parser -> preview -> workspace
             -> original bytes in IndexedDB OR authenticated /api/files
Enquiry -> saved complete brief -> call API -> LiveKit named dispatch
        -> worker fetches brief with HMAC -> voice conversation
        -> signed transcript events -> call register -> extraction model
        -> unverified draft -> explicit quotation form -> rate library -> explicit BOQ application
```

Hash routes: overview, projects, boq, rates, vendors, enquiries, settings. Selected project is in memory and falls back to first project after reload. Auth cookies are HttpOnly, SameSite Strict and Secure in production. App and API deliberately share one origin; frontend-only hosting requires additional routing work.

## Commands

Use Node22.22+ for fresh installs (local validation used22.14; one transitive dependency requests22.22). Python3.12/3.13. On this Mac a login shell may select Node18; development commands used non-login shells.

```sh
npm ci
npm run dev                 # frontend http://127.0.0.1:5178, /api proxy ->8787
npm run build               # strict frontend/test types + dist
npm run check:server
npm test
npm run test:server
npm run test:e2e             # installed Chrome, local test API on8789
npm run format
npm run format:check
node scripts/verify-audit.mjs # frozen inventory and finding-disposition gate
node scripts/configure-local.mjs  # once; refuses to overwrite .env
npm run user:create -- you@example.com "Studio name"
npm run server              # persistent API + built frontend on8787
agent/.venv/bin/python -m pytest agent/tests -q
agent/.venv/bin/python -m agent.worker dev
```

Detailed model/download/deployment/SIP/backup commands and researched free-hosting limits are in `docs/HOSTING_AND_VOICE.md`. Generated config and all secrets belong in ignored `.env` / `deploy/generated`. Provider keys never belong in Vite variables, browser storage, room metadata or quotation notes. `.npmrc` keeps the legacy peer resolver because npm10 previously crashed on optional Vitest peer resolution. `package-lock.json` locks Node packages; ExcelJS UUID override selects a patched CJS-compatible version.

## Source map

| Path                                                                     | Purpose                                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                              | Maintenance instructions, reference/verification requirements                                                   |
| `docs/audit/INVENTORY.md`                                                | **Frozen** 218-row checklist of every verifiable behaviour, with a result column per operating mode             |
| `docs/audit/FINDINGS.md`                                                 | Recorded defects; disposition goes ON the severity line, which an exit gate greps                               |
| `docs/audit/ENVIRONMENT.md`                                              | Audit baseline: versions, service PIDs, true suite results at audit start                                       |
| `docs/superpowers/specs/2026-09-23-phase0-audit-design.md`               | Phase 0 design: what the audit establishes and how                                                              |
| `docs/superpowers/plans/2026-09-23-phase0-audit.md`                      | Phase 0 implementation plan, 12 tasks completed; execution details in HANDOVER.md                               |
| `docs/TELEPHONY_RESEARCH.md`                                             | Indian outbound-calling regulatory and provider research for Phase 2; not legally reviewed                      |
| `scripts/audit-env.mjs`                                                  | Provisions the isolated `data/audit.sqlite` with two fictional accounts; never touches the real studio database |
| `server/tests/isolation.test.ts`                                         | Cross-account isolation and rejection-path tests, proven discriminating                                         |
| `PLAN.md`                                                                | Original local-v1 plan and visual brief                                                                         |
| `UPGRADE_PLAN.md`                                                        | Preimplementation beta upgrade plan                                                                             |
| `HANDOVER.md`                                                            | Active state, results, limitations, remaining tasks and process inventory                                       |
| `README.md`                                                              | Startup overview                                                                                                |
| `docs/HOSTING_AND_VOICE.md`                                              | Deployment/voice/free-hosting guide with primary sources                                                        |
| `src/main.tsx`                                                           | StrictMode, MotionConfig, local font/CSS and StudioAccess bootstrap                                             |
| `src/App.tsx`                                                            | Shared workspace, routing, desktop/mobile shell, search, notifications, privacy/terms                           |
| `src/styles.css`                                                         | Design tokens, all layouts, responsive/print/reduced-motion behavior                                            |
| `src/lib/types.ts`                                                       | Workspace/project/item/vendor/rate/enquiry/mapping types and ID/date helpers                                    |
| `src/lib/seed.ts`                                                        | Clearly fictional demo workspace, no real vendor contact details                                                |
| `src/lib/costing.ts`                                                     | INR formatting, rounding, totals, assemblies, unit aliases, source matching/expiry                              |
| `src/lib/validation.ts`                                                  | Shared runtime workspace validation, used in backend and browser                                                |
| `src/lib/storage.ts`                                                     | Local or studio persistence; serialized revision checks, pending-change guard, conflict freeze                  |
| `src/lib/api.ts`                                                         | Same-origin fetch/errors, studio bootstrap state, workbook transfer, flush-before-call                          |
| `src/lib/spreadsheet.ts`                                                 | Lazy ExcelJS reader, mapped parsing, retained source and clean client/internal exports                          |
| `src/lib/workbook-patch.ts`                                              | Direct original OOXML ZIP cell patch, preserving unrelated parts                                                |
| `src/lib/backup.ts`                                                      | JSON workspace + base64 original workbook backup/restore in both modes                                          |
| `src/components/ui.tsx`                                                  | Original icons, badges, native accessible dialogs, fields, empty/loading states, plan drawings                  |
| `src/components/forms.tsx`                                               | Project/item/vendor/rate forms; cost components, quantity basis, source context, quote draft review             |
| `src/components/ImportDialog.tsx`                                        | XLSX mapping, source-reference mapping, preview/warnings, source-cost opt-in, replacement                       |
| `src/components/BoqPage.tsx`                                             | Pricing/review/approval/filtering/export and dedicated phone item layout                                        |
| `src/components/WorkspacePages.tsx`                                      | Overview, project register, vendors, rate evidence library                                                      |
| `src/components/EnquiriesPage.tsx`                                       | Item selection, full vendor brief, manual notes/quote capture, VoiceDesk integration                            |
| `src/components/VoiceDesk.tsx`                                           | Service readiness, browser audio, mute/end, gated phone call, transcript history, extraction draft review       |
| `src/components/SettingsPage.tsx`                                        | Studio defaults, backups, deliberate restore/reset, account signout/integration explanation                     |
| `src/components/StudioAccess.tsx`                                        | Studio sign-in/loading/error screen and explicit local-demo choice                                              |
| `public/nivo-mark.svg`, `nivo-wordmark.svg`                              | Original folded-plane vector identity                                                                           |
| `server/db.ts`                                                           | SQLite schema/WAL, account creation, scrypt/hash helpers                                                        |
| `server/app.ts`                                                          | API/auth/CSRF/limits/tenant access, workspace/files, call lifecycle, signed callbacks, watchdog, static serving |
| `server/voice.ts`                                                        | Provider availability, safe cost-free brief, LiveKit room/dispatch/SIP/token functions, agent health            |
| `server/extraction.ts`                                                   | Configurable compatible local model extraction and strict draft/evidence validation                             |
| `server/index.ts`                                                        | API listener and graceful shutdown                                                                              |
| `server/create-user.ts`                                                  | Operator-only account provisioning; no public signup                                                            |
| `server/tsconfig.json`                                                   | Backend strict typecheck                                                                                        |
| `agent/config.py`                                                        | Validated VAD/endpoint/interruption/denoising/language settings                                                 |
| `agent/worker.py`                                                        | Named LiveKit worker, providers, bounded quote-only agent, disclosure, turn events and cleanup                  |
| `agent/local_models.py`                                                  | Faster Whisper STT and Piper TTS LiveKit adapters                                                               |
| `agent/noise.py`                                                         | Independent per-call DPDFNet FrameProcessor with FIFO buffering/native resampling                               |
| `agent/callbacks.py`                                                     | HMAC brief fetch/events, private durable retry spool and replay command                                         |
| `agent/setup_models.py`                                                  | Explicit free local audio-model downloads                                                                       |
| `agent/smoke_audio.py`                                                   | Real synthetic Piper→Whisper and DPDFNet smoke                                                                  |
| `agent/smoke_session.py`                                                 | Real local WebRTC synthetic conversation test, no telephone dialing                                             |
| `agent/requirements.txt`                                                 | Pinned LiveKit SDK/plugins and bounded local inference dependencies                                             |
| `scripts/configure-local.mjs`                                            | Random secret and local/Linux/SIP configuration generation, no overwrites                                       |
| `scripts/inspect-boq.ts`                                                 | Read-only private workbook compatibility counts; never imports source into app                                  |
| `scripts/register-trunk.ts`                                              | Explicit operator action to register configured carrier trunk; never auto-run                                   |
| `scripts/backup-server.ts`                                               | Consistent SQLite VACUUM INTO snapshot, includes call/account/file data                                         |
| `scripts/voice-test-server.ts`                                           | Temporary in-memory fictional studio and private local test credentials                                         |
| `Dockerfile`, `agent/Dockerfile`                                         | App and worker container builds                                                                                 |
| `compose.local.yaml`                                                     | Local LiveKit container, native app/worker/models                                                               |
| `compose.linux.yaml`, `deploy/Caddyfile`                                 | Linux host-network services, persistent volumes, HTTPS, optional SIP                                            |
| `.env.example`                                                           | Non-secret provider/host/audio defaults and configuration guide                                                 |
| `tests/costing.test.ts`, `spreadsheet.test.ts`, `structured-boq.test.ts` | Domain, quantity/context/merge/formula/ZIP preservation tests                                                   |
| `server/tests/api.test.ts`                                               | Isolation, auth, CSRF, revisions, callbacks, extraction evidence tests                                          |
| `agent/tests/test_audio.py`                                              | Denoising FIFO/state, tuning bounds and scope checks                                                            |
| `tests/e2e/workflows.spec.ts`, `studio.spec.ts`                          | Chrome local workflows, studio API integration, responsive/focus/conflict checks                                |
| Vite/Vitest/Playwright/TS/Prettier config                                | Builds, test discovery, browser server setup and formatting                                                     |
| `data/`, `models/`, `agent/.venv/`, `dist/`, `test-results/`             | Ignored runtime/model/build/test artifacts, never source                                                        |

## Domain invariants

Local operation is documented in `docs/LOCAL_STUDIO.md`. The persistent studio is provisioned with the Raisina workbook; credentials and client data stay under ignored `data/`. Additional tools: `scripts/prepare-boq.ts` prepares a private, restorable backup from explicit mapping/project JSON; `scripts/setup-local-studio.ts` provisions an empty local database and retains source bytes transactionally; `scripts/verify-local-studio.mjs` checks browser login, persisted items and source hash; `scripts/smoke-browser.mjs` runs the synthetic live-browser controls; `scripts/smoke-extraction.ts` checks actual local-model extraction. Backend typechecking now includes all TypeScript scripts, including explicit SIP transport configuration in the trunk-registration script. `agent/tests/test_callbacks.py` covers durable delivery and concurrent replay.

Workspace version remains1, with backward-compatible optional fields. Local key `nivo.workspace.v1`; old numeric items work without migration. Workspace has settings/projects/vendors/rates/enquiries. Projects carry metadata, markup/GST, items, optional original workbook/mapping/general notes. Due dates may be blank; undated projects are excluded from the next-deadline panel. Signed-in workspaces are validated JSON snapshots in tenant-scoped SQLite, not a fully normalized estimating database.

Items retain description/specification/category/unit, nullable quantity, nullable cost, source rate link and review state. Optional `brand`, `model` and `vendorId` identify the selected product and cost vendor; each rate has optional `brand`/`model` and its existing vendor/source/date/terms. These are backward-compatible version-1 fields, not a new normalized product catalog. New fields: quantityKind measured/rate-only/unknown; reference; section; source-row context; sourceRate; assembly material/labour/other/adjustment; markupOverride. Original numeric zero source rates are treated as placeholders during import; manually entered zero costs remain intentional zero.

- Null cost is unpriced, distinct from zero. Null quantity is RO or unresolved, never silently zero.
- RO keeps a selling unit rate and no line amount. Unknown quantity also has no amount and blocks approval.
- Assembly cost = round((material+labour+other)×(1+adjustment/100)). Adjustment is generic, not automatically called wastage.
- Selling rate = round(cost×(1+(item markup override or project markup)/100)). Markup is on cost, not gross margin.
- Measured line amount = round(quantity×rounded selling rate). Subtotal sums lines; project GST applies to subtotal. Mixed GST and accounting input-tax treatment are not modeled.
- Applying a quote atomically copies cost, brand, model and vendor, and clears review and assembly. Missing product details clear any previous selection rather than inheriting the previous brand. Editing costs/specifications/quantity/pricing reopens Draft. Review/approval requires priced lines, no unresolved quantities and no expired linked evidence.
- Rate candidates use category/unit filters and token overlap, not semantic AI matching. Explicit confirmation still required.
- Rates record description/specification/unit/cost/vendor/source/reference/date/validity/location/terms. Online/manual sources are user-entered, not live web retrieval.
- Enquiries link one project/vendor and selected items. Captured quotes enter the library as separate offers and are applied separately; multiple brand/model offers for the same enquiry item are retained. Model drafts never change prices automatically.

## Workbook behavior

XLSX max10MB,10,000rows/100columns per sheet. Explicit sheet/header/description/quantity/unit/reference/spec/rate/amount mapping. Source purchase costs opt-in; nonzero original rates remain source evidence regardless of import choice. Sections and non-priced text rows are retained conservatively as context; this is heuristic, not exact semantic hierarchy. Review relevance before sending a vendor brief. Notes worksheets become project generalNotes.

RO values and blank/invalid quantities are retained. Merged quantity continuation rows attach their descriptions to the anchor item instead of becoming duplicate prices. Original row and reference remain traceable. Rich text/cached formula results work; ExcelJS does not recalculate formulas.

Three exports (now selected in `ExportDialog`, followed by preview and an explicit **Download Excel** action):

1. **Client quotation**: newly generated workbook with selling rates, specifications and totals; no purchase costs or private original sheets.
2. **Internal costing workbook**: clean workbook with costs and selling prices, explicitly internal.
3. **Original internal workbook**: direct ZIP/XML patch of mapped cells, leaves unrelated entries intact, preserves client formulas and requests Excel recalculation. Contains ALL original sheets and may expose private costing/discounts/margins. Never present it as automatically client-safe.

Structural item edits/deletions disable original mapping; deleting an item from a mapped workbook requires a warning that original-workbook export will become unavailable for the entire project; new unsourced lines reject original export. Unpriced lines retain their original source cells, including existing rates, as unconfirmed source evidence. Priced rate cells containing formulas reject the export with the cell address instead of silently skipping a price. Amount formulas remain intact and request Excel recalculation. Clean exports still leave unpriced rates blank. Validate output in Excel before issue. This is not a guarantee for every OOXML extension, malformed archive or Excel feature.

The private Raisina workbook has now been copied into the persistent local studio: five sheets,112unique items (86measured,25RO,1unknown),four nonzero rates retained only as source evidence, merged warranty note retained. All112 costs remain null. The unresolved quantity is the managed-switch item at source row188. The original Downloads file is unchanged, and the stored workbook hash matches the prepared original. Client/location/due date are blank pending confirmation; markup20% and GST18% are reviewable defaults. The BOQ displays original item references and directs users to inherited specification context. Client data and screenshots remain ignored, not Git fixtures.

## Backend and voice contract

SQLite tables: users, sessions, workspaces, files, calls, events, audit. Passwords are salted scrypt hashes; raw session tokens only in HttpOnly cookies, hashes in DB. Sessions expire after7days. Mutation requests require custom same-origin request header (`x-nivo-request`) and matching Origin when present; this is verified enforced. Request size limits apply. **Rate limits are active:** the synchronous `makeApp` factory registers routes inside an asynchronous Fastify registration scope after cookie/rate-limit/Helmet plugins boot. Login enforces 10 attempts per 15 minutes and the global limit is 300 requests per minute per IP. Regression checks assert headers and 429 enforcement (F-02 fixed). This does not implement per-account lockout or shared distributed limiter storage. All user-accessible workspace/file/call queries are scoped by authenticated account, and cross-account isolation has been verified by direct API request with tests confirmed to fail if the tenant predicate is removed. The `/api/agent/*` callback endpoints are the exception: they query calls by id with no tenant predicate, gated only by one shared `AGENT_CALLBACK_SECRET` (finding F-03, deferred to Phase 1). Workspace PUT uses compare-and-swap revision and returns409 rather than overwriting another editor. Failed sync freezes automatic writes and keeps pending state exportable.

API endpoints: health/session/login/logout; GET/PUT workspace; GET/PUT files/:id; voice/status; calls list/detail/create/end/extract; signed agent brief fetch and event delivery. Call setup uses immutable saved brief, server-selected vendor number and named dispatch `nivo-quotes`. Phone mode requires flag, trunk, international number and explicit UI confirmation. One active call per studio; idempotent request IDs. Browser token is short-lived and room-scoped. Room metadata carries only call UUID. Agent fetches full brief over signed API, without internal prices or provider secrets.

Callback HMAC signs timestamp plus exact JSON envelope payload, checks a five-minute window and event ID replay. Terminal calls cannot be reopened by a late event; shorter transcript snapshots do not replace longer ones. Call creation rechecks idempotence after asynchronous worker health probing. Cancellation during setup deletes any subsequently created room without reopening terminal state. Missing rooms count as already ended. Watchdog cleanup failures remain visibly pending and retry; failed cleanup is not reported as success. Malformed signed null events return400. Worker has duration and inactivity bounds, opt-out/end-call tool, transcripts and no purchases/transfers. The browser cancels setup on unmount and wraps call controls on phones; enquiries above20 items show the voice limit. Do not rely on prompt instructions alone as a regulatory or accuracy guarantee.

Extraction uses server-configured compatible chat endpoint. Validated drafts must reference known items, finite nonnegative costs, explicit/unknown tax basis and a verbatim vendor transcript excerpt. A conservative English tax-phrase check downgrades unsupported or conflicting model tax classifications to unknown; observed “GSD” STT text must not silently become “GST”. This checks provenance, not semantic correctness or negation in arbitrary language. Human verifies specification, quoted unit, amount, tax, scope and validity in RateForm. Tax-inclusive/unknown amounts and mismatched units do not prefill ex-GST costs. Evidence and terms survive review/save. No raw recording by default. Transcript callback failures spool privately using atomic completed-file publication and retry; concurrent deletion by another delivery/replay no longer fails a new conversation. The Python smoke explicitly releases audio streams and garbage-collects native callback cycles before SDK shutdown.

## Design and accessibility

Architectural precision desk: ink#183247, canvas#edf0f2, paper#f6f7f5, blue#315bdb, muted#667985, borders#d6dfe4. Manrope and tabular money. Crisp0–2px corners, original icons/logo/plan drawings. No UI kit/Lucide, gradients, shadows, pure-white backgrounds, glass, neon, purple/black theme, decorative bento/radial/dot treatments, sparkle/checkmark marketing, fake testimonials or feature-card trios. Follow user's reel screenshot, not generic SaaS defaults. Official Anthropic frontend-design guidance was read for original v1; image generation is unnecessary for native SVG assets.

Motion is brief page opacity, dialogs and action feedback; skeleton only while loading. Reduced-motion honored. No decorative hover motion. Native dialogs use explicit Tab/Shift+Tab wrapping among visible enabled controls, support Escape and restore focus; mobile nav is inert when closed and traps focus while open. Phone BOQs have dedicated item layout below600px. Tables contain their own overflow. Touch inputs16px and readable focus labels. Automated Chromium320/390/768/1024/1440 checks are not claims of physical iOS/Android compatibility.

## What the audit established

All 218 frozen inventory rows carry results and evidence. The gate checks unchanged behavior descriptions/IDs and explicit finding dispositions; it permits documented deferred work and does not certify production readiness.

- **Costing invariants pass:** null versus zero, rate-only versus unknown quantity, assemblies, markup overrides including zero, rounding and stale evidence. Blank validity no longer means permanently expired; normal form validation still requires a date.
- **User-facing API isolation passes:** cross-account probes failed, and tests were checked for sensitivity to removing ownership predicates. Worker callback authority remains the separate F-03 Phase 1 issue.
- **Exports and persistence pass:** client exports build fresh workbooks without reading original bytes or copying private source sheets. Original bytes survive backup/reset/restore exactly. Two real tabs editing different projects receive a revision conflict; pending edits remain exportable without overwriting server state (F-06).
- **Both modes were walked:** screens, filters, dialogs, forms, review gates, all three Excel exports, mobile layouts, keyboard operation and logout. Browser audit results comprise 27 passing scenarios in one run and two additional passing modal-wrap scenarios.
- **Built assets were tested:** real Fastify production cookies/CSP, login, quotation download and reload. Vite `assetsInlineLimit: 0` emits fonts as files compatible with `font-src 'self'`.
- **Live browser voice was exercised:** disclosure/audio, actual participant mute state, end/cancellation room cleanup, duplicate-call refusal, unavailable-worker refusal and reviewed draft preservation. Successful extraction and safe rejection were both observed; no telephone call was made.

Permanent regression coverage includes `tests/e2e/modal.spec.ts`, `workbook-delete.spec.ts`, `production.spec.ts` and the expanded `studio.spec.ts`. Opt-in real-service audits live in `tests/audit/` with `playwright.audit.config.ts`; they require the isolated audit API and fictional accounts. `scripts/verify-audit.mjs` checks the frozen inventory against `f9460ae` and findings' severity-line dispositions.

Historical Phase 0/recovery checks: 23 domain tests, 25 backend tests, 16 permanent browser tests and six Python tests passed; frontend build, backend typecheck, formatting and both npm vulnerability audits passed. Linux Compose syntax passed. Both Linux ARM64 images now build. Isolated container checks pass for production app persistence/recovery and worker cache/spool permissions; real Linux Piper/Whisper/DPDFNet audio also passes. The public host, x86 builds and external media networking remain untested.

## Delivery limits and next decisions

Free local browser testing is possible on existing hardware; phone carrier minutes and reliable public capacity are not promised free. Oracle availability/reclamation and Render ephemeral/sleep limits matter; use the sourced hosting guide. Linux Compose/HTTPS/TURN/SIP must be validated on the actual host. No account was provisioned externally.

No staff roles, password-reset email, commercial billing, background campaign dialer, automatic web-rate search, model accuracy guarantee, or fully semantic workbook recognition. English Piper baseline does not establish Indian language readiness. Studio reset does not delete stored calls/audit/orphan files. JSON backup excludes server account/call history; consistent server backup covers SQLite. Define retention, account deletion and operator recovery before broader external use. Legal/policy copy is beta disclosure, not a compliance certification.

Run appropriate domain/backend/browser/audio checks after changes, inspect screenshots, and keep HANDOVER.md truthful about actual live validation. Never replace missing providers with simulated successful calls or quotations.

## Continuation and release inputs

`docs/PRODUCTION_RELEASE.md` describes the concrete built artifact and outstanding launch checks. `docs/superpowers/specs/2026-09-23-phase1-input.md` lists scoped worker authorization, firm memberships, row-level persistence, reversible migration and preserved invariants; it is input to a future plan, not an approved implementation specification. The first release is now scoped to Technosmart only, one operator/one BOQ, with a strict ₹0 monthly budget and Deepgram credits. Multi-firm/shared-staff work is deferred. See `docs/ZERO_BUDGET_PILOT.md` for the proposed free hosting target and required migration; no cloud deployment is claimed.

The real studio is served locally at `http://127.0.0.1:5178`, using `data/nivo.sqlite`. Its retained Raisina workbook remains byte-identical and all 112 costs are unpriced. A verified consistent pre-restart backup is under `data/backups/phase0-release/`. Audit scripts must only target `data/audit.sqlite`; check HANDOVER.md before switching services or running fixtures. Secrets, databases, call evidence, private screenshots and models remain ignored artifacts.

## Container and server recovery tools

`server/backup.ts` performs validated SQLite snapshots from a read-only source, including live WAL commits. It checks integrity, foreign keys and required tables, stages privately, and refuses to overwrite a destination or its SQLite sidecars. `scripts/backup-server.ts` and `scripts/restore-server.ts` expose this as operator CLI tools included in the production app image. `server/tests/backup.test.ts` covers all seven server tables, exact file bytes, live-WAL consistency, invalid sources and overwrite refusal. Use `docs/BACKUP_AND_RECOVERY.md` for commands and a deliberate switch to a recovered database; no recovery is automatically applied to the live studio.

`scripts/smoke-container.mjs` checks the app image on an isolated network and anonymous volume. `scripts/smoke-worker-container.mjs` checks the worker's non-root cache/spool writes and Python suite. `agent/Dockerfile` pre-creates and owns `/home/worker/.cache` so a fresh Compose model-cache volume is writable. Both images and actual local speech models passed on Linux ARM64 through Colima; this does not establish public deployment or multi-architecture support.

## Zero-budget Technosmart pilot

The user selected one-company/one-operator testing and no recurring spend. Netlify Free + Supabase Free is the proposed hosted target; the current SQLite API still needs adaptation, so existing cloud accounts do not make this a configured deployment. `docs/ZERO_BUDGET_PILOT.md` records verified plan limits and LLM credit/free-tier options.

The active pilot uses Deepgram Nova-3 English STT, Deepgram Flux Meena Indian English TTS (`flux-meena-en`) and local Ollama `qwen3:4b-instruct` for conversation/extraction. Groq is inactive. The user's ignored `.env` selects these providers; private previous settings are in `data/config-backups/before-indian-voice.env`. Deepgram consumes the user's credits; balance is not verified. This is the LiveKit plugin pipeline, not Deepgram's managed Voice Agent API.

LiveKit Python packages are pinned to 1.8.2 for `deepgram.TTSv2`, required by Flux's distinct `/v2/speak` protocol. Aura models still use `deepgram.TTS`. Provider plugins register on the main thread before model construction runs in a background thread; a fresh-process regression covers the startup failure found live. Turn handling explicitly selects local VAD for endpointing and interruptions, avoiding the SDK's automatic LiveKit Cloud interruption service.

A synthetic live conversation passed with five transcript turns, 51.5 seconds of received audio and a validated ₹125/m excluding-GST draft requiring review. The model nevertheless ended after the quote without completing its questions: this smoke pass does not establish conversation quality. Following the VAD configuration fix, Chrome microphone, disclosure/transcript, mute/unmute and end-call checks passed with no cloud interruption request. Seven Python tests and dependency consistency pass. Existing container images predate this upgrade and must be rebuilt before deployment. No telephone was dialled and no real BOQ price was changed. Indian English is configured; Hindi/Hinglish remains untested.

## Model evaluation and credential verification

`docs/MODEL_EVALUATION.md` records the measured local Qwen 4B latency and accuracy limits. `scripts/benchmark-model.ts` uses the actual voice instructions and extraction validator with synthetic inputs, rejects remote endpoints and saves private local results. `scripts/check-provider-keys.mjs` makes read-only provider metadata requests and never prints keys or generates audio/completions.

The user's Deepgram and Groq keys authenticate. Deepgram speech now works live; remaining credit/quota availability is unverified. Groq inference is untested and inactive, and Gemini remains unconfigured. The user selected Ollama plus Deepgram for the current listening test. Gemini free-tier Flash/Flash-Lite and Deepgram managed Voice Agent remain possible later comparisons. Local text generation is fast on the tested Mac, but premature end-call tool selection and missed/invalid extraction make unattended use unsuitable without further work.

## Excel preview and brand/vendor offers (23 September 2026)

`src/components/ExportDialog.tsx` replaces immediate downloads. `src/lib/boq-export.ts` prepares the workbook once; the paginated, sheet-selectable preview and download use that prepared artifact. Async results are discarded after option/project changes or closure. Preview includes hidden-sheet labels, horizontal merged headings, row/column references and error states. It previews cell contents, not an exact Excel renderer: original formulas display expressions instead of stale cached totals; drawings and full source styling are retained in the download but not rendered in the preview.

- New client/internal workbooks support selling rates only or rates plus amounts, fixed values or amount/total formulas, simple formatting or minimal styling, and optional general notes (off by default). They always export all project items, regardless of workbench filters. Generated formulas use rounded selling rates and cached results; RO, unknown and unpriced amounts remain blank. Partial totals and unreviewed/unapproved workbooks are explicitly draft. No export changes saved pricing or approval.
- Simple formatting adds quiet header/alternate-row fills, wrapped specifications, row heights, number formats, frozen/filterable headings and landscape print settings. New client workbooks contain selected brand/model in the specification; supplier identities, purchase costs and original sheets are excluded. Internal output adds supplier, brand/model and purchase costs. User-entered specification/general-notes content still needs ordinary review before sharing.
- Original mode preserves all source ZIP members except patched worksheet/workbook recalculation settings. Options fill rates only (existing amounts unchanged) or rates plus non-formula amounts. Original amount formulas are retained, not evaluated. Unpriced source rates are preserved as unconfirmed evidence. An acknowledgement covers retained private/hidden sheets. Original layout has no automatic client-safety guarantee.
- Import optionally maps brand/model columns. Original export fills those mapped product cells as escaped literal strings for priced rows; formula-backed rate/product cells are refused. Duplicate column mappings are refused. If a chosen brand/model has no mapped column, the UI explains that original export cannot include it and recommends the new client quotation. It never silently adds a supplier column to a client's source workbook.

`ItemForm` accepts brand, model and an optional cost vendor for manual estimates. `RateForm` records quoted brand/model and requires a vendor when source type is Vendor quote; manual estimates remain possible without a vendor. Saving a new offer never silently prices the BOQ. The BOQ rate picker searches offers by brand/model/vendor, shows unit and selling prices and warns about substitutions. Selection updates the full offer identity and requires renewed review. Editing cost/product/vendor/quantity detaches quotation evidence; an unchanged selection or markup-only edit retains it. Historical quotes remain in the library. `withOfferIdentity` derives missing identity fields from unchanged legacy rate-linked costs for display/briefs without automatically writing/migrating the saved workspace.

BOQ desktop/mobile rows, rate library/details, enquiry briefs and voice draft review show product identity. Enquiry quote links append alternatives instead of replacing the prior offer for an item. The voice brief exposes brand/model but excludes sourcing costs and supplier IDs. Extraction accepts separate offers per item, rejects exact duplicate drafts, retains model and still enforces exact vendor evidence and explicit human review. This is schema/pipeline support; no new live multi-brand speech accuracy benchmark is claimed. Workspace backups retain the optional fields without a version change.

Validation for this upgrade: **29 domain tests, 27 backend tests and 19 permanent browser tests passed**. The browser suite opens actual generated XLSX files, checks formula results/privacy, brand switching and source detachment, supplier-required quotations, repeated enquiry offers, server draft review, persistence and mobile previews. Desktop/phone screenshots were inspected. Real studio verification confirmed all 112 costs still null, byte-identical source and preview of all five Raisina sheets, with no workspace changes. Python/voice results remain the prior seven-test/Deepgram checkpoint. The frozen Phase 0 inventory remains historical; later UI labels/options are described here rather than rewriting that evidence.

## Vendor quotation documents (24 September 2026)

`VendorDocumentDialog.tsx` is shared by BOQ workbench, Rate library and enquiry detail. It reads `.xlsx`/selectable-text `.pdf`, previews source rows, proposes a header/column mapping and extracts offers. Required description/unit/rate columns must be distinct. Quantity/amount/MRP are not suggested as rate columns; ambiguous numbers remain blank. Cached Excel formulas are flagged. PDF.js 6.3.289 and its worker load from local assets only when needed; production CSP is exercised by a real built-app test.

`src/lib/vendor-document.ts` owns parsing, column alignment, source evidence, conservative word-overlap suggestions, unit/brand/model/dimension/installation warnings and reviewed cost calculation. Matching never selects or applies an item automatically. Confirm tax-exclusive versus inclusive GST, discount, pack conversion, product specification and commercial conditions, then acknowledge review. Any review-field change clears the acknowledgement. Each row is saved separately with dates, location, vendor and original evidence. Enquiry imports lock project/vendor, restrict items and only mark Quote received once all requested items have offers. BOQ application is separate and the explicitly matched item receives priority in rate suggestions.

`Rate.document` is an optional backward-compatible provenance record: content-addressed file ID, filename/SHA-256, sheet-row or page-line address, extracted excerpt, matched project/item, quoted description/unit/rate, tax basis, GST, discount and units per quoted unit. The saved cost is rounded INR per BOQ unit excluding GST. Conversion is `quotedRate * (1-discount/100) / (inclusive ? 1+gst/100 : 1) / unitsPerQuote`; unknown basis, invalid inputs or nonfinite result refuse save. Adjusted fields remain auditable against the original excerpt/file. Identical vendor/hash/location/project/item imports are blocked; alternative source rows/brands remain separate offers.

`src/lib/document-storage.ts` retains original bytes under `quote-<sha256>` using IndexedDB or authenticated `/api/files`. Downloads verify the stored hash. The existing 10 MB per-upload and 200 MB per-studio limits apply; the API accepts XLSX ZIP or PDF signatures and keeps ownership/CSRF checks. This is signature screening, not full server document validation. No new database migration or external service is required. `backup.ts` deduplicates all project and quotation file references into v1 backups, refuses missing sources and checks quotation hashes during restore; legacy complete backups remain compatible. Rate-library detail exposes source downloads; BOQ picker shows imported provenance. Client exports remain fresh selling-price workbooks without private quotations.

Limits: no OCR/image/scanned-PDF extraction, legacy `.xls`, currency conversion, automatic freight/installation inclusion, semantic-equivalence guarantee, automatic bulk approval or paid AI. PDF rows are aligned to selected header X coordinates; wrapped/merged/rotated/non-tabular content may need manual correction or a cleaner source. Page/line references are extraction-order locations, not printed vendor row numbers. Limits are 40 PDF pages, 10,000 text fragments per PDF page, and 10,000 rows/100 columns per Excel sheet. Files are parsed client-side before only confirmed-source bytes are saved; there is no persistent unreviewed import draft. Tests use synthetic vendor files, not a claimed real-vendor accuracy benchmark.

Coverage: `tests/vendor-document.test.ts` tests rate/amount separation, ambiguous numbers, PDF alignment, mismatch warnings, GST/discount/pack conversion, provenance validation and backup integrity. `tests/e2e/vendor-document.spec.ts` covers review gates, separate BOQ application, duplicate refusal, exact original downloads/backups/restoration, phone PDF import, scanned-PDF refusal and enquiry partial replies. `production.spec.ts` exercises the local PDF worker under production CSP and authenticated source/rate persistence. Backend file tests include PDF CSRF and cross-account refusal. `docs/LOCAL_STUDIO.md` contains the operator walkthrough.

## First-login platform walkthrough (24 September 2026)

`src/lib/walkthrough.ts` contains **53 feature topics in 10 chapters**, spanning navigation/search, overview, projects, BOQ editing/cost components/markup/quantity bases/review/deletion, client XLSX import, vendor PDF/XLSX mapping and review, every Excel export option, rate evidence, vendors, enquiry preparation/responses, browser/phone voice/transcripts/drafts, settings, recovery, privacy and help. Keep these explanations aligned with actual controls whenever features change. Topics inside forms are explained at the feature's entry control; the tour does not open forms, simulate calls or perform actions.

`src/components/Walkthrough.tsx` is a native modal dialog with an SVG spotlight and positioned explanation card. It navigates actual pages, highlights visible feature controls and supports Next, Back, Skip tour, Escape and a chapter-grouped Jump to feature selector. Missing project/data controls fall back to the page with an explicit availability explanation; empty studios can read all topics. A phone layout keeps the card below the visible target with contained scrolling. Resize/scroll updates reposition the spotlight; focus is contained and returned to Help on closing. Background controls and Ctrl/⌘ K are unavailable while touring. The original route is restored on exit; no workspace edits, uploads or calls are performed. Existing inline form hints remain available during normal use.

`App.tsx` checks for first display after authenticated studio entry and exposes **Help & walkthrough** in the top bar on every page (an information icon on phones). Local demo never auto-starts because there is no login; Help still works. Replay is always explicit and starts from the beginning, with direct feature jumps available.

Persistence uses additive SQLite table `onboarding(user_id PRIMARY KEY REFERENCES users, status, updated)`, separate from workspace data and revisions. Authenticated, CSRF-protected `POST /api/onboarding` accepts only `start`, `skipped`, `completed`. `start` atomically inserts `seen` once and returns `showTour`; only one competing tab receives true. Thus reload, interrupted tours, later logins and another device do not force a repeat. Existing accounts see it on their first studio entry after this upgrade. The in-flight browser claim is shared across StrictMode effect replay. Status failures surface feedback and do not block manual Help. No reset endpoint, telemetry or external tour dependency is added.

Workspace JSON backups/restores/reset do not change account onboarding memory. Full SQLite snapshots preserve the new table automatically; pre-tour databases gain it on startup without changing existing records. Backup validation continues accepting legacy seven-table databases. `server/tests/onboarding.test.ts` covers auth/CSRF, invalid actions, tenant scoping, concurrent claims, later sessions, unchanged workspace revisions and additive migration. Recovery tests now verify onboarding status survives snapshots/restoration.

`tests/e2e/onboarding.spec.ts` exercises every topic, route changes, spotlight, first-login Skip and cross-browser persistence, completion, keyboard focus, Escape, empty phone studios and interrupted tours, with no workspace/file/call mutation. Production CSP/login tests now explicitly skip the initial tour; unrelated studio regressions use a completed fixture account. Read-only `scripts/verify-local-studio.mjs` suppresses only the onboarding claim so it does not consume the real owner's first display; the dedicated synthetic voice smoke does the same. Neither script is an onboarding test. The frozen historical audit inventory is unchanged.
