import { DatabaseSync } from 'node:sqlite';
import {
  chmodSync,
  closeSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const tables = ['users', 'sessions', 'workspaces', 'files', 'calls', 'events', 'audit'];

function checkDatabase(db: DatabaseSync) {
  const integrity = db.prepare('PRAGMA integrity_check').all();
  if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok')
    throw new Error('Database integrity check failed.');
  if (db.prepare('PRAGMA foreign_key_check').all().length)
    throw new Error('Database contains broken foreign-key references.');
  const present = new Set(
    db
      .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
      .all()
      .map((row) => row.name),
  );
  if (tables.some((table) => !present.has(table)))
    throw new Error('Source is not a complete Nivo server database.');
}

function requireAbsent(path: string) {
  try {
    lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  throw new Error('Destination or SQLite sidecar already exists. Use a new database path.');
}

function syncPath(path: string) {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

// SQLite reads committed WAL data while the source stays open. Publish only a
// checked, private snapshot; a hard link atomically refuses an existing target.
export function snapshotDatabase(source: string, destination: string) {
  const target = resolve(destination);
  for (const suffix of ['', '-wal', '-shm', '-journal']) requireAbsent(target + suffix);
  const db = new DatabaseSync(resolve(source), { readOnly: true });
  let temporary: string | undefined;
  try {
    checkDatabase(db);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    temporary = mkdtempSync(join(dirname(target), '.nivo-snapshot-'));
    const staged = join(temporary, 'snapshot.sqlite');
    db.prepare('VACUUM INTO ?').run(staged);
    chmodSync(staged, 0o600);
    const snapshot = new DatabaseSync(staged, { readOnly: true });
    try {
      checkDatabase(snapshot);
    } finally {
      snapshot.close();
    }
    syncPath(staged);
    for (const suffix of ['', '-wal', '-shm', '-journal']) requireAbsent(target + suffix);
    linkSync(staged, target);
    syncPath(dirname(target));
    return target;
  } finally {
    db.close();
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}
