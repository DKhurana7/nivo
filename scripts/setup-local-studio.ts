/** One-time local bootstrap. No external account or email is created. Refuses existing studios. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { database, addUser } from '../server/db';
import { validateWorkspace } from '../src/lib/validation';
import type { Workspace } from '../src/lib/types';
const backupPath = process.argv[2];
const email = process.argv[3] || 'owner@nivo.local';
if (!backupPath)
  throw new Error('Pass a prepared Nivo backup path and optional local login email.');
const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
if (backup.format !== 'nivo-backup-v1' || !validateWorkspace(backup.workspace))
  throw new Error('Invalid Nivo backup.');
const workspace: Workspace = backup.workspace;
const files = workspace.projects
  .filter((p) => p.workbookId)
  .map((p) => {
    const value = backup.workbooks?.[p.workbookId!];
    if (typeof value !== 'string') throw new Error('Original workbook is missing.');
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 2).toString() !== 'PK')
      throw new Error('Invalid source workbook.');
    return { id: p.workbookId!, bytes };
  });
const credentials = resolve('data/local-studio-login.json');
if (existsSync(credentials))
  throw new Error('Local credentials already exist; refusing to replace them.');
const db = database(process.env.DATABASE_PATH || './data/nivo.sqlite');
let written = false;
try {
  db.exec('BEGIN IMMEDIATE');
  if ((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n)
    throw new Error('A studio already exists. Sign in and import through Settings instead.');
  const password = randomBytes(24).toString('base64url');
  const id = addUser(db, email, password, backup.workspace.settings.company);
  db.prepare('UPDATE workspaces SET data=? WHERE user_id=?').run(
    JSON.stringify(backup.workspace),
    id,
  );
  for (const file of files)
    db.prepare('INSERT INTO files VALUES(?,?,?)').run(id, file.id, file.bytes);
  db.prepare('INSERT INTO audit VALUES(?,?,?,?)').run(
    randomUUID(),
    id,
    'studio.local-bootstrap',
    Date.now(),
  );
  mkdirSync('data', { recursive: true, mode: 0o700 });
  writeFileSync(
    credentials,
    JSON.stringify({ email, password, url: 'http://127.0.0.1:5178' }, null, 2),
    { flag: 'wx', mode: 0o600 },
  );
  written = true;
  db.exec('COMMIT');
  console.log(
    `Local studio created with ${backup.workspace.projects.length} project(s). Login details saved privately in ${credentials}.`,
  );
} catch (error) {
  db.exec('ROLLBACK');
  if (written) unlinkSync(credentials);
  throw error;
} finally {
  db.close();
}
