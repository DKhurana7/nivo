import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
const path = process.argv[2];
if (!path) throw new Error('Pass a private backup output directory.');
mkdirSync(path, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(process.env.DATABASE_PATH || './data/nivo.sqlite');
const target = resolve(path, `nivo-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
db.prepare('VACUUM INTO ?').run(target);
chmodSync(target, 0o600);
db.close();
console.log(
  'Consistent SQLite backup created, including workspaces, files, calls and account data.',
);
