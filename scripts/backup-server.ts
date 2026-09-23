import { resolve } from 'node:path';
import { snapshotDatabase } from '../server/backup';
const path = process.argv[2];
if (!path) throw new Error('Pass a private backup output directory.');
const target = resolve(path, `nivo-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
snapshotDatabase(process.env.DATABASE_PATH || './data/nivo.sqlite', target);
console.log(
  'Consistent SQLite backup created, including workspaces, files, calls and account data.',
);
