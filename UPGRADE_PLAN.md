# Nivo private beta upgrade

Written before implementation, 22 September 2026.

## Scope and order

1. Preserve client BOQ structure: optional original references, section and preceding specification context, general notes, rate-only lines, unresolved quantities and merged continuation rows. Keep the Raisina file read-only; use synthetic fixtures in the repository.
2. Add material/labour/other cost breakdown and per-item adjustment/markup. Keep unknown prices and quantities explicit, and block approval with unresolved quantities.
3. Separate client-safe clean exports from internal costing exports. Patch mapped cells directly in the original OOXML ZIP for internal original export, preserving unrelated parts. Do not describe an arbitrary source workbook containing private sheets as client-safe.
4. Add an authenticated same-origin Node API backed by SQLite and private file storage. Use invitation-only CLI account creation, scrypt password hashes, HttpOnly sessions, tenant ownership checks, revision conflicts, audit records and deliberate local-workspace migration. Keep local demo mode available.
5. Add a Python LiveKit worker with STT → LLM → TTS, Silero VAD, configurable turn/interruption settings, per-call DPDFNet, bounded call duration and signed transcript callbacks. Learn architectural patterns from Echo without importing its product code or credentials.
6. Connect the enquiry desk to browser voice tests and configured SIP outbound calls. Keep reviewed extraction separate from accepted rate evidence. Include call state, failures, transcripts and draft quotations. No automated vendor calls during development.
7. Supply local and Linux self-host deployment configuration, provider examples, health checks and a truthful free-hosting guide. Existing hardware can run browser tests; PSTN carrier minutes are not free. Do not provision paid services.
8. Run regression, security/tenant/revision/callback and workbook tests, a production build, responsive browser checks and screenshot inspection. Document precisely which voice/infrastructure paths were actually exercised and which require external configuration.
9. Update CODEBASE_REFERENCE.md as the comprehensive handover, including every new module, deployment commands, setup prerequisites and limitations.

## Architecture decisions

React/Vite remains the frontend. A single Node API serves the built frontend and authenticated API on one origin, avoiding cross-site cookie dependence. SQLite WAL and private disk files are appropriate for one small beta server; no multi-replica claims. One account owns one isolated studio for this beta; collaborative roles are a later migration. LiveKit, Redis, optional SIP and the Python worker are separate processes. Provider credentials exist only on the server/worker. Local model endpoints are configurable; paid provider plugins remain optional and explicit.

## Release gate

BOQ/backend workflows must pass automated checks. A configured worker is not equivalent to a tested phone service: audio quality, Hindi/English recognition, SIP registration, caller identity and actual vendor quote accuracy require live validation before enabling real vendor use. Failures must never appear as successful calls or confirmed prices.
