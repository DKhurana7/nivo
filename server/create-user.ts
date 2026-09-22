import { createInterface } from 'node:readline/promises';
import { database, addUser } from './db';
const email = process.argv[2],
  company = process.argv.slice(3).join(' ');
if (!email || !company) {
  console.error('Usage: npm run user:create -- email@example.com "Studio name"');
  process.exit(1);
}
// Read from stdin; never put a password in shell arguments/history.
const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question(
  'New password (12+ characters; input is visible, use a private terminal): ',
);
rl.close();
const db = database(process.env.DATABASE_PATH || './data/nivo.sqlite');
try {
  addUser(db, email, password, company);
  console.log('Studio account created.');
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  db.close();
}
