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
- **Not fixed here per Task 5 scope** (measurement only); Task 10 should fix the registration/await ordering (or otherwise confirm `@fastify/rate-limit` is actually active) and Task 5's `isolation.test.ts` "API-04" test is left in its currently-failing state as recorded evidence, the same pattern used for F-01/H-01.
