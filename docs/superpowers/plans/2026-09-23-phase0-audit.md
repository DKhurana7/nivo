# Phase 0 Audit and Fix Implementation Plan

> Execution completed 23 September 2026. All 12 tasks have been carried out; see the newest HANDOVER.md checkpoint for final evidence, adaptations and runtime state. Task 11 extended the existing studio browser suite with real two-tab conflicts and workbook-byte backup/restore assertions instead of adding the illustrative stub below. All 218 inventory rows have recorded results; six findings are fixed and two are explicitly deferred. The checklist below is the original execution recipe, not the current status tracker.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish, with recorded evidence, which of Nivo's user-facing behaviours work and which do not, and fix every Blocker and Major defect found, so that Phase 1's tenancy rewrite starts from a known-good base.

**Architecture:** Three passes. Pass 1 derives a complete inventory of verifiable behaviours from source. Pass 2 executes that inventory against the running application in both operating modes and records every result. Pass 3 fixes each defect with a failing-first regression test, and adds characterisation tests only for the flows Phase 1 will rewrite.

**Tech Stack:** React 19 + TypeScript + Vite frontend; Fastify 5 + `node:sqlite` backend; Vitest for domain tests; `node --test` for backend tests; Playwright for browser tests; Python 3.13 + LiveKit Agents 1.6.5 worker with pytest.

**Spec:** `docs/superpowers/specs/2026-09-23-phase0-audit-design.md`

## Global Constraints

- Node 22.14 is installed; `package.json` declares `engines.node >=22.22`. Do not upgrade Node and do not change the engines field. Run all commands in a **non-login shell** — a login shell selects Node 18 on this machine and every command will fail confusingly.
- Python is `agent/.venv/bin/python` (3.13.9). Never use the system `python3`.
- This phase adds **no features**. No tenancy, signup, roles, onboarding, deployment, telephony, Hindi, or LLM changes. Those are Phase 1 and Phase 2.
- No refactoring except where a defect cannot otherwise be fixed. Record structural problems as deferred findings instead.
- **Never place a telephone call.** `ENABLE_OUTBOUND_CALLS` stays `false` for the entire phase. Voice verification is browser WebRTC only.
- **Never contact a real vendor.** All vendor records created during verification are fictional.
- The private Raisina workbook and everything under `data/` is client data: read-only, never committed, never pasted into a document, never printed to output.
- Secrets live in `.env` and `deploy/generated`, both ignored. Never read a secret into a document, a commit, or a test fixture.
- Do not stop or restart processes you did not start, other than the five Nivo services named in Task 1.
- Every fix commit must contain a test that fails against its parent commit. A fix without a failing-first test is not complete.
- Findings are recorded with severity **Blocker** (data loss, wrong money, security or isolation failure, primary workflow unusable), **Major** (feature broken, workaround exists), or **Minor** (cosmetic or unlikely edge case).

---

## File Structure

| Path                                 | Responsibility                                                                  | Status |
| ------------------------------------ | ------------------------------------------------------------------------------- | ------ |
| `docs/audit/ENVIRONMENT.md`          | Exact versions, PIDs, ports and baseline suite results at audit start           | Create |
| `docs/audit/INVENTORY.md`            | Complete checklist of verifiable behaviours, one row each, with a result column | Create |
| `docs/audit/FINDINGS.md`             | Every defect: id, severity, reproduction, observed, expected, suspected file    | Create |
| `tests/costing.test.ts`              | Domain invariant tests; gains boundary and null-semantics cases                 | Modify |
| `tests/regressions/`                 | One file per fixed defect, named for its finding id                             | Create |
| `server/tests/isolation.test.ts`     | Tenant isolation proven by direct API request across two accounts               | Create |
| `tests/e2e/characterisation.spec.ts` | Current correct behaviour of flows Phase 1 will rewrite                         | Create |
| `scripts/audit-env.mjs`              | Provisions an isolated audit database and two fictional accounts                | Create |
| `HANDOVER.md`                        | Updated to verified reality at phase end                                        | Modify |
| `CODEBASE_REFERENCE.md`              | Corrected wherever the audit contradicts it                                     | Modify |

Source files under `src/` and `server/` are modified only in Pass 3, only to fix a recorded finding.

---

## Task 1: Audit environment and baseline

Establishes a reproducible starting point. Without this, a later failure cannot be distinguished from a stale process.

**Files:**

- Create: `scripts/audit-env.mjs`
- Create: `docs/audit/ENVIRONMENT.md`

**Interfaces:**

- Consumes: nothing.
- Produces: an isolated database at `data/audit.sqlite` containing exactly two accounts, `alpha@audit.local` and `beta@audit.local`, whose generated passwords are written to `data/audit-login.json` (ignored, never printed). Later tasks read that file. Also produces the recorded baseline suite results that Pass 3 compares against.

- [ ] **Step 1: Record versions and running processes**

Run each and paste real output into `docs/audit/ENVIRONMENT.md`:

```bash
cd /Users/dk/Desktop/DEV/TSInteriors/nivo
node -v
agent/.venv/bin/python --version
npx tsc -v
for p in 8787 5178 7880 11434 8081; do
  printf '%s: ' "$p"
  lsof -nP -iTCP:$p -sTCP:LISTEN | awk 'NR==2{print $1" pid="$2}'
  echo
done
git log --oneline -1
```

- [ ] **Step 2: Restart the five services from current source**

The running processes date from the previous session and may not reflect committed source. Restart only these five. Record each new PID in `ENVIRONMENT.md`.

```bash
# Stop only the five known Nivo services, by port, one at a time.
for p in 8787 5178 8081; do
  pid=$(lsof -nP -iTCP:$p -sTCP:LISTEN -t | head -1)
  [ -n "$pid" ] && kill "$pid" && echo "stopped $p pid=$pid"
done
```

LiveKit (7880) and Ollama (11434) hold no application source and may keep running; record that decision. Then restart the app services in background:

```bash
npm run server                      # API on 8787
npm run dev                         # Vite on 5178
DPDFNET_ENABLED=true agent/.venv/bin/python -m agent.worker dev   # worker, health 8081
```

Confirm each is up before continuing:

```bash
curl -fsS http://127.0.0.1:8787/api/health && echo OK-api
curl -fsS -o /dev/null http://127.0.0.1:5178/ && echo OK-vite
curl -fsS -o /dev/null http://127.0.0.1:8081/ && echo OK-worker
```

- [ ] **Step 3: Run every suite and record the true baseline**

Run all seven. Record the exact pass and fail counts in `ENVIRONMENT.md`, including any that fail. A failing baseline suite is itself a finding — record it, do not fix it yet.

```bash
npm run build
npm run check:server
npm test
npm run test:server
npm run test:e2e
npm run format:check
agent/.venv/bin/python -m pytest agent/tests -q
```

- [ ] **Step 4: Write the audit environment provisioning script**

Creates an isolated database so tenant-isolation testing never touches `data/nivo.sqlite`.

```javascript
// scripts/audit-env.mjs
// Provisions an isolated audit database with two fictional accounts.
// Run: node --env-file-if-exists=.env --import tsx scripts/audit-env.mjs
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const DB = 'data/audit.sqlite';
const OUT = 'data/audit-login.json';

mkdirSync('data', { recursive: true });
for (const suffix of ['', '-wal', '-shm']) {
  if (existsSync(DB + suffix)) rmSync(DB + suffix);
}

const accounts = [
  { email: 'alpha@audit.local', studio: 'Alpha Interiors (audit)' },
  { email: 'beta@audit.local', studio: 'Beta Interiors (audit)' },
];

const created = accounts.map(({ email, studio }) => {
  const password = randomBytes(18).toString('base64url');
  execFileSync('node', ['--import', 'tsx', 'server/create-user.ts', email, studio], {
    env: { ...process.env, DATABASE_PATH: DB, NIVO_PASSWORD: password },
    stdio: 'inherit',
  });
  return { email, studio, password };
});

writeFileSync(OUT, JSON.stringify({ database: DB, accounts: created }, null, 2), { mode: 0o600 });
console.log(`Provisioned ${created.length} audit accounts. Credentials: ${OUT} (do not print).`);
```

- [ ] **Step 5: Check whether `create-user.ts` accepts a supplied password**

Read `server/create-user.ts`. The script above assumes it reads `NIVO_PASSWORD` from the environment. If it instead generates its own password and prints it, adapt `audit-env.mjs` to capture stdout rather than supplying a password. Do not modify `create-user.ts` — it is production code and changing it is out of scope.

```bash
cat server/create-user.ts
```

- [ ] **Step 6: Run the provisioning script and confirm isolation**

```bash
node --env-file-if-exists=.env --import tsx scripts/audit-env.mjs
ls -l data/audit.sqlite data/audit-login.json
```

Confirm `data/nivo.sqlite` modification time is unchanged:

```bash
stat -f '%Sm %N' data/nivo.sqlite
```

- [ ] **Step 7: Confirm audit artefacts are ignored by git**

`data/` is already in `.gitignore`. Verify nothing from it is staged:

```bash
git status --short --untracked-files=all | grep -E '^\?\?\s+data/' && echo "PROBLEM: data is visible to git" || echo "OK: data ignored"
```

- [ ] **Step 8: Commit**

```bash
git add scripts/audit-env.mjs docs/audit/ENVIRONMENT.md
git commit -m "Add audit environment provisioning and record baseline state

Provisions an isolated audit database with two fictional accounts so
tenant-isolation checks never touch the persistent studio database.
Records versions, restarted service PIDs and true baseline suite results.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Inventory the frontend surface

**Files:**

- Create: `docs/audit/INVENTORY.md`

**Interfaces:**

- Consumes: nothing.
- Produces: inventory rows with ids `SCR-*`, `CTL-*`, `FLT-*`, `DLG-*`. Every later verification task fills the `Result` column of rows it covers. Ids are stable and referenced by findings.

- [ ] **Step 1: Enumerate the mechanical surface**

```bash
cd /Users/dk/Desktop/DEV/TSInteriors/nivo/src
grep -nE "<button|onClick=" App.tsx components/*.tsx > /tmp/controls.txt
grep -nE "<input|<select|<textarea|<Field" App.tsx components/*.tsx > /tmp/inputs.txt
grep -rnE "useState\(" components/*.tsx | grep -iE "dialog|open|editing|confirm|import|export|delete|match" > /tmp/dialogs.txt
wc -l /tmp/controls.txt /tmp/inputs.txt /tmp/dialogs.txt
```

- [ ] **Step 2: Write the inventory header and screen rows**

Create `docs/audit/INVENTORY.md`. Both operating modes get their own result column, because they use different persistence code.

```markdown
# Nivo behaviour inventory

Derived from source at commit <fill in with `git rev-parse --short HEAD`>.
Result values: PASS, FAIL (with finding id), N/A (with reason), BLOCKED (with reason).

## Screens and routes

| Id     | Route        | Component            | Correct behaviour                                                  | Local | Studio |
| ------ | ------------ | -------------------- | ------------------------------------------------------------------ | ----- | ------ |
| SCR-01 | `#overview`  | `WorkspacePages.tsx` | Renders; next-deadline panel excludes undated projects             |       |        |
| SCR-02 | `#projects`  | `WorkspacePages.tsx` | Lists all projects; selecting one navigates to BOQ                 |       |        |
| SCR-03 | `#boq`       | `BoqPage.tsx`        | Renders selected project; falls back to first project after reload |       |        |
| SCR-04 | `#rates`     | `WorkspacePages.tsx` | Lists rate evidence; expired rates visibly marked                  |       |        |
| SCR-05 | `#vendors`   | `WorkspacePages.tsx` | Lists vendors; supports create and edit                            |       |        |
| SCR-06 | `#enquiries` | `EnquiriesPage.tsx`  | Item selection, vendor brief, voice desk                           |       |        |
| SCR-07 | `#settings`  | `SettingsPage.tsx`   | Defaults, backup, restore, reset, signout                          |       |        |
| SCR-08 | unknown hash | `App.tsx:23`         | Any unrecognised hash falls back to overview                       |       |        |
```

- [ ] **Step 3: Add filter and search rows**

These are the concrete filters found in `BoqPage.tsx:40-42` and `:78-83`.

```markdown
## Filters, search and sort

| Id     | Location                          | Correct behaviour                                                                   | Local | Studio |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------- | ----- | ------ |
| FLT-01 | `BoqPage.tsx:41` category select  | Filtering by a category shows only that category; "All items" shows all             |       |        |
| FLT-02 | `BoqPage.tsx:42` status tab "All" | Shows every item                                                                    |       |        |
| FLT-03 | status tab "Unpriced"             | Shows exactly items where `cost === null`; a zero cost is NOT unpriced              |       |        |
| FLT-04 | status tab "Needs review"         | Shows exactly items where `reviewed === false`                                      |       |        |
| FLT-05 | `BoqPage.tsx:40` search           | Matches description and specification; case-insensitive                             |       |        |
| FLT-06 | combined                          | Category + status + search compose with AND, not OR                                 |       |        |
| FLT-07 | `BoqPage.tsx:366` count           | "N of M items" reflects the filtered and total counts accurately                    |       |        |
| FLT-08 | `BoqPage.tsx:130` project select  | Switching project resets or correctly re-applies filters without showing stale rows |       |        |
```

- [ ] **Step 4: Add dialog rows**

From the `useState` flags at `BoqPage.tsx:38-50` and equivalents in other components.

```markdown
## Dialogs

| Id     | Trigger                  | Correct behaviour                                                    | Local | Studio |
| ------ | ------------------------ | -------------------------------------------------------------------- | ----- | ------ |
| DLG-01 | Project details          | Opens, traps focus, Escape closes, focus returns to trigger          |       |        |
| DLG-02 | Delete project           | Requires explicit confirmation; cancel makes no change               |       |        |
| DLG-03 | Edit item / new item     | Saves changes; cancel discards                                       |       |        |
| DLG-04 | Rate matching            | Lists candidates by `rateCandidates`; applying requires confirmation |       |        |
| DLG-05 | Import workbook          | Full mapping flow; see WBK rows                                      |       |        |
| DLG-06 | Export                   | Offers the three exports; see EXP rows                               |       |        |
| DLG-07 | Pricing / assembly       | Accepts material, labour, other, adjustment                          |       |        |
| DLG-08 | Delete item              | Requires confirmation; removes exactly one item                      |       |        |
| DLG-09 | nested quotation dialogs | Distinct accessible names, per `CODEBASE_REFERENCE.md`               |       |        |
```

- [ ] **Step 5: Add a row per interactive control**

Using `/tmp/controls.txt` and `/tmp/inputs.txt`, add `CTL-*` rows covering every button and input, grouped by component. Controls already covered by a `FLT-*` or `DLG-*` row are cross-referenced rather than duplicated. A control with no reachable trigger is recorded with result `FAIL` and raised as a finding for dead code.

- [ ] **Step 6: Commit**

```bash
cd /Users/dk/Desktop/DEV/TSInteriors/nivo
git add docs/audit/INVENTORY.md
git commit -m "Inventory the Nivo frontend surface

Enumerates screens, routes, filters, search, dialogs and every
interactive control from source, with a result column per operating mode.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Inventory the backend, export and domain surface

**Files:**

- Modify: `docs/audit/INVENTORY.md`

**Interfaces:**

- Consumes: `docs/audit/INVENTORY.md` from Task 2.
- Produces: rows `API-*`, `EXP-*`, `BAK-*`, `VOI-*`, `INV-*`.

- [ ] **Step 1: Add API rows**

The sixteen endpoints registered in `server/app.ts`. Each gets a success row and a rejection row, because an endpoint that fails to reject is a security finding rather than a feature gap.

```markdown
## API endpoints

| Id     | Endpoint                                             | Correct behaviour                                                         | Result |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| API-01 | `GET /api/health`                                    | 200 without authentication                                                |        |
| API-02 | `GET /api/session`                                   | Returns session when authenticated; unauthenticated shape is safe         |        |
| API-03 | `POST /api/login`                                    | Valid credentials set an HttpOnly SameSite=Strict cookie                  |        |
| API-04 | `POST /api/login` wrong password                     | Rejected; no cookie; rate limited on repeat                               |        |
| API-05 | `POST /api/logout`                                   | Invalidates the session; subsequent calls unauthorised                    |        |
| API-06 | `GET /api/workspace`                                 | Returns only the authenticated account's workspace                        |        |
| API-07 | `PUT /api/workspace`                                 | Saves with a matching revision                                            |        |
| API-08 | `PUT /api/workspace` stale revision                  | Returns 409 and does NOT overwrite                                        |        |
| API-09 | `PUT /api/workspace` invalid body                    | Rejected by shared validation, not persisted                              |        |
| API-10 | `PUT /api/files/:id`                                 | Stores workbook bytes; enforces the 10 MB body limit                      |        |
| API-11 | `GET /api/files/:id`                                 | Returns bytes byte-identical to what was stored                           |        |
| API-12 | `GET /api/voice/status`                              | Reports provider availability without leaking any secret                  |        |
| API-13 | `GET /api/calls`                                     | Lists only the authenticated account's calls                              |        |
| API-14 | `GET /api/calls/:id`                                 | Own call returns 200; another account's returns 404 or 403, never content |        |
| API-15 | `POST /api/calls`                                    | Creates a call; a repeated request id is idempotent                       |        |
| API-16 | `POST /api/calls` phone mode                         | Refused while `ENABLE_OUTBOUND_CALLS=false`                               |        |
| API-17 | `POST /api/calls/:id/end`                            | Ends the call; ending an already-ended call is harmless                   |        |
| API-18 | `GET /api/agent/calls/:id`                           | Requires a valid HMAC; returns the brief without internal prices          |        |
| API-19 | `POST /api/agent/events`                             | Valid signature accepted                                                  |        |
| API-20 | `POST /api/agent/events` bad signature               | Rejected 401                                                              |        |
| API-21 | `POST /api/agent/events` replayed event id           | Rejected, does not duplicate the transcript                               |        |
| API-22 | `POST /api/agent/events` expired timestamp           | Rejected outside the five-minute window                                   |        |
| API-23 | `POST /api/agent/events` late event on terminal call | Does NOT reopen the call                                                  |        |
| API-24 | `POST /api/agent/events` null payload                | Returns 400, not 500                                                      |        |
| API-25 | `POST /api/calls/:id/extract`                        | Produces a validated draft or a clear error                               |        |
| API-26 | any mutation without the same-origin header          | Rejected                                                                  |        |
| API-27 | any authenticated route without a cookie             | 401, never partial data                                                   |        |
```

- [ ] **Step 2: Add export, backup and workbook rows**

```markdown
## Exports, backup and workbook

| Id     | Behaviour                                            | Correct behaviour                                                                               | Result |
| ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| EXP-01 | Client quotation export                              | Opens in Excel; contains selling rates; contains NO purchase cost and no original private sheet |        |
| EXP-02 | Internal costing export                              | Opens in Excel; contains costs and selling prices                                               |        |
| EXP-03 | Original workbook export                             | Opens in Excel; unrelated sheets and formulas intact; recalculation requested                   |        |
| EXP-04 | Original export after structural edit                | Refused, per the documented rule that structural edits disable mapping                          |        |
| EXP-05 | Original export with a formula in a mapped rate cell | Refused, naming the exact cell address                                                          |        |
| EXP-06 | Unpriced line in original export                     | Retains its original source cell rather than being blanked                                      |        |
| BAK-01 | JSON backup, local mode                              | Downloads; contains the workspace and base64 workbook                                           |        |
| BAK-02 | JSON restore, local mode                             | Restores to an identical workspace                                                              |        |
| BAK-03 | JSON backup and restore, studio mode                 | Round-trips through the API                                                                     |        |
| BAK-04 | Studio reset                                         | Clears the workspace; documented to leave calls and audit intact                                |        |
| WBK-01 | Import a valid XLSX                                  | Mapping, preview, warnings, then items created                                                  |        |
| WBK-02 | Import over the 10 MB limit                          | Rejected with a clear message                                                                   |        |
| WBK-03 | Import over 10,000 rows or 100 columns               | Rejected with a clear message                                                                   |        |
| WBK-04 | Merged quantity continuation rows                    | Attach to the anchor item, no duplicate line                                                    |        |
| WBK-05 | Zero source rate on import                           | Treated as a placeholder, not as a real zero cost                                               |        |
| WBK-06 | Manually entered zero cost                           | Remains an intentional zero, distinct from unpriced                                             |        |
| WBK-07 | Round trip                                           | Imported bytes retrieved from storage hash-match the original file                              |        |
```

- [ ] **Step 3: Add voice and domain invariant rows**

```markdown
## Voice (browser WebRTC only; no telephone call)

| Id     | Behaviour                | Correct behaviour                                                      | Result |
| ------ | ------------------------ | ---------------------------------------------------------------------- | ------ |
| VOI-01 | Voice status panel       | Reports readiness accurately when the worker is up and when it is down |        |
| VOI-02 | Start browser test call  | Connects; disclosure is spoken and transcribed                         |        |
| VOI-03 | Mute and unmute          | Both take effect                                                       |        |
| VOI-04 | End call                 | Ends; the room is deleted                                              |        |
| VOI-05 | Close the desk mid-setup | Setup cancels; no orphan room is left                                  |        |
| VOI-06 | Enquiry above 20 items   | The voice limit is shown                                               |        |
| VOI-07 | Phone call button        | Gated and refused while outbound calls are disabled                    |        |
| VOI-08 | Second concurrent call   | Refused; one active call per studio                                    |        |
| VOI-09 | Worker down              | Call creation refused rather than hanging                              |        |
| VOI-10 | Extraction draft review  | Draft never changes a price automatically; evidence survives save      |        |

## Domain invariants

| Id     | Invariant                                                               | Result |
| ------ | ----------------------------------------------------------------------- | ------ |
| INV-01 | Null cost is unpriced and distinct from zero cost                       |        |
| INV-02 | Null quantity never silently becomes zero                               |        |
| INV-03 | Rate-only keeps a selling rate and has no line amount                   |        |
| INV-04 | Unknown quantity has no amount and blocks approval                      |        |
| INV-05 | `assemblyCost` rounds `(material+labour+other) × (1+adjustment/100)`    |        |
| INV-06 | `sellingRate` rounds `cost × (1+markup/100)`, markup on cost            |        |
| INV-07 | `markupOverride` takes precedence over project markup                   |        |
| INV-08 | Line amount rounds `quantity × rounded selling rate`                    |        |
| INV-09 | GST applies to the subtotal                                             |        |
| INV-10 | Applying a quote clears review state and assembly                       |        |
| INV-11 | Editing cost, spec, quantity or pricing reopens Draft                   |        |
| INV-12 | Approval requires priced lines, resolved quantities, unexpired evidence |        |
| INV-13 | `applyRate` refuses mismatched units                                    |        |
| INV-14 | `applyRate` refuses expired evidence                                    |        |
| INV-15 | `normalUnit` aliases resolve correctly and do not over-merge            |        |
```

- [ ] **Step 2b: Record two standing hypotheses**

These were spotted while reading `src/lib/costing.ts` and must be checked in Task 4, not assumed:

Add to `docs/audit/FINDINGS.md` under a `Hypotheses` heading, to be confirmed or dismissed:

```markdown
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
```

- [ ] **Step 4: Commit**

```bash
git add docs/audit/INVENTORY.md docs/audit/FINDINGS.md
git commit -m "Inventory the backend, export, voice and domain surface

Adds a success and a rejection row per API endpoint, export and workbook
behaviours, browser voice actions and the fifteen costing invariants.
Records two unconfirmed hypotheses from reading costing.ts.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Verify the costing invariants

Highest value per unit of effort: these are pure functions, fully testable, and they decide whether a quotation is correct.

**Files:**

- Modify: `tests/costing.test.ts`
- Modify: `docs/audit/INVENTORY.md`, `docs/audit/FINDINGS.md`

**Interfaces:**

- Consumes: inventory rows `INV-01` to `INV-15`; hypotheses `H-01`, `H-02`.
- Produces: results for those rows, and a finding per failure.

- [ ] **Step 1: Read the existing tests so cases are not duplicated**

```bash
cat tests/costing.test.ts
```

- [ ] **Step 2: Write invariant tests, including boundaries**

Append to `tests/costing.test.ts`. These assert the documented rules, so a failure is a defect in the source, not in the test.

```typescript
import { describe, expect, it } from 'vitest';
import {
  assemblyCost,
  isStale,
  lineAmount,
  sellingRate,
  totals,
  unitCompatible,
} from '../src/lib/costing';
import type { Item, Project, Rate } from '../src/lib/types';

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1',
  description: 'Test line',
  specification: '',
  category: 'Electrical',
  unit: 'nos',
  quantity: 1,
  cost: 100,
  reviewed: false,
  ...over,
});

describe('costing invariants', () => {
  it('INV-01: zero cost is priced and distinct from null cost', () => {
    expect(sellingRate(item({ cost: 0 }), 20)).toBe(0);
    expect(sellingRate(item({ cost: null }), 20)).toBeNull();
  });

  it('INV-02 and INV-03: a rate-only line has a selling rate but no amount', () => {
    const ro = item({ quantity: null, quantityKind: 'rate-only' });
    expect(sellingRate(ro, 20)).toBe(120);
    expect(lineAmount(ro, 20)).toBeNull();
  });

  it('INV-04: an unknown quantity produces no amount', () => {
    expect(lineAmount(item({ quantity: null, quantityKind: 'unknown' }), 20)).toBeNull();
  });

  it('INV-05: assembly cost applies the adjustment after summing components', () => {
    expect(assemblyCost({ material: 100, labour: 50, other: 10, adjustment: 10 })).toBe(176);
    expect(assemblyCost({ material: 0, labour: 0, other: 0, adjustment: 25 })).toBe(0);
  });

  it('INV-06: markup is applied on cost, not as a gross margin', () => {
    expect(sellingRate(item({ cost: 100 }), 20)).toBe(120);
    expect(sellingRate(item({ cost: 100 }), 0)).toBe(100);
  });

  it('INV-07: a per-item markup override wins over the project markup', () => {
    expect(sellingRate(item({ cost: 100, markupOverride: 50 }), 20)).toBe(150);
    expect(sellingRate(item({ cost: 100, markupOverride: 0 }), 20)).toBe(100);
  });

  it('INV-08: line amount multiplies quantity by the already-rounded selling rate', () => {
    const i = item({ cost: 33.333, quantity: 3 });
    const rate = sellingRate(i, 0)!;
    expect(rate).toBe(33.33);
    expect(lineAmount(i, 0)).toBe(99.99);
  });

  it('INV-13 and INV-15: unit aliases compare correctly without over-merging', () => {
    const rate = (unit: string): Rate => ({ unit }) as Rate;
    expect(unitCompatible(item({ unit: 'sq ft' }), rate('sqft'))).toBe(true);
    expect(unitCompatible(item({ unit: 'nos' }), rate('pcs'))).toBe(true);
    expect(unitCompatible(item({ unit: 'sq ft' }), rate('sq m'))).toBe(false);
    expect(unitCompatible(item({ unit: 'm' }), rate('r ft'))).toBe(false);
  });

  it('H-01: a rate with a blank validity must not be permanently expired', () => {
    const blank = { validUntil: '' } as Rate;
    expect(isStale(blank, '2026-09-23')).toBe(false);
  });
});
```

- [ ] **Step 3: Run and record which assertions fail**

```bash
npm test -- tests/costing.test.ts
```

Expected: most pass. The `H-01` case is expected to FAIL against current source, confirming the hypothesis. Record the true outcome — do not assume this prediction is right.

- [ ] **Step 4: Record results in the inventory and findings**

For each failing assertion, add a finding to `docs/audit/FINDINGS.md`:

```markdown
### F-<nn>: <one-line summary>

- **Severity:** Blocker | Major | Minor
- **Inventory row:** INV-<nn>
- **Reproduction:** `npm test -- tests/costing.test.ts -t '<test name>'`
- **Observed:** <actual value>
- **Expected:** <documented value, quoting the invariant>
- **Suspected file:** `src/lib/costing.ts:<line>`
```

Set each `INV-*` row's result to PASS or FAIL with the finding id.

- [ ] **Step 5: Determine whether H-01 is reachable through the interface**

A failing pure function only matters if a user can create the input. Check whether `RateForm` allows saving a blank validity:

```bash
grep -n "validUntil" src/components/forms.tsx src/lib/validation.ts
```

If blank validity is impossible to save, downgrade H-01 to Minor and note it as defence-in-depth. If it is possible, it is a Blocker.

- [ ] **Step 6: Commit the tests, not yet the fixes**

The failing tests are committed deliberately: they are the evidence. Mark them with `it.fails` only if the suite must stay green for other work; otherwise leave them failing and note it in the commit message.

```bash
git add tests/costing.test.ts docs/audit/INVENTORY.md docs/audit/FINDINGS.md
git commit -m "Verify costing invariants and record failures

Adds boundary and null-semantics tests for the fifteen documented costing
invariants. Records which fail against current source as findings; fixes
follow in Pass 3.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Verify security and tenant isolation

Done before Phase 1 because Phase 1 multiplies the consequence of any weakness here.

**Files:**

- Create: `server/tests/isolation.test.ts`
- Modify: `docs/audit/INVENTORY.md`, `docs/audit/FINDINGS.md`

**Interfaces:**

- Consumes: `data/audit-login.json` from Task 1; inventory rows `API-01` to `API-27`.
- Produces: results for those rows; a failure here is a Blocker by definition.

- [ ] **Step 1: Read the existing backend tests to match their harness style**

```bash
sed -n '1,60p' server/tests/api.test.ts
```

Reuse the existing app-construction and login helpers rather than inventing a second harness.

- [ ] **Step 2: Write the isolation test**

Proves isolation by direct request, not by absence of a link in the interface.

```typescript
// server/tests/isolation.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Import the same helpers api.test.ts uses to build an app and log in.
// Adjust these names to match that file exactly after reading it in Step 1.
import { buildTestApp, login } from './helpers.ts';

test('a second account cannot read the first account workspace', async () => {
  const app = await buildTestApp();
  const alpha = await login(app, 'alpha@audit.local');
  const beta = await login(app, 'beta@audit.local');

  const saved = await app.inject({
    method: 'PUT',
    url: '/api/workspace',
    headers: alpha.headers,
    payload: { revision: 0, workspace: alpha.workspace },
  });
  assert.equal(saved.statusCode, 200);

  const stolen = await app.inject({ method: 'GET', url: '/api/workspace', headers: beta.headers });
  assert.equal(stolen.statusCode, 200);
  assert.notDeepEqual(JSON.parse(stolen.body).workspace, alpha.workspace);

  await app.close();
});

test('a second account cannot read the first account files by id', async () => {
  const app = await buildTestApp();
  const alpha = await login(app, 'alpha@audit.local');
  const beta = await login(app, 'beta@audit.local');

  const bytes = Buffer.from('PK fictional workbook bytes');
  const put = await app.inject({
    method: 'PUT',
    url: '/api/files/wb-alpha-1',
    headers: alpha.headers,
    payload: bytes,
  });
  assert.equal(put.statusCode, 200);

  const theft = await app.inject({
    method: 'GET',
    url: '/api/files/wb-alpha-1',
    headers: beta.headers,
  });
  assert.notEqual(theft.statusCode, 200, 'another account must not receive the file');

  await app.close();
});

test('a stale revision is rejected and does not overwrite', async () => {
  const app = await buildTestApp();
  const alpha = await login(app, 'alpha@audit.local');

  const first = await app.inject({
    method: 'PUT',
    url: '/api/workspace',
    headers: alpha.headers,
    payload: { revision: 0, workspace: alpha.workspace },
  });
  assert.equal(first.statusCode, 200);

  const stale = await app.inject({
    method: 'PUT',
    url: '/api/workspace',
    headers: alpha.headers,
    payload: { revision: 0, workspace: { ...alpha.workspace, projects: [] } },
  });
  assert.equal(stale.statusCode, 409);

  const after = await app.inject({ method: 'GET', url: '/api/workspace', headers: alpha.headers });
  assert.notDeepEqual(JSON.parse(after.body).workspace.projects, []);

  await app.close();
});

test('a mutation without the same-origin header is rejected', async () => {
  const app = await buildTestApp();
  const alpha = await login(app, 'alpha@audit.local');
  const headers = { ...alpha.headers };
  delete (headers as Record<string, string>)['x-nivo-request'];

  const res = await app.inject({
    method: 'PUT',
    url: '/api/workspace',
    headers,
    payload: { revision: 0, workspace: alpha.workspace },
  });
  assert.notEqual(res.statusCode, 200);

  await app.close();
});
```

Note: the custom header name is a guess. Confirm the real one before running:

```bash
grep -n "headers\[" server/app.ts | head -20
grep -rn "x-nivo\|requestHeader\|csrf" server/app.ts src/lib/api.ts
```

- [ ] **Step 3: Run the isolation tests**

```bash
npm run test:server
```

Record the result of each `API-*` row. Any isolation failure is a Blocker and stops other verification until triaged.

- [ ] **Step 4: Verify cookie attributes directly**

```bash
curl -si -X POST http://127.0.0.1:8787/api/login \
  -H 'content-type: application/json' \
  -H 'x-nivo-request: 1' \
  --data '{"email":"alpha@audit.local","password":"<read from data/audit-login.json, never print>"}' \
  | grep -i 'set-cookie'
```

Confirm `HttpOnly` and `SameSite=Strict` are present. In development `Secure` is expected absent; record that as expected, not as a finding.

- [ ] **Step 5: Verify no secret leaks through voice status**

```bash
curl -fsS http://127.0.0.1:8787/api/voice/status -H 'cookie: <session>' \
  | grep -iE 'key|secret|token|password' && echo "FINDING: secret in response" || echo "OK: no secret"
```

- [ ] **Step 6: Commit**

```bash
git add server/tests/isolation.test.ts docs/audit/INVENTORY.md docs/audit/FINDINGS.md
git commit -m "Prove tenant isolation and session security by direct request

Adds cross-account workspace and file access tests, stale-revision
rejection and same-origin header enforcement, exercised through the API
rather than through the interface.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Verify workbook import, export and round trip

The exports are the product's output. A corrupt export passes a click test and fails a real one, so every export is opened and inspected.

**Files:**

- Modify: `docs/audit/INVENTORY.md`, `docs/audit/FINDINGS.md`
- Create: `tests/regressions/` entries only if a defect is found

**Interfaces:**

- Consumes: inventory rows `EXP-01` to `EXP-06`, `WBK-01` to `WBK-07`, `BAK-01` to `BAK-04`.
- Produces: results for those rows.

- [ ] **Step 1: Create a fictional source workbook**

Do not use the Raisina file for destructive tests. Build a fixture containing the awkward cases deliberately: a merged quantity continuation row, a zero source rate, an RO line, a blank quantity, and a formula in a rate cell.

```bash
cd /Users/dk/Desktop/DEV/TSInteriors/nivo
node --import tsx -e "
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('BOQ');
ws.addRow(['Ref','Description','Unit','Qty','Rate','Amount']);
ws.addRow(['1.1','Modular switch 6A','nos',10,0,null]);
ws.addRow(['1.2','Conduit 25mm','m',null,125,null]);
ws.addRow(['1.3','Rate only item','nos',null,0,null]);
const f = ws.addRow(['1.4','Formula rate line','nos',5,null,null]);
f.getCell(5).value = { formula: 'D5*2' };
ws.mergeCells('A6:A7');
ws.addRow(['1.5','Merged anchor','sq ft',100,0,null]);
ws.addRow(['','continuation description','','','','']);
await wb.xlsx.writeFile('/tmp/nivo-audit-fixture.xlsx');
console.log('written');
"
```

- [ ] **Step 2: Import it through the interface and check the preview**

In the browser at `http://127.0.0.1:5178`, open a project, use the import dialog, map the columns, and check against rows `WBK-01`, `WBK-04`, `WBK-05`. Record what the preview claims and what the items actually become.

Specifically confirm: the zero rate at row 2 does NOT become a zero cost (`WBK-05`), and the merged rows 6 and 7 produce ONE item, not two (`WBK-04`).

- [ ] **Step 3: Verify the file round trip byte-for-byte**

```bash
shasum -a 256 /tmp/nivo-audit-fixture.xlsx
# then download the stored copy through the authenticated file endpoint and hash it
curl -fsS http://127.0.0.1:8787/api/files/<id> -H 'cookie: <session>' -o /tmp/nivo-roundtrip.xlsx
shasum -a 256 /tmp/nivo-roundtrip.xlsx
```

The two hashes must be identical (`WBK-07`). A mismatch is a Blocker: the stored original is what the export patches.

- [ ] **Step 4: Produce all three exports and open each**

Price a few lines first so the exports have content. Then export all three and inspect each file's actual contents, not just that a download occurred:

```bash
node --import tsx -e "
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(process.argv[1]);
wb.eachSheet(s => {
  console.log('SHEET', s.name, 'rows', s.rowCount);
  s.eachRow((r,n) => { if (n<12) console.log(n, JSON.stringify(r.values)); });
});
" /tmp/<downloaded-export>.xlsx
```

For `EXP-01`, confirm no purchase cost and no private sheet appear anywhere in the output. This is the single most damaging possible defect in the product: a client seeing your margins.

- [ ] **Step 5: Verify the two documented export refusals**

`EXP-05`: the fixture's formula rate cell must cause the original export to refuse and name the cell address. `EXP-04`: delete an item, then confirm the original export refuses.

- [ ] **Step 6: Verify backup and restore in both modes**

Back up, reset, restore, and compare the workspace before and after. They must be identical (`BAK-01` to `BAK-04`).

- [ ] **Step 7: Record every result and commit**

```bash
git add docs/audit/INVENTORY.md docs/audit/FINDINGS.md
git commit -m "Verify workbook import, exports and backup round trip

Exercises import mapping against a fixture built with merged continuation
rows, a zero source rate, a rate-only line and a formula rate cell. Opens
every produced export and inspects contents rather than trusting the
download.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Verify the local demo mode walkthrough

**Files:**

- Modify: `docs/audit/INVENTORY.md`, `docs/audit/FINDINGS.md`

**Interfaces:**

- Consumes: all `SCR-*`, `CTL-*`, `FLT-*`, `DLG-*` rows; fills the `Local` column.
- Produces: the Local result for each.

- [ ] **Step 1: Start from a clean local workspace**

In the browser, choose the explicit local-demo option on the `StudioAccess` screen. Clear storage first so seed behaviour is exercised from scratch:

```javascript
// In the browser console at http://127.0.0.1:5178
localStorage.removeItem('nivo.workspace.v1');
indexedDB.deleteDatabase('keyval-store');
location.reload();
```

- [ ] **Step 2: Walk every screen and record**

Visit `#overview`, `#projects`, `#boq`, `#rates`, `#vendors`, `#enquiries`, `#settings`, then an unrecognised hash such as `#nonsense` to check the `SCR-08` fallback. Record PASS or FAIL per row.

- [ ] **Step 3: Exercise every filter combination**

For `FLT-01` to `FLT-08`, the critical case is `FLT-03`: create one item with `cost: 0` and one with `cost: null`, then confirm the "Unpriced" tab shows only the null one. If it shows both, that is a Blocker — it means the interface conflates free-of-charge with not-yet-priced.

Confirm `FLT-06` by applying a category, a status and a search term together and checking the result is the intersection.

Confirm `FLT-08` by switching projects with filters active.

- [ ] **Step 4: Exercise every dialog including keyboard behaviour**

For each `DLG-*` row: open it, press Tab repeatedly to confirm focus stays inside, press Escape, and confirm focus returns to the element that opened it. Record failures individually.

- [ ] **Step 5: Exercise every remaining control**

Work through the `CTL-*` rows. For each, confirm the observable effect, not merely that no error appears. Any control with no reachable trigger becomes a dead-code finding.

- [ ] **Step 6: Check persistence and the phone layout**

Reload and confirm state survives. Then resize to 390px wide and confirm the dedicated phone BOQ item layout appears below 600px and that tables contain their own overflow rather than scrolling the page.

- [ ] **Step 7: Commit**

```bash
git add docs/audit/INVENTORY.md docs/audit/FINDINGS.md
git commit -m "Verify local demo mode across every screen, filter and dialog

Records the Local result for each inventory row, including keyboard focus
behaviour per dialog and the zero-versus-null cost distinction in the
unpriced filter.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Verify the signed-in studio walkthrough

Same surface, different persistence path. Skipping this because local mode passed would miss every sync, revision and file defect.

**Files:**

- Modify: `docs/audit/INVENTORY.md`, `docs/audit/FINDINGS.md`

**Interfaces:**

- Consumes: the same rows as Task 7; fills the `Studio` column.
- Produces: the Studio result for each.

- [ ] **Step 1: Sign in as the audit account**

Point the API at the audit database so the persistent studio is untouched. Restart the API with an overridden path, recording the PID:

```bash
DATABASE_PATH=data/audit.sqlite npm run server
```

Sign in as `alpha@audit.local` using the password in `data/audit-login.json`. Never print it.

- [ ] **Step 2: Repeat Steps 2 to 6 of Task 7 against the studio**

Record the Studio column. Differences between the two columns are the interesting output of this task.

- [ ] **Step 3: Verify sync-specific behaviour that local mode cannot exercise**

- Make a change and confirm it persists across a full reload.
- Open the same account in two browser tabs, edit in both, and confirm the second save produces the documented 409 conflict freeze rather than silent data loss.
- Confirm that after a failed sync, pending state remains exportable, as `CODEBASE_REFERENCE.md` claims.
- Sign out and confirm the workspace is no longer reachable.

- [ ] **Step 4: Record the blob-persistence consequence as a deferred finding**

The two-tab conflict is expected behaviour today and a Phase 1 problem. Record it explicitly:

```markdown
### F-<nn>: Concurrent editing within one firm is not possible

- **Severity:** Major, DEFERRED TO PHASE 1
- **Reproduction:** Open the same account in two tabs, edit a different project in each, save both.
- **Observed:** The second save returns 409 and freezes automatic writes.
- **Expected for Phase 1:** Two members of one firm editing different projects must not conflict.
- **Cause:** The workspace is a single JSON blob with one revision counter, so every edit conflicts with every other edit regardless of what it touched.
- **Resolution:** Row-level persistence in Phase 1. Not fixable in Phase 0 without the restructuring this phase excludes.
```

- [ ] **Step 5: Commit**

```bash
git add docs/audit/INVENTORY.md docs/audit/FINDINGS.md
git commit -m "Verify signed-in studio mode and record sync behaviour

Fills the Studio result column, exercises revision conflict across two
tabs, and records single-blob persistence as a Major finding deferred to
Phase 1 rather than patched here.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Verify the voice desk over browser WebRTC

**Files:**

- Modify: `docs/audit/INVENTORY.md`, `docs/audit/FINDINGS.md`

**Interfaces:**

- Consumes: inventory rows `VOI-01` to `VOI-10`.
- Produces: results for those rows. `VOI-07` verifies a refusal, not a call.

- [ ] **Step 1: Confirm outbound calling is disabled before doing anything**

```bash
grep -n 'ENABLE_OUTBOUND_CALLS' .env
```

If it is anything other than `false`, stop and set it to `false`. No telephone call is placed in this phase under any circumstance.

- [ ] **Step 2: Confirm the worker is healthy and check the status panel**

```bash
curl -fsS http://127.0.0.1:8081/ && echo OK-worker
curl -fsS http://127.0.0.1:8787/api/voice/status -H 'cookie: <session>'
```

Compare against what the interface shows (`VOI-01`).

- [ ] **Step 3: Run the existing synthetic smoke to confirm the pipeline still works**

```bash
agent/.venv/bin/python -m agent.smoke_session
```

Expected: exit 0 with a `status: passed` payload. Record the actual transcript turn count and received audio seconds. Do not treat a room being created as success — only the printed `passed` status counts.

- [ ] **Step 4: Exercise the browser voice controls**

Create a fictional vendor and an enquiry, then use "Test in browser". Verify `VOI-02` to `VOI-05`: connect, disclosure transcribed, mute, unmute, end, and cancelling mid-setup.

For `VOI-05`, confirm no orphan room remains:

```bash
curl -fsS http://127.0.0.1:8787/api/calls -H 'cookie: <session>' | head -40
```

- [ ] **Step 5: Verify the gates and limits**

- `VOI-06`: build an enquiry with more than 20 items and confirm the limit message.
- `VOI-07`: confirm the phone call button is refused while outbound is disabled.
- `VOI-08`: start a call, then attempt a second; confirm refusal.
- `VOI-09`: stop the worker, attempt a call, confirm prompt refusal rather than a hang, then restart the worker.

- [ ] **Step 6: Verify extraction never changes a price automatically**

Run extraction against the completed call and confirm the draft appears for review, that no item cost changed without explicit confirmation, and that evidence survives saving through `RateForm` (`VOI-10`).

```bash
agent/.venv/bin/python -m agent.smoke_audio
node --import tsx scripts/smoke-extraction.ts
```

- [ ] **Step 7: Commit**

```bash
git add docs/audit/INVENTORY.md docs/audit/FINDINGS.md
git commit -m "Verify browser voice desk, gates and extraction review

Exercises connect, mute, end, mid-setup cancellation, the twenty-item
limit, concurrent-call refusal and worker-down refusal. Confirms
extraction drafts never alter a price without explicit confirmation.
No telephone call was placed; outbound calling stayed disabled.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Fix findings, one commit per fix

Repeat this task's procedure once per finding, Blockers first, then Majors, then cheap Minors.

**Files:**

- Create: `tests/regressions/F-<nn>.test.ts` or the suite appropriate to the layer
- Modify: the source file responsible
- Modify: `docs/audit/FINDINGS.md`

**Interfaces:**

- Consumes: `docs/audit/FINDINGS.md`.
- Produces: a fixed source tree and a regression test per fix.

- [ ] **Step 1: Pick the highest-severity open finding**

Work strictly in severity order. A Blocker is never deferred behind a Minor.

- [ ] **Step 2: Write a test that reproduces it**

The test asserts the documented correct behaviour. Place it in `tests/regressions/F-<nn>.test.ts` for domain defects, `server/tests/` for API defects, or `tests/e2e/` for interface defects.

- [ ] **Step 3: Prove the test fails against the parent commit**

This is the step that makes the test meaningful. A test written after a fix passes for the wrong reason.

```bash
git stash push --include-untracked -- src server
npm test -- tests/regressions/F-<nn>.test.ts
# Expected: FAIL
git stash pop
```

If it passes here, the test does not actually detect the defect. Rewrite it before continuing.

- [ ] **Step 4: Fix the cause, not the symptom**

Change the responsible source file. If the fix requires restructuring that belongs to Phase 1, stop, mark the finding DEFERRED with a written reason, and move to the next finding.

- [ ] **Step 5: Confirm the test now passes and nothing else broke**

```bash
npm test
npm run test:server
npm run build
```

- [ ] **Step 6: Update the finding and commit**

Mark the finding FIXED with the commit hash, or DEFERRED with a reason.

```bash
git add tests/regressions/F-<nn>.test.ts <changed source> docs/audit/FINDINGS.md
git commit -m "Fix F-<nn>: <summary>

<What was wrong, why it mattered, what changed.>

Regression test fails against the parent commit and passes here.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Return to Step 1 until no Blocker or Major remains open**

---

## Task 11: Characterisation tests for the Phase 1 rewrite surface

Describes current correct behaviour so Phase 1 has a safety net. Deliberately narrow: only what Phase 1 replaces.

**Files:**

- Create: `tests/e2e/characterisation.spec.ts`

**Interfaces:**

- Consumes: verified behaviour from Tasks 5 and 8.
- Produces: tests Phase 1 must keep passing, or consciously and explicitly update.

- [ ] **Step 1: Write characterisation tests for persistence and auth**

Only these four areas: workspace save and load, revision conflict, file storage and retrieval, session and authorisation. Nothing else.

```typescript
// tests/e2e/characterisation.spec.ts
import { expect, test } from '@playwright/test';

// These describe behaviour as it exists today, before the Phase 1 tenancy
// rewrite. If Phase 1 changes one deliberately, update it deliberately and
// say so in the commit. An unexplained failure here means Phase 1 broke
// something it did not intend to touch.

test('a saved workspace survives a full reload', async ({ page }) => {
  await page.goto('/');
  // Sign in using the audit account; credentials come from the environment,
  // never from a literal in this file.
  await page.getByLabel('Email').fill(process.env.AUDIT_EMAIL!);
  await page.getByLabel('Password').fill(process.env.AUDIT_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.getByRole('link', { name: /vendors/i }).click();
  await page.getByRole('button', { name: /add vendor/i }).click();
  await page.getByLabel('Name').fill('Characterisation Vendor');
  await page.getByRole('button', { name: /save/i }).click();

  await page.reload();
  await expect(page.getByText('Characterisation Vendor')).toBeVisible();
});

test('a second concurrent editor is refused rather than overwriting', async ({ browser }) => {
  const one = await browser.newContext();
  const two = await browser.newContext();
  // Both contexts sign in as the same account, each edits, second save conflicts.
  // Fill in using the same sign-in steps as above.
  // The documented behaviour today is a 409 conflict freeze, NOT a silent merge.
  await one.close();
  await two.close();
});
```

Complete the second test body using the sign-in helper from the first, rather than leaving it partial.

- [ ] **Step 2: Run against the audit database**

```bash
AUDIT_EMAIL=alpha@audit.local AUDIT_PASSWORD=<from data/audit-login.json> \
  DATABASE_PATH=data/audit.sqlite npm run test:e2e -- tests/e2e/characterisation.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/characterisation.spec.ts
git commit -m "Add characterisation tests for the Phase 1 rewrite surface

Describes current workspace persistence, revision conflict, file storage
and session behaviour so the tenancy rewrite has a safety net. Narrow by
design: covers only what Phase 1 replaces.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Final gate and truthful documentation

**Files:**

- Modify: `HANDOVER.md`, `CODEBASE_REFERENCE.md`, `docs/audit/INVENTORY.md`, `docs/audit/FINDINGS.md`

**Interfaces:**

- Consumes: everything above.
- Produces: the phase's exit evidence, and the deferred-findings list that Phase 1's spec consumes.

- [ ] **Step 1: Confirm no inventory row is unrecorded**

```bash
grep -nE '^\| (SCR|CTL|FLT|DLG|API|EXP|BAK|WBK|VOI|INV)-' docs/audit/INVENTORY.md \
  | grep -E '\|\s*\|\s*$|\|\s*\|\s*\|\s*$' \
  && echo "PROBLEM: unrecorded rows above" || echo "OK: every row recorded"
```

Any row still blank must gain a result or a written reason.

- [ ] **Step 2: Confirm no Blocker or Major is open**

```bash
grep -nE '\*\*Severity:\*\*' docs/audit/FINDINGS.md | grep -vE 'FIXED|DEFERRED'
```

Expected: no output.

- [ ] **Step 3: Run every suite and record the true result**

```bash
npm run build
npm run check:server
npm test
npm run test:server
npm run test:e2e
npm run format:check
agent/.venv/bin/python -m pytest agent/tests -q
npm audit --omit=dev
```

Every one must pass. If one does not, that is an open finding and the phase is not complete.

- [ ] **Step 4: Rewrite the HANDOVER checkpoint truthfully**

Replace the current checkpoint with what was actually verified in this phase. State plainly what remains untested: PSTN, Hindi, public deployment, multi-user. Claim nothing beyond the evidence recorded in `docs/audit/`.

- [ ] **Step 5: Correct CODEBASE_REFERENCE where the audit contradicts it**

Any claim the audit disproved is corrected, with the correction noted. Documentation that overstates readiness is itself a defect in a product being handed to real firms.

- [ ] **Step 6: Produce the Phase 1 input list**

Add to `docs/audit/FINDINGS.md` a closing section listing every DEFERRED finding, which is the direct input to the Phase 1 spec.

- [ ] **Step 7: Commit and report**

```bash
git add -A docs HANDOVER.md CODEBASE_REFERENCE.md
git commit -m "Close Phase 0: record verified state and deferred findings

Every inventory row has a recorded result. No Blocker or Major remains
open except those deferred to Phase 1 with a written reason. All suites
pass. Documentation corrected where the audit contradicted it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage.** Pass 1 inventory is Tasks 2 and 3. Pass 2 verification is Tasks 4 to 9, covering both operating modes as the spec requires. Pass 3 fix-and-lock is Tasks 10 and 11, with the spec's selective test policy encoded in Task 11's narrowness. The spec's money-correctness section is Task 4. Its security section is Task 5. All five exit criteria are Task 12's steps 1, 2, 3, 4 and the regression requirement enforced in Task 10 Step 3. The spec's four risks are addressed: structural findings route to Phase 1 (Task 8 Step 4, Task 10 Step 4), the inventory is frozen after Task 3, services restart from current source in Task 1 Step 2, and voice is scoped to WebRTC only in Task 9 Step 1.

**Known soft spots, deliberately left.** Task 5's helper import names and the custom request header name are marked as requiring confirmation from source before use, with the exact command to confirm them, because inventing names that do not exist would be worse than an explicit check. Task 1 Step 5 similarly verifies the `create-user.ts` interface before depending on it. Task 2 Step 5 and Task 7 Step 5 expand per-control rows at execution time rather than listing 102 rows here; the enumeration command is given and the acceptance rule is explicit.

**Type consistency.** `sellingRate`, `lineAmount`, `assemblyCost`, `isStale`, `unitCompatible` and `totals` are used with the signatures in `src/lib/costing.ts`. `Item`, `Project` and `Rate` match `src/lib/types.ts`. Finding ids are `F-<nn>` throughout; inventory ids keep their prefixes consistently across Tasks 2, 3 and 12's verification greps.
