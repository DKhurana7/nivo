import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = 'docs/audit/INVENTORY.md';
const rows = (text) =>
  text
    .split('\n')
    .filter((line) => /^\| (?:SCR|FLT|DLG|CTL|API|VOI|INV|EXP|BAK|WBK)-\d+\s*\|/.test(line))
    .map((line) =>
      line
        .split(/(?<!\\)\|/)
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
const before = rows(execFileSync('git', ['show', `f9460ae:${path}`], { encoding: 'utf8' }));
const after = rows(readFileSync(path, 'utf8'));
assert.equal(after.length, 218, 'Inventory must remain frozen at 218 rows');
assert.equal(new Set(after.map((row) => row[0])).size, 218, 'Duplicate inventory IDs');
for (let i = 0; i < after.length; i++) {
  const results = /^(SCR|FLT|DLG|CTL)-/.test(after[i][0]) ? 2 : 1;
  assert.deepEqual(
    after[i].slice(0, -results),
    before[i].slice(0, -results),
    `Frozen behaviour changed: ${after[i][0]}`,
  );
  for (const result of after[i].slice(-results))
    assert.match(result, /^(PASS|N\/A|FAIL|BLOCKED)\b/, `Unrecorded result: ${after[i][0]}`);
}
const findings = readFileSync('docs/audit/FINDINGS.md', 'utf8');
const open = findings
  .split('\n')
  .filter((line) => line.includes('**Severity:**') && !/FIXED|DEFERRED/.test(line));
assert.deepEqual(open, [], 'Unresolved findings require an explicit disposition');
console.log('218 frozen inventory rows have recorded results; no undisposed findings.');
