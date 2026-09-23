import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { addUser, database } from '../db';
import { snapshotDatabase } from '../backup';

test('live WAL backup and restoration preserve all server tables and workbook bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nivo-recovery-'));
  const source = join(dir, 'live.sqlite');
  const db = database(source);
  try {
    const uid = addUser(db, 'recovery@example.test', 'private recovery password', 'Recovery');
    db.prepare('INSERT INTO files VALUES(?,?,?)').run(
      uid,
      'workbook',
      Buffer.from([0, 255, 23, 11]),
    );
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('hashed-token', uid, 123456);
    db.prepare('INSERT INTO audit VALUES(?,?,?,?)').run('audit-id', uid, 'login', 1234);
    db.prepare(
      'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,transcript,drafts,request_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      'call-id',
      uid,
      'enquiry-id',
      'browser',
      'ended',
      'room',
      1,
      2,
      '{}',
      '[{"role":"user","text":"Quote"}]',
      '[]',
      'request-id',
    );
    db.prepare('INSERT INTO events VALUES(?,?,?)').run('event-id', 'call-id', 2);
    // Source remains open with WAL writes while the snapshot is taken.
    const backup = snapshotDatabase(source, join(dir, 'backup.sqlite'));
    db.prepare('UPDATE users SET company=? WHERE id=?').run('Later edit', uid);
    const restoredPath = snapshotDatabase(backup, join(dir, 'restored.sqlite'));
    const restored = new DatabaseSync(restoredPath, { readOnly: true });
    const snapshot = new DatabaseSync(backup, { readOnly: true });
    try {
      for (const table of ['users', 'sessions', 'workspaces', 'files', 'calls', 'events', 'audit'])
        assert.deepEqual(
          restored.prepare(`SELECT * FROM ${table}`).all(),
          snapshot.prepare(`SELECT * FROM ${table}`).all(),
        );
      assert.equal(restored.prepare('SELECT company FROM users').get()?.company, 'Recovery');
      assert.deepEqual(
        Buffer.from(restored.prepare('SELECT bytes FROM files').get()!.bytes as Uint8Array),
        Buffer.from([0, 255, 23, 11]),
      );
      assert.equal(statSync(restoredPath).mode & 0o777, 0o600);
    } finally {
      restored.close();
      snapshot.close();
    }
    assert.equal(
      readdirSync(dir).some((name) => name.startsWith('.nivo-snapshot-')),
      false,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('recovery refuses existing databases and sidecars without changing their bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nivo-recovery-'));
  const source = join(dir, 'source.sqlite');
  database(source).close();
  try {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const target = join(dir, `target-${suffix || 'db'}.sqlite`);
      writeFileSync(target + suffix, 'keep this');
      assert.throws(() => snapshotDatabase(source, target), /already exists/);
      assert.equal(readFileSync(target + suffix, 'utf8'), 'keep this');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('recovery rejects missing, corrupt, incomplete and referentially broken sources', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nivo-recovery-'));
  try {
    const target = join(dir, 'restored.sqlite');
    assert.throws(() => snapshotDatabase(join(dir, 'missing.sqlite'), target));
    writeFileSync(join(dir, 'corrupt.sqlite'), 'not a database');
    assert.throws(() => snapshotDatabase(join(dir, 'corrupt.sqlite'), target));
    const empty = new DatabaseSync(join(dir, 'empty.sqlite'));
    empty.close();
    assert.throws(() => snapshotDatabase(join(dir, 'empty.sqlite'), target), /complete Nivo/);
    const broken = database(join(dir, 'broken.sqlite'));
    broken.exec("PRAGMA foreign_keys=OFF; INSERT INTO sessions VALUES('token','missing-user',1)");
    broken.close();
    assert.throws(() => snapshotDatabase(join(dir, 'broken.sqlite'), target), /foreign-key/);
    assert.equal(readdirSync(dir).includes('restored.sqlite'), false);
    assert.equal(readdirSync(dir).includes('missing.sqlite'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
