# Nivo: complete codebase reference

Updated 23 September 2026 after the continuation and live voice validation. **Read the newest checkpoint at the top of HANDOVER.md for test results, running processes and remaining work.** This file explains the product and codebase; the handover records the active session. Never infer production readiness from implemented source code.

## Product and scope

Nivo (nee-vo) is Technosmart Interiors' BOQ estimating and vendor quotation workspace for Indian interior/turnkey projects. Users create BOQs or receive client Excel workbooks, obtain prices from vendors/past projects/online references, review pricing evidence, calculate costs/selling prices and issue quotations. The new voice workflow requests vendor quotations through a self-hosted LiveKit agent. Human review separates transcript extraction from accepted rate evidence and BOQ application. Nivo never places purchase orders or invents live market prices.

Root: `/Users/dk/Desktop/DEV/TSInteriors/nivo`. Siblings `TSInteriors`, `LayoutEngine` and `TSInteriorsReel` are independent projects; do not modify them or read/reuse their secrets. Echo at `/Users/dk/Desktop/DEV/Comsync/Repositories/Echo` was an architectural reference for agents only, not a dependency or source of customer data/credentials. The Nivo name has not undergone trademark clearance.

Two operating modes now exist:

- Local demo: browser localStorage workspace, IndexedDB original workbooks, illustrative seed data; no authentication or calling.
- Signed-in studio: same-origin authenticated Node API, private SQLite workspace/file/call persistence, revision conflict protection, enquiry voice controls. One account owns one isolated studio. Shared staff roles and self-service account administration are not implemented.

The backend, standalone local audio, synthetic English WebRTC quotation conversation and real local-model extraction have passed. The final full voice smoke exited 0 with four transcript turns, 49.5 seconds of received audio and an unverified ₹125/m tax-exclusive draft. Chrome also passed real browser connection, received disclosure transcript, mute/unmute and end-call checks with a synthetic microphone. **Check HANDOVER.md for outstanding public deployment/PSTN/Hindi validation.** Telephone calls require a SIP carrier and are disabled by default. No paid infrastructure was provisioned or real vendor contacted during development.

## Architecture

React19/TypeScript/Vite frontend, plain CSS, Motion, self-hosted Manrope, original SVG brand/icons, lazy ExcelJS and LiveKit browser SDK. Fastify API uses Node's built-in SQLite module, native scrypt/session cryptography, private workbook BLOBs, call snapshots and audit events. Python LiveKit Agents1.6.5 worker uses STT→LLM→TTS, Silero VAD, optional DPDFNet and signed callbacks. Linux deployment separates app, LiveKit, Redis, worker, Caddy and opt-in SIP.

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

Items retain description/specification/category/unit, nullable quantity, nullable cost, source rate link and review state. New fields: quantityKind measured/rate-only/unknown; reference; section; source-row context; sourceRate; assembly material/labour/other/adjustment; markupOverride. Original numeric zero source rates are treated as placeholders during import; manually entered zero costs remain intentional zero.

- Null cost is unpriced, distinct from zero. Null quantity is RO or unresolved, never silently zero.
- RO keeps a selling unit rate and no line amount. Unknown quantity also has no amount and blocks approval.
- Assembly cost = round((material+labour+other)×(1+adjustment/100)). Adjustment is generic, not automatically called wastage.
- Selling rate = round(cost×(1+(item markup override or project markup)/100)). Markup is on cost, not gross margin.
- Measured line amount = round(quantity×rounded selling rate). Subtotal sums lines; project GST applies to subtotal. Mixed GST and accounting input-tax treatment are not modeled.
- Applying a quote clears review and assembly. Editing costs/specifications/quantity/pricing reopens Draft. Review/approval requires priced lines, no unresolved quantities and no expired linked evidence.
- Rate candidates use category/unit filters and token overlap, not semantic AI matching. Explicit confirmation still required.
- Rates record description/specification/unit/cost/vendor/source/reference/date/validity/location/terms. Online/manual sources are user-entered, not live web retrieval.
- Enquiries link one project/vendor and selected items. Captured quotes enter the library and are applied separately. Model drafts never change prices automatically.

## Workbook behavior

XLSX max10MB,10,000rows/100columns per sheet. Explicit sheet/header/description/quantity/unit/reference/spec/rate/amount mapping. Source purchase costs opt-in; nonzero original rates remain source evidence regardless of import choice. Sections and non-priced text rows are retained conservatively as context; this is heuristic, not exact semantic hierarchy. Review relevance before sending a vendor brief. Notes worksheets become project generalNotes.

RO values and blank/invalid quantities are retained. Merged quantity continuation rows attach their descriptions to the anchor item instead of becoming duplicate prices. Original row and reference remain traceable. Rich text/cached formula results work; ExcelJS does not recalculate formulas.

Three exports:

1. **Client quotation**: newly generated workbook with selling rates, specifications and totals; no purchase costs or private original sheets.
2. **Internal costing workbook**: clean workbook with costs and selling prices, explicitly internal.
3. **Original internal workbook**: direct ZIP/XML patch of mapped cells, leaves unrelated entries intact, preserves client formulas and requests Excel recalculation. Contains ALL original sheets and may expose private costing/discounts/margins. Never present it as automatically client-safe.

Structural item edits/deletions disable original mapping; new unsourced lines reject original export. Unpriced lines retain their original source cells, including existing rates, as unconfirmed source evidence. Priced rate cells containing formulas reject the export with the cell address instead of silently skipping a price. Amount formulas remain intact and request Excel recalculation. Clean exports still leave unpriced rates blank. Validate output in Excel before issue. This is not a guarantee for every OOXML extension, malformed archive or Excel feature.

The private Raisina workbook has now been copied into the persistent local studio: five sheets,112unique items (86measured,25RO,1unknown),four nonzero rates retained only as source evidence, merged warranty note retained. All112 costs remain null. The unresolved quantity is the managed-switch item at source row188. The original Downloads file is unchanged, and the stored workbook hash matches the prepared original. Client/location/due date are blank pending confirmation; markup20% and GST18% are reviewable defaults. The BOQ displays original item references and directs users to inherited specification context. Client data and screenshots remain ignored, not Git fixtures.

## Backend and voice contract

SQLite tables: users, sessions, workspaces, files, calls, events, audit. Passwords are salted scrypt hashes; raw session tokens only in HttpOnly cookies, hashes in DB. Sessions expire after7days. Mutation requests require custom same-origin request header and matching Origin when present. Rate limits and request size limits apply. All user-accessible workspace/file/call queries are scoped by authenticated account. Workspace PUT uses compare-and-swap revision and returns409 rather than overwriting another editor. Failed sync freezes automatic writes and keeps pending state exportable.

API endpoints: health/session/login/logout; GET/PUT workspace; GET/PUT files/:id; voice/status; calls list/detail/create/end/extract; signed agent brief fetch and event delivery. Call setup uses immutable saved brief, server-selected vendor number and named dispatch `nivo-quotes`. Phone mode requires flag, trunk, international number and explicit UI confirmation. One active call per studio; idempotent request IDs. Browser token is short-lived and room-scoped. Room metadata carries only call UUID. Agent fetches full brief over signed API, without internal prices or provider secrets.

Callback HMAC signs timestamp plus exact JSON envelope payload, checks a five-minute window and event ID replay. Terminal calls cannot be reopened by a late event; shorter transcript snapshots do not replace longer ones. Call creation rechecks idempotence after asynchronous worker health probing. Cancellation during setup deletes any subsequently created room without reopening terminal state. Missing rooms count as already ended. Watchdog cleanup failures remain visibly pending and retry; failed cleanup is not reported as success. Malformed signed null events return400. Worker has duration and inactivity bounds, opt-out/end-call tool, transcripts and no purchases/transfers. The browser cancels setup on unmount and wraps call controls on phones; enquiries above20 items show the voice limit. Do not rely on prompt instructions alone as a regulatory or accuracy guarantee.

Extraction uses server-configured compatible chat endpoint. Validated drafts must reference known items, finite nonnegative costs, explicit/unknown tax basis and a verbatim vendor transcript excerpt. A conservative English tax-phrase check downgrades unsupported or conflicting model tax classifications to unknown; observed “GSD” STT text must not silently become “GST”. This checks provenance, not semantic correctness or negation in arbitrary language. Human verifies specification, quoted unit, amount, tax, scope and validity in RateForm. Tax-inclusive/unknown amounts and mismatched units do not prefill ex-GST costs. Evidence and terms survive review/save. No raw recording by default. Transcript callback failures spool privately using atomic completed-file publication and retry; concurrent deletion by another delivery/replay no longer fails a new conversation. The Python smoke explicitly releases audio streams and garbage-collects native callback cycles before SDK shutdown.

## Design and accessibility

Architectural precision desk: ink#183247, canvas#edf0f2, paper#f6f7f5, blue#315bdb, muted#667985, borders#d6dfe4. Manrope and tabular money. Crisp0–2px corners, original icons/logo/plan drawings. No UI kit/Lucide, gradients, shadows, pure-white backgrounds, glass, neon, purple/black theme, decorative bento/radial/dot treatments, sparkle/checkmark marketing, fake testimonials or feature-card trios. Follow user's reel screenshot, not generic SaaS defaults. Official Anthropic frontend-design guidance was read for original v1; image generation is unnecessary for native SVG assets.

Motion is brief page opacity, dialogs and action feedback; skeleton only while loading. Reduced-motion honored. No decorative hover motion. Native dialogs trap focus/Escape and restore focus; mobile nav is inert when closed and traps focus while open. Phone BOQs have dedicated item layout below600px. Tables contain their own overflow. Touch inputs16px and readable focus labels. Automated Chromium320/390/768/1024/1440 checks are not claims of physical iOS/Android compatibility.

## Delivery limits and next decisions

Free local browser testing is possible on existing hardware; phone carrier minutes and reliable public capacity are not promised free. Oracle availability/reclamation and Render ephemeral/sleep limits matter; use the sourced hosting guide. Linux Compose/HTTPS/TURN/SIP must be validated on the actual host. No account was provisioned externally.

No staff roles, password-reset email, commercial billing, background campaign dialer, automatic web-rate search, model accuracy guarantee, or fully semantic workbook recognition. English Piper baseline does not establish Indian language readiness. Studio reset does not delete stored calls/audit/orphan files. JSON backup excludes server account/call history; consistent server backup covers SQLite. Define retention, account deletion and operator recovery before broader external use. Legal/policy copy is beta disclosure, not a compliance certification.

Run appropriate domain/backend/browser/audio checks after changes, inspect screenshots, and keep HANDOVER.md truthful about actual live validation. Never replace missing providers with simulated successful calls or quotations.
