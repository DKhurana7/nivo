# Phase 1 input from the completed audit

This is the implementation input list requested by Phase 0 Task 12, not an approved Phase 1 implementation plan. The release audience and hosting target still need a decision.

## Verified baseline to preserve

- Cost versus selling price, null versus zero, unknown versus rate-only quantity, per-item markup and rounded line totals.
- Exact source workbook bytes; safe fresh client exports; explicit internal-original export limits.
- Human review between extracted transcript evidence, stored quotations and BOQ pricing.
- Authenticated account isolation, secure production cookies, CSRF checks and active rate limits.
- Stale writes must never overwrite data silently; pending changes remain exportable.
- Browser voice start/end, mute, cancellation cleanup and unavailable-worker refusal.

Regression entry points: `tests/costing.test.ts`, `server/tests/isolation.test.ts`, `tests/e2e/studio.spec.ts`, `tests/e2e/production.spec.ts`, and the opt-in real-service `tests/audit` suite. Keep tests discriminating: changing a tenant predicate or bypassing revision comparison must fail isolation/conflict assertions.

## Required before shared-firm or multi-firm release

1. **F-03 — callback authorization.** Replace the process-wide authority of every worker callback with a deliberately scoped call/firm credential. Validate ownership on both brief retrieval and event ingestion, including token expiry/revocation, replay behavior and terminated calls. The shared secret is currently a trusted service boundary, not a firm-specific credential.
2. **F-06 — persistence granularity.** Model firms, users, memberships, projects, items, rates, vendors, enquiries, files and calls explicitly. Use record revisions/transactions so unrelated project edits do not conflict. Preserve same-record conflict refusal and pending-data recovery.
3. Define membership roles, invitations, account recovery and administrator actions. Current accounts own isolated workspaces and have no shared staff model. Avoid presenting separate accounts as members of the same firm.
4. Plan an idempotent, reversible migration of workspace JSON and workbook BLOB ownership. Rehearse against a copy with before/after counts, monetary invariants, file hashes, enquiry/rate references and a full database restore. Never test migration on the retained client database.
5. Preserve private workbook/call access and add explicit authorization assertions for every new endpoint. Revisit per-account authentication throttling and multiple-instance rate-limit storage when the deployment model changes.

## Phase 2 inputs

- The real English local speech smoke produced a validated quotation draft, but later re-extraction returned unverifiable evidence and was safely refused. Build an evaluation set for extraction repeatability, number/unit accuracy, GST ambiguity, refusals and noisy/transcribed speech. Do not remove exact-evidence checks to improve apparent success.
- Hindi/Hinglish, actual Indian telephone routes, consent/opt-out behavior, carrier onboarding, caller identity and costs remain unvalidated. Use the sourced telephony research as input, not as a completed carrier integration.
- Load, inference latency, worker restarts, spool replay and alerting must be verified on the chosen host. A healthy worker HTTP endpoint alone is not a latency or model-quality guarantee.
- Public HTTPS/WebRTC/TURN connectivity must be verified from an external network on the actual domain. Localhost voice and Compose syntax validation do not establish public readiness.
