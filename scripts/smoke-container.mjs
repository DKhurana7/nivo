// Run an isolated production image with a fresh anonymous volume and no network.
// No host env, secrets, database or provider credentials are passed into it.
import { execFileSync } from 'node:child_process';

const image = process.argv[2] || 'nivo-app:release-check';
execFileSync(
  'docker',
  [
    'run',
    '--rm',
    '-i',
    '--network',
    'none',
    '--mount',
    'type=volume,destination=/app/data',
    '--entrypoint',
    'node',
    image,
    '--import',
    'tsx',
    '--input-type=module',
  ],
  {
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
    input: `
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { database, addUser } from './server/db.ts';
import { makeApp } from './server/app.ts';
assert.notEqual(process.getuid(), 0, 'App must run as a non-root user');
assert.equal(existsSync('/app/.env'), false);
const db = database('/app/data/nivo.sqlite');
const password = randomBytes(24).toString('hex');
addUser(db, 'container@example.test', password, 'Container smoke');
const app = makeApp({ db, production: true });
try {
  assert.equal((await app.inject('/api/health')).statusCode, 200);
  const home = await app.inject('/');
  assert.equal(home.statusCode, 200);
  assert.match(home.headers['content-security-policy'], /font-src 'self'/);
  assert.match(home.body, /<div id="root">/);
  const login = await app.inject({ method: 'POST', url: '/api/login', headers: { 'x-nivo-request': '1' }, payload: { email: 'container@example.test', password } });
  assert.equal(login.statusCode, 200);
  assert.match(login.headers['set-cookie'], /Secure/);
  const headers = { 'x-nivo-request': '1', cookie: 'nivo_session=' + login.cookies[0].value };
  const workspace = (await app.inject({ url: '/api/workspace', headers })).json();
  workspace.workspace.settings.company = 'Persisted container';
  assert.equal((await app.inject({ method: 'PUT', url: '/api/workspace', headers, payload: workspace })).statusCode, 200);
  const bytes = Buffer.from([80, 75, 0, 255]);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/files/fixture', headers: { ...headers, 'content-type': 'application/octet-stream' }, payload: bytes })).statusCode, 200);
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/backup-server.ts', '/app/data/backups'], { stdio: 'pipe' });
  const { readdirSync } = await import('node:fs');
  const backup = '/app/data/backups/' + readdirSync('/app/data/backups')[0];
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/restore-server.ts', backup, '/app/data/restored.sqlite'], { stdio: 'pipe' });
  const restored = database('/app/data/restored.sqlite');
  try {
    for (const table of ['users', 'sessions', 'workspaces', 'files', 'calls', 'events', 'audit'])
      assert.deepEqual(restored.prepare('SELECT * FROM ' + table).all(), db.prepare('SELECT * FROM ' + table).all());
  } finally { restored.close(); }
  console.log('PASS: non-root production image, built assets/CSP, login, persistent save/file, backup and restore; isolated network and volume.');
} finally { await app.close(); db.close(); }
`,
  },
);
