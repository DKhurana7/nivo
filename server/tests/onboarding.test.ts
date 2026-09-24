import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database, addUser } from '../db';
import { makeApp } from '../app';

test('tour is claimed once per account across sessions, without changing workspace revisions', async () => {
  const db = database(':memory:');
  const a = addUser(db, 'tour-a@example.test', 'synthetic test password', 'A');
  const b = addUser(db, 'tour-b@example.test', 'synthetic test password', 'B');
  const app = makeApp({ db });
  const headers = { 'x-nivo-request': '1' };
  const login = async (email: string) => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers,
      payload: { email, password: 'synthetic test password' },
    });
    assert.equal(r.statusCode, 200);
    return { ...headers, cookie: `nivo_session=${r.cookies[0].value}` };
  };
  try {
    const before = db.prepare('SELECT * FROM workspaces ORDER BY user_id').all();
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/api/onboarding',
          headers,
          payload: { action: 'start' },
        })
      ).statusCode,
      401,
    );
    const auth = await login('tour-a@example.test');
    const request = {
      method: 'POST' as const,
      url: '/api/onboarding',
      headers: auth,
      payload: { action: 'start' },
    };
    assert.equal(
      (await app.inject({ ...request, headers: { cookie: auth.cookie } })).statusCode,
      403,
    );
    assert.equal((await app.inject({ ...request, payload: { action: 'reset' } })).statusCode, 400);
    const claims = await Promise.all([app.inject(request), app.inject(request)]);
    assert.deepEqual(claims.map((r) => r.json().showTour).sort(), [false, true]);
    // A body-supplied foreign ID cannot alter the authenticated account scope.
    await app.inject({ ...request, payload: { action: 'skipped', userId: b } });
    assert.equal(
      (db.prepare('SELECT status FROM onboarding WHERE user_id=?').get(a) as any).status,
      'skipped',
    );
    assert.equal(db.prepare('SELECT status FROM onboarding WHERE user_id=?').get(b), undefined);
    const again = await login('tour-a@example.test');
    assert.equal((await app.inject({ ...request, headers: again })).json().showTour, false);
    const second = await login('tour-b@example.test');
    assert.equal((await app.inject({ ...request, headers: second })).json().showTour, true);
    await app.inject({ ...request, headers: second, payload: { action: 'completed' } });
    assert.equal((await app.inject({ ...request, headers: second })).json().showTour, false);
    assert.deepEqual(db.prepare('SELECT * FROM workspaces ORDER BY user_id').all(), before);
    assert.equal((db.prepare('SELECT count(*) n FROM calls').get() as any).n, 0);
  } finally {
    await app.close();
    db.close();
  }
});

test('opening a pre-tour database adds account memory without altering existing records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nivo-onboarding-'));
  const path = join(dir, 'old.sqlite');
  const old = database(path);
  const id = addUser(old, 'legacy@example.test', 'legacy synthetic password', 'Legacy');
  old.exec('DROP TABLE onboarding');
  const before = old.prepare('SELECT * FROM workspaces').all();
  old.close();
  const migrated = database(path);
  try {
    assert.deepEqual(migrated.prepare('SELECT * FROM workspaces').all(), before);
    assert.equal(migrated.prepare('SELECT * FROM onboarding WHERE user_id=?').get(id), undefined);
    migrated.prepare("INSERT INTO onboarding VALUES(?,'seen',?)").run(id, Date.now());
    assert.equal(migrated.prepare('SELECT count(*) n FROM users').get()?.n, 1);
  } finally {
    migrated.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
