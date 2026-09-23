# Phase 0 Audit — Environment and Baseline

Branch: `phase0-audit`. All commands run in a non-login shell (Bash tool default; no
`zsh -l`/profile sourcing), so `node -v` correctly reports 22.14 rather than the
login-shell default of Node 18.

Step order follows Controller Ruling P-01: `create-user.ts` was read and
`scripts/audit-env.mjs` was written and run to provision the isolated audit
database _before_ the app services were restarted, and the API was restarted
pointed at `data/audit.sqlite` rather than the default `data/nivo.sqlite`. This
guarantees the audit API never opens the real studio database.

## Step 1 — Versions and processes at session start

```
$ node -v
v22.14.0
$ agent/.venv/bin/python --version
Python 3.13.9
$ npx tsc -v
Version 5.9.3
```

Ports at session start (processes left running by a previous session):

| Port  | Process   | PID   |
| ----- | --------- | ----- |
| 8787  | node      | 27573 |
| 5178  | node      | 26009 |
| 7880  | livekit-s | 25676 |
| 11434 | ollama    | 25677 |
| 8081  | python3.1 | 27275 |

```
$ git log --oneline -1
1a1cc65 Add Phase 0 implementation plan
```

`engines.node` in `package.json` says `>=22.22`; the installed 22.14 is a known,
accepted mismatch and was left unchanged, per task instructions.

## `server/create-user.ts` — the real interface (Step 5 of the brief, done first per Ruling P-01)

Read verbatim, not modified. Actual behavior:

- Takes `email` (argv[2]) and `studio` (remaining argv joined) as positional args.
- Does **not** read a `NIVO_PASSWORD` env var, and does **not** generate/print its own
  password. It prompts interactively on stdin via `node:readline/promises`:
  `"New password (12+ characters; input is visible, use a private terminal): "`.
- Writes to `database(process.env.DATABASE_PATH || './data/nivo.sqlite')`.
- `addUser()` (in `server/db.ts`) validates email format, studio non-empty, and
  password length >= 12 chars, throwing otherwise.

Neither of the two behaviors the brief's Step 4 script assumed (`NIVO_PASSWORD` env
var, or script-generated/printed password) matches the real interface. So
`scripts/audit-env.mjs` was adapted to:

1. Generate the password itself (`randomBytes(18).toString('base64url')`, 24 chars,
   comfortably over the 12-char minimum) — same as the brief intended.
2. Feed that password to the child process's **stdin** (`input: password + '\n'`,
   `stdio: ['pipe','inherit','inherit']`) instead of passing it as an env var, since
   `create-user.ts` only reads the password interactively from stdin.
3. Set `DATABASE_PATH=data/audit.sqlite` in the child's env so the account is written
   to the isolated audit database, never `data/nivo.sqlite`.
4. `create-user.ts` itself was not modified — it remains production code, untouched.

## Step 6 (provisioning) — isolation confirmed

```
$ node --env-file-if-exists=.env --import tsx scripts/audit-env.mjs
New password (...): Studio account created.
New password (...): Studio account created.
Provisioned 2 audit accounts. Credentials: data/audit-login.json (do not print).

$ ls -l data/audit.sqlite data/audit-login.json
-rw-------  1 dk  staff  69632  data/audit.sqlite
-rw-------  1 dk  staff    329  data/audit-login.json
```

`data/audit.sqlite` contains exactly the two expected accounts (verified via a
one-off query selecting only the `email` column — no password material read or
printed):

```
[{"email":"alpha@audit.local"},{"email":"beta@audit.local"}]
```

### `data/nivo.sqlite` — mtime evidence, including an honest caveat

mtime before touching anything, and again immediately after provisioning
`data/audit.sqlite` (before any service was stopped):

```
$ stat -f '%Sm %N' data/nivo.sqlite
Sep 23 00:23:09 2026 data/nivo.sqlite        # before provisioning
Sep 23 00:23:09 2026 data/nivo.sqlite        # after provisioning, unchanged
```

Provisioning alone did not touch `data/nivo.sqlite` — confirmed unchanged at that
point.

**However**, when checked again later (during Step 3's suite run, at which point
no stat had been taken in between), its mtime had changed, to
`Sep 23 02:17:16 2026`. No `stat` was captured immediately before and after the
Step 2 `kill` of the _inherited, previous-session_ API process (pid 27573, which
predates this task and was never under this task's control) — that is a real gap
in the evidence, not something this document should paper over. What follows is
this task's best explanation for the change, and it is **strongly supported by
mechanism and by elimination, not by a captured before/after observation at the
moment of the kill itself**:

- Mechanism, confirmed by reading the code: `server/db.ts` opens every database
  with `PRAGMA journal_mode=WAL`; `server/index.ts` registers `SIGTERM`/`SIGINT`
  handlers that call `app.close()`, which (via Fastify's `onClose`) calls
  `db.close()` whenever the app was not constructed with an external `options.db`
  (`server/app.ts` line ~468: `if (!options.db) db.close()`). An SQLite
  connection's last close in WAL mode performs a checkpoint, folding
  already-committed WAL frames into the main file and removing the `-wal`/`-shm`
  sidecars.
- Elimination, confirmed by reading the test suites rather than assumed: pid
  27573 predates this task, so if it held a connection open on the default
  `./data/nivo.sqlite` (its `DATABASE_PATH` was never set by this task, so it can
  only have used the code's default), that connection's close on `SIGTERM` is the
  only write-adjacent event this task's timeline contains that touches that path.
  `server/tests/api.test.ts` opens `database(':memory:')` for every case, so
  `npm run test:server` cannot have touched it; no other suite (`build`,
  `check:server`, `npm test`, `test:e2e`, `format:check`, `pytest`) opens a
  database file at all. No command run by this task ever set `DATABASE_PATH` to
  anything but `data/audit.sqlite`, and no script in this task references the
  default path.
- Circumstantial corroboration, not proof: no `-wal`/`-shm` sidecar files remain
  next to `data/nivo.sqlite` (consistent with a clean checkpoint-on-close having
  happened at some point); its size is unchanged at 425984 bytes, identical to
  `data/backups/nivo-2026-09-22T19-00-15-456Z.sqlite` from earlier the same
  session. A byte-level SHA-256 of the live file does differ from that backup,
  which is expected either way — a WAL checkpoint can reorder pages on disk even
  when the checkpointed transactions were already committed — so the hash
  mismatch is not evidence for or against this task having written anything.

**What this document does NOT claim:** that the mtime change is verified to have
happened at the moment of the Step 2 kill. It was observed only as a difference
between "immediately after provisioning" and "sometime during or before Step 3,"
a roughly two-hour window with no intermediate checkpoint. The attribution to
pid 27573's shutdown is inference by elimination plus a code-grounded mechanism,
not a captured observation, and the missing before/after timestamp at the kill
itself cannot be recovered after the fact. What this document does claim, and
what the evidence does support directly: no command executed by this task ever
opened, queried, or wrote `data/nivo.sqlite` at any point.

Net: this task performed no read or write of its own against `data/nivo.sqlite`
at any point (the API always ran against `data/audit.sqlite`, per Ruling P-01).
The one observed mtime change is attributable to Step 2's explicit instruction to
stop the previous session's inherited server process, which triggered that
process's own ordinary WAL checkpoint of data it (not this task) had already
written before this task began. Recorded here in full rather than glossed over,
since the brief's own concern is exactly this kind of accidental write.

## Step 7 — git ignores audit artefacts

```
$ git status --short --untracked-files=all | grep -E '^\?\?\s+data/' && echo "PROBLEM: data is visible to git" || echo "OK: data ignored"
OK: data ignored
```

`data/` is listed in `.gitignore` (line 10). `data/audit.sqlite` and
`data/audit-login.json` are both untracked and untrackable.

## Step 2 (moved after provisioning, per Ruling P-01) — service restart

Stopped the three Nivo application services (by port, one at a time):

```
stopped 8787 pid=27573
stopped 5178 pid=26009
stopped 8081 pid=27275
```

LiveKit (7880, pid 25676) and Ollama (11434, pid 25677) hold no application source
and were left running, per task instructions.

Restarted, with the API explicitly pointed at the isolated audit database:

```
DATABASE_PATH=data/audit.sqlite npm run server   &   # API on 8787
npm run dev                                      &   # Vite on 5178
DPDFNET_ENABLED=true agent/.venv/bin/python -m agent.worker dev   &   # worker, health 8081
```

New PIDs and confirmed the API process actually carries the env var:

| Port | Process   | New PID | Notes                                                                         |
| ---- | --------- | ------- | ----------------------------------------------------------------------------- |
| 8787 | node      | 34523   | `DATABASE_PATH=data/audit.sqlite` confirmed present in process env (`ps eww`) |
| 5178 | node      | 34555   | default Vite dev server                                                       |
| 8081 | python3.1 | 34561   | `agent.worker dev`, `DPDFNET_ENABLED=true`                                    |

Health checks, all green:

```
$ curl -fsS http://127.0.0.1:8787/api/health && echo OK-api
{"ok":true,"storage":"ready"} OK-api
$ curl -fsS -o /dev/null http://127.0.0.1:5178/ && echo OK-vite
OK-vite
$ curl -fsS -o /dev/null http://127.0.0.1:8081/ && echo OK-worker
OK-worker
```

`ENABLE_OUTBOUND_CALLS` was not touched and remains `false` throughout (no
telephone calls were placed at any point in this task).

## Step 3 — true baseline of all seven suites

Run with the audit API/Vite/worker up (against `data/audit.sqlite`), LiveKit and
Ollama left running from the previous session.

| #   | Suite               | Command                                           | Result   | Detail                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------- | ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Build               | `npm run build`                                   | **PASS** | `tsc -b && vite build` — exit 0, 499 modules transformed, built in 2.49s. (Bundle-size warning only, not a failure: several chunks >500kB, e.g. `exceljs.min` 940kB.)                                                                                                                                                                                                                                   |
| 2   | Server typecheck    | `npm run check:server`                            | **PASS** | `tsc --noEmit -p server/tsconfig.json` — exit 0, no output.                                                                                                                                                                                                                                                                                                                                             |
| 3   | Frontend unit tests | `npm test`                                        | **PASS** | vitest — 3 test files passed (3), 14 tests passed (14).                                                                                                                                                                                                                                                                                                                                                 |
| 4   | Server tests        | `npm run test:server`                             | **PASS** | Node test runner — 4/4 tests passed, 0 failed. (Two subtests log an expected `API request failed POST /api/calls Error` line as part of negative-path testing, not a suite failure.)                                                                                                                                                                                                                    |
| 5   | E2E tests           | `npm run test:e2e`                                | **PASS** | Playwright — 12/12 passed in 23.1s. `playwright.config.ts` uses `webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5178', reuseExistingServer: true }`, so it reused the already-running Vite dev server, which proxies API calls to the audit-pointed API on 8787 — meaning e2e's own writes (e.g. the workbook-import test) also landed in `data/audit.sqlite`, never `data/nivo.sqlite`.   |
| 6   | Format check        | `npm run format:check`                            | **FAIL** | `prettier --check .` — exit 1. 16 files flagged, all planning/doc content: 13 files under `.superpowers/sdd/2026-09-23-phase0-audit/`, `docs/superpowers/plans/2026-09-23-phase0-audit.md`, `docs/superpowers/specs/2026-09-23-phase0-audit-design.md`, `docs/TELEPHONY_RESEARCH.md`. **None are product source or under `scripts/`/`server/`/`src/`.** Recorded as a true baseline finding, not fixed. |
| 7   | Agent pytest        | `agent/.venv/bin/python -m pytest agent/tests -q` | **PASS** | 6 passed in 1.21s.                                                                                                                                                                                                                                                                                                                                                                                      |

### Summary

6 of 7 suites pass: build, check:server, npm test, test:server, test:e2e, pytest.
1 suite fails at baseline: `format:check` (prettier), confined to planning/doc
markdown files, not product source. This is a true, recorded baseline finding —
not fixed in this task, per instructions.

## Secrets handling

`data/audit-login.json` (containing the two generated audit passwords) was
created with mode `0600` and was never printed, `cat`'d, or pasted into this
document or any commit. Only non-secret metadata (emails, file sizes, mtimes)
appears above. `ENABLE_OUTBOUND_CALLS` was not touched and no telephone call was
placed at any point.

## Completed-audit runtime checkpoint, 23 September 2026

The historical baseline above has been superseded. Domain/backend/browser/Python suites now pass with 23/22/16/6 tests respectively; build, backend typecheck, formatting, vulnerability audits and the 218-row disposition gate pass. Live English browser voice passed; a later unverifiable extraction was safely rejected. See HANDOVER.md for exact evidence and limitations.

After audit completion and a verified consistent backup, the API was restarted on **real `data/nivo.sqlite`**, last PID 52134. Vite 34555, worker 49203, LiveKit 49290 and Ollama 49293 were healthy at the checkpoint. Recheck before stopping processes. **Switch the API explicitly to `data/audit.sqlite` before any audit fixtures or resets.** The real-studio browser verification passed without modifying client workspace/workbook content; normal authentication records were created. No public deployment or telephone call occurred.
