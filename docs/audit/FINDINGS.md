# Nivo Phase 0 audit findings

This document records confirmed findings in `F-<nn>` format as later tasks test the behaviours
listed in `docs/audit/INVENTORY.md`. As of Task 3 (inventory freeze), no behaviour has been
tested and no `F-*` entry exists yet. Task 4 is the first task to add findings here and to check
the two hypotheses below.

## Hypotheses (unconfirmed, to be checked in Task 4)

- H-01: `isStale` is `r.validUntil < date`. If a rate may be saved with a
  blank `validUntil`, `'' < '2026-09-23'` is true, so such a rate is
  always stale and `applyRate` can never apply it. Check whether
  `RateForm` permits a blank validity. If it does, this is a Blocker:
  evidence a user saved becomes permanently unusable.
- H-02: `totals` uses `quantity ?? 0` and `cost ?? 0`. Numerically this
  excludes rate-only and unresolved lines correctly, but confirm that
  `profit` and `reviewed` counts do not mislead when many lines are
  unpriced.

## Findings

### F-01: A rate saved with a blank `validUntil` is permanently expired and can never be applied

- **Severity:** Minor
- **Inventory row:** INV-14 (and hypothesis H-01)
- **Reproduction:** `npm test -- tests/costing.test.ts -t "H-01: a rate with a blank validity must not be permanently expired"`
- **Observed:** `isStale({ validUntil: '' } as Rate, '2026-09-23')` returns `true`
- **Expected:** `false` — a blank `validUntil` must not be treated as permanently expired; `isStale` is defined as `r.validUntil < date`, and `'' < '2026-09-23'` is `true` in JavaScript string comparison, so any rate that somehow has a blank validity is stale forever and `applyRate` (`src/lib/costing.ts`) will refuse it unconditionally
- **Suspected file:** `src/lib/costing.ts:66` (`isStale`)
- **Reachability (Step 5):** NOT reachable through the product interface, so this is downgraded to Minor / defence-in-depth rather than Blocker:
  - `RateForm` (`src/components/forms.tsx:482`) renders `<input name="validUntil" type="date" required defaultValue={today()} />`. The `required` attribute on an HTML date input blocks native form submission when the field is empty — the browser refuses to dispatch the `submit` event at all, so the form's `onSubmit` handler (which calls `onSave`) never runs with an empty `validUntil`. A user would have to bypass the browser's built-in validation (e.g. via devtools or a scripted `requestSubmit`) to reach this path through the UI.
  - The workspace-restore path is independently guarded: `validateWorkspace` (`src/lib/validation.ts:98`) requires `date(r.validUntil)` for every rate, and `date()` (`src/lib/validation.ts:7`) is `/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))`, which an empty string fails. So a backup/import containing a rate with a blank `validUntil` is rejected by `validateWorkspace` before it can enter the workspace.
  - Both entry points a real user can exercise (the Record-a-quotation form, and restoring a backup) reject a blank `validUntil` before it reaches `isStale`/`applyRate`. The bug in `isStale` is real and should still be fixed (Task 10) as defence-in-depth against any other future caller of `applyRate` that does not go through these two gated paths, but it is not currently user-reachable, hence Minor rather than Blocker.

### F-02: Rate limiting is completely inert — unlimited login brute force and no request throttling at all

- **Severity:** Blocker
- **Inventory row:** API-04 (`POST /api/login` wrong password: "Rejected; no cookie; rate limited on repeat")
- **Reproduction (in-process):** `node --import tsx --test server/tests/isolation.test.ts` — test "API-04: wrong password is rejected, sets no cookie, and repeated attempts are rate limited" fails: the 11th failed login attempt against a route configured for `max: 10` per 15 minutes still returns 401, not 429.
- **Reproduction (live server, `data/audit.sqlite`):**
  ```
  for i in $(seq 1 14); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8787/api/login \
    -H 'content-type: application/json' -H 'x-nivo-request: 1' \
    --data '{"email":"alpha@audit.local","password":"definitely-wrong-password"}'; done
  ```
  All 14 attempts return `401`, never `429`, and no `x-ratelimit-*` or `retry-after` header appears on any response.
  The same is true of the global 300/min default limit: 320 consecutive `GET /api/health` requests against the live server all return `200`.
- **Observed:** `@fastify/rate-limit` is registered (`server/app.ts:79`, global `max:300/1min`) and the login route additionally sets `config: { rateLimit: { max: 10, timeWindow: '15 minutes' } }` (`server/app.ts:127-129`). Neither limit is ever enforced — no request of any kind, on any route, at any volume, is ever rejected with 429 in this build.
- **Expected:** The 11th failed login attempt from the same client within 15 minutes returns 429, and sustained high-volume traffic against any route is throttled at 300/min.
- **Root cause (isolated by minimal repro, not fixed):** `server/app.ts` calls `app.register(rateLimit, {...})` (and every other plugin) without `await`, then defines routes and later calls `app.listen()` (which internally calls `.ready()`). Reproduced with a minimal Fastify app: `app.register(rateLimit, {...}); app.get('/x', ...); await app.ready();` — no rate limiting is ever applied and no `x-ratelimit-*` headers are ever added, even after `.ready()` resolves. The identical app **with** `await app.register(rateLimit, {...})` before the route is defined enforces the limit correctly and adds the headers. This reproduces in the minimal case, in the project's own `makeApp()` factory run in-process, and against the live server started the normal way (`server/index.ts` also never awaits `makeApp()`'s internal registrations because they are hidden inside the synchronous factory function) — so this is not a test-harness artifact.
- **Impact:** `POST /api/login` accepts unlimited password guesses per account with no throttling, cool-down, or lockout of any kind — a direct, remotely exploitable offline/online brute-force path against every studio's credentials, and the general request-volume protection meant to blunt scripted abuse across the whole API is likewise absent. This is a Blocker: it is a live, exploitable authentication weakness with an unauthenticated reproduction, independent of the tenant-isolation checks below (all of which passed).
- **Suspected file:** `server/app.ts:79` (`app.register(rateLimit, ...)`) together with the unawaited plugin-registration pattern used throughout `makeApp()`; `server/index.ts:2-3` (`makeApp()` then `app.listen()`, never awaiting the registrations inside the factory).
- **Not fixed here per Task 5 scope** (measurement only); Task 10 fixes this, and Task 5's `isolation.test.ts` "API-04" test is left in its currently-failing state as recorded evidence, the same pattern used for F-01/H-01.
- **Remedy is NOT a one-word `await` patch — read this before starting Task 10:** `makeApp()` (`server/app.ts:32`) is a synchronous factory that `return app`s at `:470`, and `server/index.ts:2` calls `const app = makeApp();` synchronously, then `await app.listen(...)`. Simply inserting `await` before `app.register(rateLimit, ...)` does not work inside a synchronous function body — there is nothing to await into. The actual fix requires one of:
  - making `makeApp` itself `async` (and updating every caller, including `server/index.ts` and every test in `server/tests/*.test.ts` that calls `makeApp({...})` synchronously) so the registration can genuinely be awaited before routes are defined, or
  - wrapping the route declarations in `app.register(async (instance) => { ...all the app.get/post/put calls... })` so Fastify's own encapsulation/boot ordering (avvio) defers them until after the `rateLimit` plugin's `onRoute` hook (`@fastify/rate-limit@11.2.0`, `index.js:172` — the plugin's only hook, and where both the global and per-route enforcement branches live) has already been added to the parent instance.
  Confirm whichever approach is taken by checking, post-fix, that `x-ratelimit-*` response headers appear on ordinary requests — their absence is what exposed this finding in the first place, not a thrown error.
- **Per-IP keying, not per-account:** `@fastify/rate-limit`'s default key is the client IP. Once enforcement is restored, the `max:10/15min` login limit throttles a single source IP, not a single targeted account — distributed credential stuffing spread across many source IPs still walks straight through it. Per-account throttling or lockout (e.g. keyed on the submitted email) is a separate control this fix does not deliver, and is not itself required to close this Blocker, but should not be assumed to come free with the `await`/registration fix.
- **`trustProxy` is already correct for this:** `Fastify({ trustProxy: ['127.0.0.1','::1'], ... })` at `server/app.ts:45` already matches the intended Caddy reverse-proxy topology (`deploy/Caddyfile`, `compose.linux.yaml`), so once the registration-ordering fix lands, per-IP keying will resolve real client IPs (via `X-Forwarded-For`) rather than the proxy's loopback address. No additional change is needed there.

### F-03: The agent callback boundary has no tenant predicate at all — deferred to Phase 1

- **Severity:** Major — DEFERRED TO PHASE 1
- **Status:** DEFERRED TO PHASE 1 (not a defect in Task 5's scope; recorded now because Phase 1 multi-tenancy work needs it as an input)
- **Inventory row:** none — this boundary sits outside `API-01`..`API-27`, which only cover the
  user-facing (cookie-authenticated) endpoints. It needs its own inventory row when Phase 1 begins.
- **Location:** `server/app.ts:364` (`GET /api/agent/calls/:id`: `db.prepare('SELECT * FROM calls WHERE id=?').get((req.params as any).id)`) and `server/app.ts:402` (`POST /api/agent/events`: `db.prepare('SELECT * FROM calls WHERE id=?').get(e.callId)`). Both query `calls` by `id` alone — no `user_id`/tenant predicate anywhere in either statement — and are gated solely by `verifyAgent()` (`server/app.ts:347-361`), which checks an HMAC against one process-wide `AGENT_CALLBACK_SECRET`, not any per-account credential.
- **What is true today:** there is exactly one operator (one studio account, `data/nivo.sqlite`) and one voice worker holding the one shared secret, so "no tenant predicate" and "single global secret" are equivalent to "scoped to the only tenant that exists." Not a live defect under Task 5's isolation contract, which is why it is not `API-*` FAIL and not a Blocker.
- **What becomes untrue under multi-tenancy:** as soon as a second, independent firm's data lives behind a second account, `AGENT_CALLBACK_SECRET` stops being a tenant boundary — it is one secret shared by whatever process holds it (one voice worker, or, if Phase 1 deploys per-tenant workers, all of them). Any caller holding that secret can `GET /api/agent/calls/:id` for **any** call id regardless of which firm owns it (reading that firm's brief: company, project, location, vendor, phone, items) and can `POST /api/agent/events` to mutate **any** firm's call status/transcript by guessing or enumerating call ids (they are UUIDs, so not practically guessable, but nothing here checks ownership even if a valid one leaks). This is a cross-tenant read and write path with no isolation control beyond secret possession.
- **Why deferred rather than fixed or made Blocker now:** fixing it meaningfully requires deciding Phase 1's agent-authentication model (per-tenant secrets? a tenant claim embedded in and verified from the HMAC-signed envelope? a tenant id passed alongside and cross-checked against the call row?) — a multi-tenancy design decision, not a Task 5/10 audit-scope bugfix. Recording it now, before that design is finalized, is what P-03-style test-only/finding-only work in this phase is for.
- **Action required in Phase 1:** add an `API-*`-equivalent inventory row for this boundary once the agent-auth model is decided, and verify tenant scoping on both `GET /api/agent/calls/:id` and `POST /api/agent/events` the same way `API-06`/`API-13`/`API-14` verify it on the user-facing endpoints in this task.

### F-04: Deleting a BOQ item silently disables the original-workbook export for the whole project, with no warning at the point of deletion

- **Severity:** Minor
- **Why Minor and not Major:** no data is lost or corrupted — every item, price and specification survives the deletion intact, and both other export paths (client quotation, internal costing workbook) remain fully functional throughout. It is held at Minor rather than downgraded further because the loss of the original-export path is irreversible in practice (recoverable only by re-importing and re-pricing the whole project from scratch), happens silently with no warning at the moment of the triggering action, and is inconsistent with the sibling edit-item path, which does warn before an equivalent side effect — those three factors put it at the high end of Minor.
- **Inventory row:** EXP-04
- **Reproduction:** Import a workbook with a mapped rate column, delete any one item via the item-row "Delete" action, confirm "Remove item" in the "Remove this item?" dialog. Open the Export BOQ dialog: "Fill the original workbook (internal)" is now a disabled button for every remaining item in the project, not just the deleted one.
- **Observed:** `src/components/BoqPage.tsx` (delete handler, `onClick` inside the `deleting` Modal) calls `onUpdate({ ...project, stage: 'Draft', workbookId: undefined, items: project.items.filter((i) => i.id !== deleting.id) })` — deleting sets `workbookId: undefined` unconditionally on every delete. `exportProject(project, true, …)` (`src/lib/spreadsheet.ts:116`) and the button's own `disabled` expression (`src/components/BoqPage.tsx:687`, `!project.workbookId`) both then permanently refuse the original-workbook export for the entire project, even though every *remaining* item's `sourceRow` is still valid and unaffected by the deletion. The confirmation dialog itself ("Remove this item?" / "This removes the item from this project's BOQ. The rate library is retained.") says nothing about this side effect.
- **Expected:** Either (a) the delete confirmation dialog discloses that removing this item will disable the original-workbook export for the project (mirroring the warning already shown in the item-edit form: "Changing the description, specification, quantity or unit requires a new BOQ export"), or (b) deleting an item is not treated as a structural edit for `workbookId` purposes when every remaining item's `sourceRow` is still valid, since nothing about a deletion actually invalidates the surviving rows' mapping.
- **Impact:** A studio user can lose original-workbook export capability for an entire priced BOQ from a single, seemingly harmless item removal, discover it only later when the (silently disabled) export button doesn't respond, and have no path back except re-importing and re-pricing the whole project. Inconsistent with the edit-form path, which does warn before an equivalent side effect.
- **Suspected file:** `src/components/BoqPage.tsx` (delete-item `onClick`, near the "Remove this item?" `Modal`).
- **Not fixed here per Task 6 scope** (measurement only); Task 10 addresses it.

### F-05: Modal keyboard focus does not wrap at its boundaries

- **Severity:** Minor — OPEN
- **Inventory row:** DLG-01, DLG-10
- **Reproduction:** `npm run test:e2e -- tests/e2e/modal.spec.ts`; open Project details, focus Save project details, press Tab.
- **Observed:** Chrome moves focus outside the dialog instead of to Close dialog. The new regression fails before any application change. Native `showModal()` alone does not provide the inventory's explicit keyboard wrapping contract.
- **Expected:** Tab from the last focusable control wraps to the first; Shift+Tab wraps back. Escape restores focus to the triggering control.
- **Suspected file:** `src/components/ui.tsx`, shared `Modal`.
- **Scope:** No quotation or stored data changes. Fix the shared keyboard boundary without including hidden controls inside collapsed details.

### F-06: Workspace-wide revision conflicts prevent independent concurrent edits

- **Severity:** Major — DEFERRED TO PHASE 1
- **Inventory row:** API-07; Task 8 sync-specific walkthrough
- **Reproduction:** `npx playwright test --config playwright.audit.config.ts ui.spec.ts --grep 'Studio.*storage error'`. Two actual browser tabs load the same studio revision. The first saves; the second saves a different value from its stale revision.
- **Observed:** The second write is refused, automatic writes freeze, its pending value remains visible and is present in its downloaded backup. The server retains the first tab's value. No silent overwrite occurred.
- **Scope evidence:** This walkthrough changes settings. The API compares one workspace revision and replaces the entire workspace JSON, so the same restriction also applies to edits of different projects; that extension is a source-derived conclusion, not a separate UI probe.
- **Expected for Phase 1:** Independent projects and records can be edited by different staff without unrelated revision conflicts; concurrent changes to the same record still require conflict handling.
- **Resolution:** Row-level persistence and explicit firm/member ownership in Phase 1. Preserve the current refusal and pending-backup recovery during migration.
