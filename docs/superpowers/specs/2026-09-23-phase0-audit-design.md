# Phase 0: Audit and fix

Design document. Written 23 September 2026. Status: awaiting review.

## Why this phase exists

Nivo is being taken from a single-firm internal tool to a multi-firm SaaS
product. Phase 1 will replace the persistence layer, add tenancy, add
self-serve signup and add onboarding. Phase 2 will add real telephony and
Hindi voice.

Both later phases rewrite code that currently has no independent proof it
works. `HANDOVER.md` records that tests pass and that a voice smoke exited
zero, but passing tests cover a fraction of the surface: 102 buttons, 114
form inputs, 16 API endpoints and 7 screens exist, against 12 browser
scenarios and 4 backend suites.

Building tenancy on top of unverified behaviour means every Phase 1 bug is
ambiguous: did the rewrite break it, or was it already broken? Phase 0
removes that ambiguity by establishing what works today, in the running
application, with defects recorded and fixed.

## Goal

A written, evidence-backed statement of which user-facing behaviours in
Nivo work, which do not, and a repository in which every defect found has
been fixed or explicitly deferred with a reason.

## Non-goals

This phase adds no features. Specifically out of scope: multi-tenancy,
signup, roles, password reset, onboarding, deployment, telephony, Hindi,
LLM provider changes, price-history tracking, campaign dialling. Those are
Phase 1 and Phase 2.

Refactoring is out of scope except where a defect cannot be fixed without
it. The blob-shaped workspace persistence is known to be a Phase 1
problem; this phase records where code depends on that shape but does not
change it.

## Approach: three passes

### Pass 1 — Inventory

Produce `docs/audit/INVENTORY.md`: a complete checklist of every
verifiable behaviour, derived from source rather than memory, so that
nothing is silently skipped.

Rows are grouped by surface:

| Surface              | Source of truth                                                                              | Approximate size          |
| -------------------- | -------------------------------------------------------------------------------------------- | ------------------------- |
| Screens and routes   | `src/App.tsx` navigation table and hash router                                               | 7 routes                  |
| Interactive controls | `<button>`, `<input>`, `<select>`, `<textarea>`, `onClick`, `onChange`, `onSubmit` in `src/` | ~102 buttons, ~114 inputs |
| Filters and sorts    | `BoqPage.tsx`, `WorkspacePages.tsx`                                                          | to be enumerated          |
| Dialogs              | `components/ui.tsx` dialog usages                                                            | to be enumerated          |
| Exports              | `spreadsheet.ts`, `workbook-patch.ts`                                                        | 3 export paths            |
| Backup and restore   | `backup.ts`, `SettingsPage.tsx`                                                              | 2 paths                   |
| API endpoints        | `server/app.ts` route registrations                                                          | 16 endpoints              |
| Voice actions        | `VoiceDesk.tsx`, `server/voice.ts`                                                           | to be enumerated          |
| Domain invariants    | the invariant list in `CODEBASE_REFERENCE.md`                                                | ~10 rules                 |

Counts shown as "to be enumerated" are outputs of Pass 1 rather than gaps
in this document; stating a number here would be a guess.

Each row carries: identifier, location, what correct behaviour is, how it
will be verified, and a result column left empty until Pass 2.

The inventory is derived mechanically where possible. A control that
cannot be reached from any screen is itself a finding, recorded as dead or
unreachable rather than quietly dropped.

### Pass 2 — Verify

Execute the inventory against the running application and record the
result of every row. Verification runs in both operating modes, because
they use different persistence paths:

- **Local demo mode** — `localStorage` workspace, IndexedDB workbooks, no
  authentication.
- **Signed-in studio** — authenticated API, SQLite, revision checks.

Methods, in order of preference:

1. **Browser interaction** against `http://127.0.0.1:5178` for anything
   user-facing. A control is verified when its observable effect is
   confirmed, not when it merely renders without error.
2. **Direct API requests** for endpoint behaviour, including the
   authorisation and rejection paths, not only the success path.
3. **Opening produced artefacts.** Exported workbooks are opened and their
   contents inspected. An export that downloads a corrupt file passes a
   click test and fails a real one.
4. **The existing automated suites** (`npm test`, `npm run test:server`,
   `npm run test:e2e`, `pytest agent/tests`) re-run to confirm the recorded
   pass state is still true today.

Data used for verification is fictional, created for the purpose. The
private Raisina workbook is used read-only where realistic data matters,
and no real vendor is contacted. No outbound telephone call is placed in
this phase; voice verification is browser WebRTC only, matching the
current `ENABLE_OUTBOUND_CALLS=false` configuration.

Every failure is recorded in `docs/audit/FINDINGS.md` with: identifier,
severity, exact reproduction steps, observed behaviour, expected
behaviour, and the file most likely responsible.

Severity is assigned as:

- **Blocker** — data loss, incorrect money, security or tenant-isolation
  failure, or a primary workflow that cannot be completed.
- **Major** — a feature does not work, or works only by accident, but a
  workaround exists.
- **Minor** — cosmetic, copy, or an edge case unlikely to be hit.

### Pass 3 — Fix and lock

Fix every Blocker and every Major. Minors are fixed when cheap and
deferred with a written reason when not.

Each fix addresses the cause rather than the symptom. Where a fix is not
possible without structural change that belongs to Phase 1, the finding is
deferred into the Phase 1 spec explicitly rather than patched over.

Regression tests are written selectively, not universally:

- Every defect fixed gets a test that fails before the fix and passes
  after. This is non-negotiable; it is the only proof the fix is real.
- Flows that Phase 1 will rewrite — workspace save and load, revision
  conflict, file storage, session and authorisation — get characterisation
  tests describing current correct behaviour, so Phase 1 has a safety net.
- Flows Phase 1 will not touch get no new tests beyond defect regressions.

Blanket coverage of code scheduled for rewrite is deliberately avoided.

## Money and data correctness

The costing rules receive disproportionate attention relative to their
line count, because a quotation that is wrong by a factor is worse for a
firm than a screen that fails to load.

Verified explicitly, with worked numeric examples recorded in the
findings:

- Null cost is unpriced and distinct from zero cost.
- Null quantity is rate-only or unresolved and never silently becomes zero.
- Rate-only lines carry a selling rate and no line amount.
- Unknown quantity produces no amount and blocks approval.
- Assembly cost rounds `(material + labour + other) × (1 + adjustment/100)`.
- Selling rate rounds `cost × (1 + markup/100)`, markup on cost and not on
  gross margin.
- Line amount rounds `quantity × rounded selling rate`; GST applies to the
  subtotal.
- Applying a quote clears review state and assembly.
- Editing cost, specification, quantity or pricing reopens Draft.
- Approval requires priced lines, no unresolved quantities and no expired
  linked evidence.

Rounding is checked at boundaries, not only at typical values.

## Security and isolation

Verified before Phase 1 rather than after, because Phase 1 multiplies the
consequences of any weakness here:

- A second account cannot read or write the first account's workspace,
  files or calls, tested by direct API request rather than by the absence
  of a link in the interface.
- Mutations without the same-origin request header are rejected.
- Session cookies are `HttpOnly` and `SameSite=Strict`.
- Workspace `PUT` with a stale revision returns 409 and does not overwrite.
- Agent callbacks with an invalid HMAC, an expired timestamp or a replayed
  event identifier are rejected.
- A terminal call cannot be reopened by a late event.
- Provider secrets do not appear in any browser-reachable response, room
  metadata or exported file.

## Deliverables

| Path                      | Contents                                         |
| ------------------------- | ------------------------------------------------ |
| `docs/audit/INVENTORY.md` | Complete checklist with a result per row         |
| `docs/audit/FINDINGS.md`  | Every defect, with reproduction and severity     |
| Source changes            | Fixes, each with a failing-first regression test |
| `HANDOVER.md`             | Updated to reflect verified reality              |
| `CODEBASE_REFERENCE.md`   | Corrected where the audit contradicts it         |

Work is committed incrementally: inventory, then findings, then one commit
per fix or per closely related group of fixes. This keeps the diff
reviewable and preserves the ability to revert a single fix.

## Exit criteria

Phase 0 is complete when all of the following hold:

1. Every inventory row has a recorded result. No row is left unverified
   without a written reason.
2. No open Blocker or Major finding remains, except those explicitly
   deferred into the Phase 1 spec with justification.
3. Every fix has a regression test that fails against the parent commit.
4. `npm run build`, `npm run check:server`, `npm test`,
   `npm run test:server`, `npm run test:e2e`, `npm run format:check` and
   `pytest agent/tests` all pass.
5. `HANDOVER.md` describes actual verified state, with no claim that
   exceeds what was tested.

## Risks

**The audit finds structural problems rather than bugs.** Likely, given
the blob persistence model. Mitigation: structural findings are routed
into the Phase 1 spec rather than fixed here, and Phase 0 completes on
schedule with them documented.

**Verification scope expands without bound.** 102 buttons invites
gold-plating. Mitigation: the inventory is fixed at the end of Pass 1 and
does not grow during Pass 2; anything discovered later is a finding, not a
new inventory row.

**The running services are stale.** The five processes date from the
previous session and may not reflect current source. Mitigation: all
services are restarted from current source at the start of Pass 2, and the
restart is recorded.

**Voice cannot be fully verified.** Without a carrier, PSTN behaviour is
untestable in this phase. Mitigation: this is accepted and stated. Browser
WebRTC voice is verified; telephony verification belongs to Phase 2 and is
recorded as untested rather than assumed working.

## What comes after

Phase 0 findings feed directly into the Phase 1 spec, particularly the
deferred structural items. Phase 1 is specified separately once this phase
reports. Telephony research runs in parallel and informs Phase 2
independently of this work.
