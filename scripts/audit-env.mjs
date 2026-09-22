// scripts/audit-env.mjs
// Provisions an isolated audit database with two fictional accounts.
//
// NOTE on adaptation from the original brief: the brief assumed
// server/create-user.ts either reads a NIVO_PASSWORD env var, or generates
// and prints its own password. Neither is true. The real create-user.ts
// (read verbatim, not modified) takes email + studio name as argv, then
// prompts interactively via readline on stdin for the password (12+ chars,
// visible input, "never put a password in shell arguments/history"). It
// writes to DATABASE_PATH (default ./data/nivo.sqlite).
//
// So this script generates the password itself (as the brief intended) and
// feeds it to the child process's stdin, rather than passing it as an env
// var or reading it back from stdout.
//
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
  const password = randomBytes(18).toString('base64url'); // 24 chars, well over the 12-char minimum
  execFileSync('node', ['--import', 'tsx', 'server/create-user.ts', email, studio], {
    env: { ...process.env, DATABASE_PATH: DB },
    // create-user.ts prompts interactively on stdin for the password; feed
    // it there instead of via an env var. Inherit stdout/stderr so failures
    // are visible, but never echo the password itself into this script's
    // own output.
    input: password + '\n',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  return { email, studio, password };
});

writeFileSync(OUT, JSON.stringify({ database: DB, accounts: created }, null, 2), { mode: 0o600 });
console.log(`Provisioned ${created.length} audit accounts. Credentials: ${OUT} (do not print).`);
