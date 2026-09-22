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
