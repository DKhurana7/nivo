# Active development handover

Updated 23 September 2026. Read CODEBASE_REFERENCE.md and the newest checkpoint below first. Sections after the checkpoint are historical; their old process IDs and incomplete-work statements are superseded.

## Latest checkpoint: continuation completed, 23 September 2026

The local private-beta continuation is complete. Persistent BOQ workflows and local browser voice have been exercised. This is **not a validated public/PSTN/Hindi deployment**.

### Current local studio

- Open `http://127.0.0.1:5178`, sign in as `owner@nivo.local`. Generated password is only in private ignored `data/local-studio-login.json`; never print or commit it. No external account/email was created.
- Persistent API now runs `npm run server` on8787, using `data/nivo.sqlite`. The ephemeral synthetic API has been stopped. Do not restart `scripts/voice-test-server.ts` over the persistent API.
- The user's request to make this BOQ usable was implemented as a private retained copy:112 electrical items,86 measured,25 rate-only,1 unknown quantity, all unpriced. Four original nonzero rates remain source evidence, not costs. No actual vendors or enquiries were invented.
- Original Downloads workbook is unchanged; authenticated file download hash equals the prepared source. Unknown quantity: managed switch at BOQ row188. Client/location/deadline remain blank. Confirm markup20% and GST18% before use.
- Private restorable package: `data/raisina/prepared/workspace.nivo.json`; source mapping and readiness details: `data/raisina/config.json`, `data/raisina/prepared/readiness.json`. SQLite backup created under `data/backups/`.
- See `docs/LOCAL_STUDIO.md` for startup and exact workflow. Add a vendor, select up to20 items per enquiry, and use Test in browser. Phone calling remains disabled without a carrier.

### Verified during this continuation

- `npm run build`, `npm run check:server`, `npm run format:check` pass on the final source. Server typecheck now covers every TypeScript operator script. The final full browser rerun is12/12 passing.
  -14 domain/workbook tests;4 backend suites;6 Python tests;12 browser scenarios pass.
- Full real local voice smoke exits0: four transcript turns,49.5 seconds received audio, spoken ₹125/m quotation extracted with `basis=excluding-gst`, `needsReview=true`. Used LiveKit, DPDFNet/Silero, Whisper, Ollama/Qwen and Piper with synthetic English speech. No phone number called.
- Real text extraction smoke also passes against Ollama.
- Real Chrome browser voice check passes using synthetic microphone: connect, receive disclosure transcript, mute, unmute, end; phone dialog overflow assertion passes. Screenshots inspected at desktop and390px.
- Persistent Raisina studio browser check passes: login,112 unpriced items, retained source hash, reload and phone layout. Desktop/phone screenshots inspected under ignored `data/verification/`.
- `npm audit --omit=dev` reports0 vulnerabilities; package-lock refresh also reported0. Both local/Linux Compose configurations parse successfully with `docker compose ... config --quiet`; images/public deployment were **not** built or run.
- Local Node is22.14; prefer22.22+ for fresh installs. Existing dependency-engine and lazy ExcelJS/LiveKit bundle-size warnings remain, not hidden.

### Fixes completed

- Original export keeps unpriced source cells and rejects formula-based priced rate anchors rather than silently ignoring entered prices. Amount formulas remain intact.
- Quote review avoids price prefill for mismatched units or unclear/inclusive tax. Deterministic conservative tax phrase validation rejects the observed model assumption that STT “GSD” means GST. Draft evidence persists through review/save.
- Call setup cancellation cannot reopen a terminal call; retries are rechecked after worker health probing. Ending an already-deleted room is harmless. Signed null callbacks return400. Timed-out room cleanup failures are visible and retry.
- Transcript spool publication is atomic/private and replay tolerates another process deleting an already-delivered event. A reproduced replay race previously failed a new conversation; regression tests cover it.
- Extended Python smoke initially printed successful assertions then crashed during native teardown. Explicit audio cleanup plus garbage collection of callback cycles fixed the final run; final exit code is0.
- Voice setup cancels if the desk closes mid-start. Phone call buttons wrap instead of clipping. Oversized enquiries show the20-item voice limit. Nested quotation dialogs have distinct accessible names.
- Blank project due dates are supported without an invented deadline. BOQ shows original references and inherited-specification guidance. Import text accurately describes studio storage.
- SIP trunk registration's required SDK transport option fixed; `SIP_TRANSPORT=auto|udp|tcp|tls`, default auto. Actual trunk creation was not executed.

### Processes left for local use

Processes started/verified by this work; do not stop unrelated processes. Recheck PIDs before stopping them.

| Service                        | PID at checkpoint | Exec session | Address         |
| ------------------------------ | ----------------- | ------------ | --------------- |
| Persistent API                 | 27573             | 7771         | 127.0.0.1:8787  |
| Vite                           | 26009             | 62978        | 127.0.0.1:5178  |
| LiveKit                        | 25676             | 9215         | 127.0.0.1:7880  |
| Ollama                         | 25677             | 6915         | 127.0.0.1:11434 |
| Python worker, DPDFNet enabled | 27275             | 25305        | health8081      |

Worker dev mode does not hot-reload: restart after Python edits. `.env` has DPDFNet false; current worker uses the explicit `DPDFNET_ENABLED=true` process override. The old test-login file remains private but is not a persistent-studio login. Callback spool can contain synthetic events referring to the now-discarded in-memory test database; do not treat those as real missing customer calls.

Git still reports the application source as untracked, as it did at session start. No commit, push or deployment was performed. Do not discard these files when starting the next session. Runtime data, credentials, models and private screenshots are ignored.

### Remaining external prerequisites

Actual vendor data/prices, resolution of row188 quantity and commercial defaults, selected SIP provider/verified number/credentials and supported routes, supervised handset test, Hindi/Hinglish evaluation, actual Linux/HTTPS/TURN deployment, human latency/interruptions/refusal QA. No purchases, paid provisioning, real vendor contact or external publishing occurred. Existing single-account-per-studio, retention and collaboration limits remain in CODEBASE_REFERENCE.md.

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
