# Nivo release status

Updated 23 September 2026. The audited build is suitable for supervised local single-operator use. Public production deployment has not occurred. No public host/domain or carrier has been supplied, and the multi-firm release scope is awaiting confirmation.

## Concrete release artifact

`npm run build` produces `dist/`. The API serves these built assets. A browser test runs that exact build with production CSP and Secure session cookies, signs in, downloads a quotation and reloads the workspace. Small fonts are emitted as files so the restrictive `font-src 'self'` policy remains effective.

The Linux release template is `compose.linux.yaml`, with `Dockerfile`, `agent/Dockerfile` and `deploy/Caddyfile`. Compose parses successfully. Both app and worker images build on Linux ARM64 in the local Colima VM. Isolated container checks pass for non-root execution, app login/CSP/persistence/backup/restore and fresh worker cache/spool permissions; the worker Python suite has six passing tests. Real Linux Piper→Whisper audio and DPDFNet processing also pass. External networking, the actual public host and x86 images remain untested. The API image uses Node 22.22; local tests used Node 22.14 and Python 3.13.

Recovery commands and reproducible container checks are in `docs/BACKUP_AND_RECOVERY.md`. Backend verification now includes three server-recovery tests (25 backend tests pass). Local images are `nivo-app:release-check` and `nivo-agent:release-check`; publish/tag the exact chosen commit only as part of the deployment process.

## Before public use

1. Choose the host, domains, release audience and permitted infrastructure/model/carrier budget. No account or purchase was made by this session.
2. On the chosen Linux host, create private production configuration with new secrets, persistent storage and HTTPS origins; preserve the same-origin frontend/API design. Keep `ENABLE_OUTBOUND_CALLS=false` until carrier and language validation are complete.
3. Build and start the Compose services. Confirm app/LiveKit/worker/model readiness and blocked public access to internal service ports. See `HOSTING_AND_VOICE.md` for the exact configuration and media ports.
4. Provision the intended studio account privately. Import the prepared BOQ only into that intended account. The retained local Raisina workspace has 112 unpriced items (86 measured, 25 rate-only, one unknown quantity); its original workbook bytes match the source file. Confirm commercial defaults and resolve the unknown quantity before approval.
5. Rehearse database backup and restoration, including accounts, files, calls and audit history. JSON workspace backups alone do not preserve all server records. Keep encrypted copies off the host and define an operator for recovery.
6. On the public domain, verify login/logout, save/reload, workbook download, stale-write refusal, browser microphone audio, disclosure, ending/cancellation, extraction refusal and evidence review from an external network. Verify TLS and TURN behavior under the networks users will actually use.
7. Assign monitoring for app/worker availability, failed calls, callback spool accumulation, storage capacity and failed backups. Record a rollback procedure and the exact deployed commit.

Do not launch shared-staff or multi-firm access before resolving the Phase 1 authorization and persistence work in `docs/superpowers/specs/2026-09-23-phase1-input.md`.

## Local access and operational boundary

`docs/LOCAL_STUDIO.md` describes the prepared owner account and BOQ. Passwords remain only in ignored private files. Audit tools use `data/audit.sqlite` and fictional accounts; do not point them at the real studio. `node scripts/verify-audit.mjs` checks all 218 frozen inventory rows and finding dispositions.

No vendor has been called. Browser WebRTC uses local services; ordinary telephone calls require a carrier and are not a permanently free service. The live English tests are not evidence of Hindi/Hinglish or PSTN readiness.
