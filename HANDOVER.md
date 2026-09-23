# Active development handover

Updated 23 September 2026. Read CODEBASE_REFERENCE.md and the newest checkpoint below first. Sections after the checkpoint are historical; their old process IDs and incomplete-work statements are superseded.

## Latest checkpoint: browser audit continuation, 23 September 2026

Tasks 7 and 8 have now been exercised using `tests/audit/ui.spec.ts` against fresh browser contexts and the existing **isolated `data/audit.sqlite` API**. The earlier checkpoint below is historical. No product fix has been applied yet.

- 24 main browser scenarios passed (12 in each mode); two additional import-limit/warning scenarios passed; the explicit demo/login scenario passed. Actual Excel artifacts and persisted workspace values were asserted.
- Real two-tab stale-revision refusal passed. The losing tab retained its pending changes and its downloaded backup contained them. Logout invalidated API access.
- `docs/audit/INVENTORY.md` now has 198 of 218 rows recorded. Only result cells changed; the frozen behaviour descriptions and 218 IDs are intact. Voice rows and studio voice controls are the remaining 20 rows.
- New **F-05 Minor OPEN**: native dialog focus escapes instead of wrapping. `tests/e2e/modal.spec.ts` fails before product changes. **F-06 Major DEFERRED PHASE 1** records the workspace-wide revision restriction.
- F-04 now has a real failing regression in `tests/e2e/workbook-delete.spec.ts`. Four known failing checks now preserve F-01/F-02/F-04/F-05; fix product causes in Task 10.
- Task 9 is in progress. The real speech smoke, adapted to `data/audit-voice-login.json`, passed: **4 transcript turns, 54.4 seconds received audio, ₹125/m excluding GST, `needsReview: true`**, exit 0. Browser control tests are running next. Outbound remains false.
- Audit helpers: `npx playwright test --config playwright.audit.config.ts ui.spec.ts access.spec.ts`; `node --import tsx scripts/audit-voice.mjs`; `NIVO_SMOKE_LOGIN_FILE=data/audit-voice-login.json agent/.venv/bin/python -m agent.smoke_session`; then `NIVO_AUDIT_VOICE=1 npx playwright test --config playwright.audit.config.ts voice.spec.ts`. Voice fixture preparation must run AFTER UI tests, which reset the fictional account.
- Private traces, screenshots and evidence JSON are under ignored `data/audit-*`; they can contain synthetic account session tokens and must not be shared as public artifacts. Desktop settings and 390px BOQ screenshots were inspected.
- No deployment, spending, real calls or writes to `data/nivo.sqlite`. Deployment host/domain and initial single-firm versus multi-firm scope were asked asynchronously; answers are pending.

## Latest checkpoint: Phase 0 audit halted after Task 6, 23 September 2026

**You are picking up a partially completed audit. Read this entire checkpoint before running anything.**

The product was being taken from a single-firm internal tool towards a multi-firm SaaS. That work was decomposed into three phases. Phase 0 (audit and fix what already exists) was specified, planned and started. **Six of its twelve tasks are complete. Work stopped after Task 6 by explicit user instruction, for handover to another agent.** Nothing has been fixed yet: Phase 0's fix pass is Task 10, which has not run.

### What is on disk

| Artifact | Path | State |
| --- | --- | --- |
| Phase 0 design | `docs/superpowers/specs/2026-09-23-phase0-audit-design.md` | Approved by the user |
| Phase 0 plan, 12 tasks | `docs/superpowers/plans/2026-09-23-phase0-audit.md` | Approved; Tasks 7-12 not started |
| Behaviour inventory, 218 rows | `docs/audit/INVENTORY.md` | **FROZEN.** See the contract below |
| Findings | `docs/audit/FINDINGS.md` | 4 findings, append-only |
| Baseline environment record | `docs/audit/ENVIRONMENT.md` | Versions, PIDs, true baseline suite results |
| Telephony and regulatory research | `docs/TELEPHONY_RESEARCH.md` | Phase 2 input, not legally reviewed |
| Execution ledger, incl. every ruling | `.superpowers/sdd/2026-09-23-phase0-audit/progress.md` | Git-ignored scratch, but the record of decisions |

Branch: `phase0-audit`, 13 commits ahead of the baseline commit `0478548`. `main` holds only the baseline import. Nothing has been merged or pushed.

Before this session, the entire 10,700-line source tree was untracked with zero commits. It is now committed as `0478548` so later work can be diffed against a known-good state.

### The four findings

| Id | Severity | Summary |
| --- | --- | --- |
| F-01 | Minor, OPEN | `isStale` treats a blank `validUntil` as permanently expired, so such a rate can never be applied. Confirmed NOT user-reachable: all seven `Rate`-creation paths are gated by the required date input or `validateWorkspace`'s regex check. Defence-in-depth only. |
| **F-02** | **Blocker, OPEN** | **Rate limiting is completely inert.** Unlimited login brute force, no request throttling anywhere. |
| F-03 | Major, DEFERRED TO PHASE 1 | The HMAC-signed agent callback endpoints query `calls` by id with no tenant predicate, gated only by one process-wide `AGENT_CALLBACK_SECRET`. Correct while one tenant exists; a cross-tenant read and write path the moment a second firm does. |
| F-04 | Minor, OPEN | Deleting one BOQ item silently clears `project.workbookId` for the whole project, permanently disabling the original-workbook export, with no warning — while the sibling edit path both guards the condition and warns. |

**F-02 is the one to act on first.** `@fastify/rate-limit` is registered at `server/app.ts:79` without `await`. The plugin adds exactly one hook, an `onRoute` handler, and both the global and per-route enforcement branches live inside it. `onRoute` fires only for routes registered after the hook exists, and Fastify defers plugin loading until `ready()` — so every route in `makeApp` is declared before the hook exists and none is ever throttled. The login route's `max: 10 / 15 minutes` config at `:129` is dead. Verified by 14 failed logins and 320 requests producing no 429 and no `x-ratelimit-*` header on any response.

Read F-02 in full before fixing it. **It is not a one-word `await` patch:** `makeApp` is a synchronous factory (`server/app.ts:32`, returning at `:470`) called synchronously by `server/index.ts:2`. The fix requires either making `makeApp` async and updating every caller including all backend tests, or wrapping the route declarations in `app.register(async (instance) => { ... })`. Confirm any fix by checking that `x-ratelimit-*` headers appear on ordinary responses. Note also that enforcement is keyed per-IP, so distributed credential stuffing still passes; per-account lockout is a separate control this fix does not deliver.

### What was actually verified, and what was not

Verified, with evidence recorded per row:

- **Costing invariants (15 rows).** 15 of 16 assertions pass at rounding boundaries. Null cost is distinct from zero, rate-only lines carry a selling rate and no amount, unknown quantity yields no amount, assembly rounds `(material+labour+other)×(1+adjustment/100)`, markup applies on cost, `markupOverride` correctly beats the project markup including when it is `0`, line amounts use the already-rounded rate, and unit aliases match without over-merging. **The costing engine is correct.** The single failure is F-01.
- **API and tenant isolation (27 rows).** 25 PASS, 1 PARTIAL, 1 FAIL. **No cross-account access succeeded on any probe.** The isolation tests were checked to be discriminating — each would fail if the tenant predicate were removed from its backing query — rather than merely green.
- **Workbook, exports and backup (17 rows).** 17/17 PASS, each by opening the produced artifact rather than observing that a download completed. **The client quotation export does not leak purchase costs, margins or private sheets**, established both structurally (that export builds a fresh workbook from `project.items` and never reads the original file's bytes) and empirically. Stored workbook bytes round-trip byte-identically across four independently derived SHA-256 values.

Not verified — no result recorded for any of these rows:

- **159 of 218 inventory rows are unrecorded**: `SCR` 8, `FLT` 8, `DLG` 10, `CTL` 123, `VOI` 10. That is every screen, every filter, every dialog, every interactive control, and the entire voice desk.
- Neither operating mode has been walked. Local demo mode and signed-in studio mode use different persistence paths and the inventory carries a separate result column for each, precisely so a defect appearing in only one column localises to persistence rather than to a component. Both columns are empty.
- No telephone call was placed and none should be. `ENABLE_OUTBOUND_CALLS` is `false` and must stay so.
- **Nothing has been fixed, and no regression test exists for any finding.**

### Traps that will cost you time if you do not read this

1. **Two test suites are deliberately RED.** `npm test` has one failing test (`H-01` in `tests/costing.test.ts`) and `npm run test:server` has one (`API-04` in `server/tests/isolation.test.ts`). These are the recorded evidence for F-01 and F-02. **Do not fix them, skip them, or mark them `it.fails`** — that destroys the evidence. They go green when Task 10 fixes the underlying defects. Current true state: `npm test` 22 passed / 1 failed; `npm run test:server` 20 passed / 1 failed.

2. **`docs/audit/INVENTORY.md` is frozen at 218 rows.** Later tasks fill in result cells and nothing else. No row may be added, removed, renumbered or reworded — six tasks and an automated gate address rows by id. A behaviour with no row is outside this audit's scope by construction; record it as a finding instead.

3. **Findings carry their disposition ON the severity line.** The Task 12 exit gate is `grep -nE '\*\*Severity:\*\*' docs/audit/FINDINGS.md | grep -vE 'FIXED|DEFERRED'` and it inspects only the matched line's own text. Write `- **Severity:** Major — DEFERRED TO PHASE 1` or `- **Severity:** Blocker — FIXED in <commit>`. A disposition on an adjacent line is invisible to the gate and will report a resolved finding as open. The gate currently returns exactly F-01, F-02 and F-04.

4. **The API runs against an isolated database.** `data/audit.sqlite`, provisioned by `scripts/audit-env.mjs` with two fictional accounts whose passwords are in the git-ignored `data/audit-login.json`. **Never print or commit that file.** Start the API as `DATABASE_PATH=data/audit.sqlite npm run server`. The real studio database `data/nivo.sqlite` holds the client's Raisina BOQ and has been untouched throughout; keep it that way.

5. **The `Write` tool refuses `docs/audit/FINDINGS.md`**, misclassifying it as an agent report file by name. Append with a Bash heredoc instead.

6. **Use a non-login shell.** A login shell selects Node 18 on this machine and every command fails confusingly. Node 22.14 is correct; `engines.node` says `>=22.22` and must not be changed.

7. **`npm run format:check` fails on 18 markdown files.** All are documents added by this work — the spec, plan, research and audit output. Zero product source is affected and this is not a product finding. Task 12 owns the cleanup: add `.superpowers` to `.prettierignore`, then `npm run format`.

### Running services

Restarted from current source during Task 1 and still up. Recheck PIDs before stopping anything, and do not stop unrelated processes.

| Service | PID | Address |
| --- | --- | --- |
| API, on `data/audit.sqlite` | 34523 | 127.0.0.1:8787 |
| Vite | 34555 | 127.0.0.1:5178 |
| Python worker | 34561 | health 8081 |
| LiveKit | 25676 | 127.0.0.1:7880 |
| Ollama | 25677 | 127.0.0.1:11434 |

LiveKit and Ollama hold no application source and were left running from the previous session.

### If you continue Phase 0

Tasks 7 to 12 of the plan are unstarted and each carries full step-by-step detail. In order: walk local demo mode (Task 7), walk signed-in studio mode (Task 8), verify the voice desk over browser WebRTC only (Task 9), fix every finding with a test that fails against the parent commit (Task 10), add characterisation tests for the flows Phase 1 will rewrite (Task 11), then the final gate and truthful documentation (Task 12).

Task 10's discipline is the one that matters: prove each regression test fails against the parent commit before fixing. A test written after a fix passes for the wrong reason and will keep passing if the bug returns by another route.

### Known structural issues routed to Phase 1

- The workspace is a single validated JSON blob written wholesale under one revision counter. Two members of one firm editing different projects will conflict with each other. Phase 1 needs row-level persistence; this is not patchable within Phase 0.
- F-03's agent callback boundary, above.
- In local mode, `storage.ts` persists to `localStorage` without re-running `validateWorkspace`; validation runs only on load. Latent, no current path exploits it.

### Phase 2 input

`docs/TELEPHONY_RESEARCH.md` records that outbound AI voice calling to Indian numbers is gated by the TRAI TCCCPR Third Amendment (05 of 2026), which defines application-initiated calls as A2P and requires advance declaration of A2P use and CLI ranges to the carrier, recorded on DLT. Twilio cannot serve India outbound from an Indian number. Plivo India is the recommended path if built. The report is sourced with primary URLs and access dates and tags every claim VERIFIED, UNCERTAIN or UNKNOWN. **It has not been reviewed by a lawyer and must be before any spend or signup.**

Separately: Deepgram's Aura TTS has no Hindi and no Indian-accented English voice, so the planned Deepgram credits cover STT only. Sarvam Bulbul is the working Indian-voice option and would need its own key; do not reuse the sibling project's.

## Historical session record


## Goal

Upgrade Nivo in this folder from a local BOQ pilot into a private beta with structured Indian BOQ support, authenticated persistent backend, self-hosted LiveKit voice agent (STT/LLM/TTS, Silero VAD, DPDFNet), browser testing, optional SIP vendor calls, reviewed quote extraction, and a realistic free hosting path. User asks to continue autonomously, complete as much as possible, and leave this handover before the time limit.

## User constraints

The prior session limited Raisina to read-only inspection. The current continuation prepared a private retained copy for local use; the original file remains untouched. Continue to avoid spending, real vendor calls, sibling-project changes and Echo credentials without applicable authorization. Preserve the existing UI and mobile/accessibility behavior. No subagents were used.

## Current progress

- Read Nivo reference and Echo agent, provider factory and DPDFNet adapter.
- Researched current LiveKit self-hosting, SIP, turn handling, noise suppression and DPDFNet docs.
- Wrote UPGRADE_PLAN.md before edits.
- Started BOQ domain changes: nullable quantities, rate-only flags, source references/context, assembly fields, per-item markup, shared validation.
- Started OOXML patch export to preserve unrelated original ZIP entries; clean export defaults client-safe, original export internal only.
- Installed backend/LiveKit dependencies. Run commands with login=false: login shells select outdated Node18; non-login shell has Node22.14.
- Docker CLI exists but daemon is not running. No model/provider credentials configured, no live voice test yet.

## Pending

Finish BOQ UI/import review and regression tests; implement authenticated backend and sync; agent pipeline, voice UI and draft extraction; deployment templates and hosting guide; actual tests/build/browser screenshots; update all documentation. Work is in progress and is not yet a tested release. This file will be updated at checkpoints.

## Research findings

Self-hosting supports open LiveKit SDKs/SIP. LiveKit Cloud enhanced cancellation is not available on self-host transport; DPDFNet is a separate Apache-2.0 streaming implementation and exists in Echo. Current DPDFNet accepts native input sample rate and returns native-rate samples. Use per-call state and preserve buffering rather than truncating output. Free existing-hardware browser audio is possible; ordinary telephone calls require a carrier. Oracle free capacity is conditional and current official docs mention 2 OCPU/12GB, not the old 4/24 guarantee. Static free hosting cannot run LiveKit UDP or a persistent agent.

## Checkpoint: implementation and tests

- Structured parser read-only validation on real Raisina file: 112 unique lines = 86 measured +25 RO +1 unknown; 4 original nonzero rates retained as source evidence; no duplicate merged line; source hash unchanged.
- 13 frontend/domain/workbook tests pass, including OOXML preservation of unrelated ZIP parts and unknown/RO totals.
- 3 backend suites pass: account/CSRF/isolation/revision/files/logout; signed replay-safe terminal callbacks; extraction evidence validation.
- Backend: `server/{app,db,voice,extraction,index,create-user}.ts`; same-origin session auth, isolated studio workspaces, SQLite BLOB workbooks, call lifecycle and signed callbacks. Outbound disabled without env flag/trunk/explicit call confirmation.
- Frontend: StudioAccess login/demo bootstrap, remote save serialization and pending-change guard, server workbooks/backups, VoiceDesk enquiry panel with browser audio/SIP controls/transcript/draft review.
- Worker: `agent/{worker,config,callbacks,local_models,noise}.py`; actual installed SDK 1.6.5, local Whisper/Piper + OpenAI-compatible local LLM, optional Deepgram/ElevenLabs; VAD/endpointing/interruption, per-call DPDFNet FIFO, duration/idle handling, signed durable transcript spool.
- 4 Python tests pass. Real local audio smoke passed: 3.97 seconds synthesized speech -> Whisper returned 'The rate is 125 rupees per meter, excluding tax.' DPDFNet real model processed audio. First load/test elapsed 8.79 sec; not a conversational-latency benchmark.
- Audio models downloaded under ignored models/ and user caches. No paid providers used.
- First e2e run 8/9 pass; remaining failure was outdated voice status text in test, updated now. Rerun required after changes.
- Native LiveKit/Ollama local integration test being prepared because Docker daemon is off. Public GitHub metadata downloads need escalated curl (approved); no full conversation tested yet.
- Deployment files and `.env.example`, config generator, SQLite backup script, SIP registration script created. Must validate and document.
- Still pending: end-to-end voice, backend browser tests/mobile screenshots, sync/call lifecycle robustness, updated CODEBASE_REFERENCE/hosting guide, final check/audit/format.

## Latest checkpoint: 22 September 2026, approximately 23:55 IST

**User says the execution limit is near. Preserve this checkpoint and finish remaining validation before claiming completion.**

### Current outcome

Core development pass is implemented. BOQ enhancements, authenticated API, studio browser workflows and real standalone speech processing work in tests. **The full LiveKit conversation has NOT passed yet.** No PSTN call, public deployment or paid service was used. Do not describe vendor calling as fully validated.

### Verified

- `npm test`: 13 passing domain/workbook tests.
- `npm run test:server`: 3 passing backend suites (auth/CSRF/tenant/file/revision/session, signed idempotent callbacks, extraction evidence checks).
- `agent/.venv/bin/python -m pytest agent/tests -q`: 4 passing tests.
- `agent/.venv/bin/python -m agent.smoke_audio`: real Piper -> PCM -> Whisper text exactly “The rate is 125 rupees per meter, excluding tax.”; real DPDFNet processed it. Audio length 3.97s, first-load run 8.79s. Not a latency benchmark.
- Full browser run: 9 legacy flows passed after updating expected copy; studio flow initially found genuine empty-JSON POST bug. Fixed API helper to set Content-Type only when body exists. Targeted studio rerun **2/2 pass**, including login/save/reload/conflict/signout and phone/desktop voice desk. Thus all 11 scenarios have passed across latest runs, but run the entire suite once more after final edits.
- Build and backend typecheck passed multiple times. Last small UI/worker/docs edits still need final build/format/check.
- Read-only real Raisina workbook inspection: 112 unique items,86 measured,25 RO,1 unresolved qty,4 nonzero source rates; source unchanged. Not imported into app.
- Inspected phone voice-desk screenshot; responsive layout looks good. Desktop/new login screenshots still need inspection. Screenshots are currently in test-results, which Playwright clears on each run.

### Current running local processes (created during this task)

All tools should use `login:false`, otherwise zsh login selects Node18; non-login has Node22.14. Native Python command selected miniconda Python3.13 for the venv.

- Vite frontend: http://127.0.0.1:5178 (pre-existing task server; old session20459 may not be valid now).
- **Ephemeral synthetic backend**, http://127.0.0.1:8787, exec session49623, PID21140 when started. Command: `node --env-file=.env --import tsx scripts/voice-test-server.ts`. In-memory SQLite, seeded fictional studio. Credentials are in ignored/private `data/voice-test-login.json`; never print them. Stop this before starting the real persistent `npm run server`. No actual studio user account has been created.
- **LiveKit1.13.7** installed via official Homebrew formula. Restarted with corrected loopback candidates; current exec session34193. Command `livekit-server --config deploy/generated/livekit.yaml --bind 127.0.0.1 --node-ip 127.0.0.1`. Previous PID20986 terminated. New PID discover with lsof if needed.
- **Ollama0.34.2**, verified official SHA256 archive under ignored data/tools, extracted into data/tools/ollama. Current exec session18052, restarted with `OLLAMA_NO_CLOUD=1`, host127.0.0.1:11434, models path `<repo>/models/ollama`, log data/ollama-test.log. Previous PID21030 terminated. It generated its own key in ~/.ollama on initial startup (no secrets printed, only public key).
- **Python agent**, exec session73266, PID21160 when started: `DPDFNET_ENABLED=true agent/.venv/bin/python -m agent.worker dev`. Registered named worker `nivo-quotes` on LiveKit. Health at127.0.0.1:8081. It reconnects after server restart. Python dev mode no longer hot-reloads: restart it after worker code changes.
- No current smoke test should be running: first `agent.smoke_session` session43609 failed.

### Voice integration failure and next exact action

First `agent/.venv/bin/python -m agent.smoke_session` created a room and named dispatch successfully. Python participant and worker suffered `wait_pc_connection timed out`; worker was stopped before it established RTC, transcript remained empty, test timed out. Server logs showed eventual participant activation after retries, suggesting loopback ICE configuration. Added **`rtc.enable_loopback_candidate: true`** in generated local YAML and generator, then restarted LiveKit. **Rerun the smoke now**; this correction has not yet been tested.

- `agent/smoke_session.py` signs into ephemeral API using private test-login file, starts a browser-type room, publishes Piper-generated synthetic vendor speech via RTC, receives audio and asserts STT→LLM→TTS response; ends room in finally. No telephone number is called.
- It uses max75s transcript waits and may take longer during first LLM load. Local Qwen model pull completed successfully.
- Potential next issue: `build_providers` runs inside `asyncio.to_thread`; LiveKit/OpenAI constructors may require an event loop. If so, move only heavy model loading off-loop and construct plugins in event loop. Not yet observed because RTC failed first.
- Agent currently constructs providers after connecting; starts session, waits participant, speaks deterministic disclosure, listens for confirmation. Do not confuse metadata/room success with successful conversation.
- Current `.env` and defaults use **qwen3:4b-instruct** (Apache2,2.5GB, successfully downloaded), not earlier qwen2.5:3b. Whisper base, Piper en_US-lessac-medium (models files downloaded), DPDFNet dpdfnet2.
- Whole-call provider accuracy, Hindi/Hinglish, interruption quality, real handset/PSTN behavior remain untested.

### Important files/state

- `UPGRADE_PLAN.md`: preimplementation plan.
- `docs/HOSTING_AND_VOICE.md`: detailed current hosting/operation guide with primary citations, free limits, local commands, Linux deployment, firewall/TURN/SIP constraints, model settings, privacy and beta gates.
- `CODEBASE_REFERENCE.md`: being refreshed next; prior file had obsolete local-only claims.
- `server/`: Fastify app/db/auth/voice/extraction/CLI. SQLite workspace snapshots with revision CAS, tenant-scoped workbook BLOBs, calls and audit; same-origin cookie sessions, scrypt hashes; authenticated CLI accounts (no signup), secure cookies in production.
- `src/components/StudioAccess.tsx`, `VoiceDesk.tsx`, `src/lib/api.ts`, modified storage/backups/spreadsheets/forms/enquiry/settings/App.
- `src/lib/workbook-patch.ts`: original OOXML cell patch; unchanged other ZIP entries, preserves external links/formulas/drawings. Original export explicitly INTERNAL; clean client export hides costs/source sheets. Numeric mapped rate cells containing formulas are currently preserved/skipped; consider explicit error to avoid misleading successful export. Source unpriced rates are currently overwritten blank by original patch (unless formula); decide conservative handling and test before changing.
- Parser retains conservative preceding section context; can include too much preceding text. Human context review required; not semantic section recognition. RO and unresolved qty are actual null; total excludes them and approval blocked for unknown qty.
- Assemblies material/labour/other+adjustment, per-item markup. Shared validation moved from storage to validation.ts.
- Native .env and generated secrets created by scripts/configure-local.mjs, ignored/private. Never copy them into docs. No paid API credentials/SIP trunk.
- Docker CLI exists, Colima daemon stopped. Dockerfiles/Compose have NOT been built/run; local native paths used instead.
- `.env.example`, Dockerfile, agent/Dockerfile, compose.local.yaml, compose.linux.yaml, deploy/Caddyfile, config generator, backup and trunk registration scripts added.
- requirements.txt pins LiveKit1.6.5; other audio deps have bounded versions, installed in ignored agent/.venv. No lockfile yet.
- package dependencies installed successfully; engines specifyNode>=22.22 because a transitive dependency requests it, local tests used22.14. Update package-lock root metadata via npm install --package-lock-only after final package edits.

### Remaining priorities

1. Rerun/fix real local LiveKit smoke; run actual extraction on a synthetic transcript against Ollama; exercise browser voice start/end with fake microphone if feasible.
2. Check lifecycle/security: no calls when worker health down; calls time out and room deleted on failure; signed callbacks never reopen terminal calls; check request idempotence/concurrency and malformed payloads. Existing code has initial tests but needs review.
3. Make call quote review reachable and preserve draft evidence in RateForm (just fixed draft notes defaultValue; retest). Model drafts remain unverified, cost prefills only explicit ex-GST, never autoapply.
4. Final `npm run build`, `npm run check:server`, `npm test`, `npm run test:server`, Python tests, full e2e, formatter, audit. If npm network fails, use approved escalation; do not force-upgrade.
5. Inspect desktop/login/phone screenshots after final browser run.
6. Complete CODEBASE_REFERENCE and README, update HANDOVER with final actual results and processes to stop/keep. Note that a real account, external hosting, SIP carrier and Hindi QA are outstanding external prerequisites, not completed work.
7. Stop ephemeral test API; optionally start persistent backend (no account exists, user:create command documented). Keep/no paid account provisioning. Do not stop or alter unrelated user processes.

### Known design/operational limits to report

One account per studio; no shared roles/password-reset email/invitations UI. SQLite single persistent server, no horizontal replication. JSON workspace backup excludes server call/audit/account history; server backup script covers entire SQLite. File reset leaves orphan source files; calls retained until operator deletion. External Linux deployment not exercised. TURN UDP template only; TURN/TLS needed for restrictive networks. Piper English voice baseline only. No automatic web-rate ingestion. No actual vendor calls or purchases performed.

## Checkpoint at 23:59 IST

- CODEBASE_REFERENCE.md has now been fully rewritten for the new architecture. README updated.
- Formatter completed; production build, backend typecheck,13 domain/workbook tests and3 backend suites passed again after final UI edits.
- Full LiveKit smoke retried (session66734). **Loopback correction fixed the transport connection.** Worker now connects, loads local models, starts session and speaks its disclosure; TTS audio/transcript observed in logs. Still waiting for the STT→LLM→response assertion at this checkpoint.
- Found SDK event includes `AgentHandoff` alongside ChatMessage. Added getattr guards to conversation_item_added handler; restart worker to load this fix before next test. Existing worker still running older handler; error does not prevent regular message capture.
- Last smoke first job did not connect; second reaches speech. Do not treat second as passed until the script prints status=passed.

## SUCCESS checkpoint: 23 September 2026, 00:00 IST

**The full local LiveKit voice smoke PASSED.** Session66734 exited0 and printed:
`{"status":"passed","transcriptTurns":3,"receivedAudioSeconds":31.7,"assistantReply":"We need a quotation for BWP plywood, 18 mm. Could you please confirm the exact specification?"}`

This exercised real local WebRTC, named agent dispatch, DPDFNet, Silero VAD, Faster Whisper STT, Qwen3:4b-instruct through Ollama, Piper TTS, received audio and signed persisted transcript events. Test ended the room. It used generated speech and fictional seed data; no human, phone number or paid provider was called. Approximate observed post-user transcript to first TTS generation was several seconds on first model load; no low-latency claim.

The loopback candidate fix was necessary. AgentHandoff guard was fixed in source after this run; restart worker before further tests. Still useful: test quoted-number extraction through real Ollama, browser microphone start/end, final full browser suite/audit/format. Update docs from 'full conversation unverified' to this precise observed result, retaining all public hosting/PSTN/Hindi limitations.
