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
