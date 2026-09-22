/** Ephemeral synthetic studio for local integration verification; no real project data. */
import { makeApp } from '../server/app';
import { database, addUser } from '../server/db';
import { randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { seedWorkspace } from '../src/lib/seed';
const db = database(':memory:'),
  password = randomBytes(24).toString('hex'),
  email = 'voice-test@example.test';
const id = addUser(db, email, password, 'Nivo Test Studio');
const workspace = seedWorkspace();
workspace.settings.company = 'Nivo Test Studio';
workspace.projects[0].name = 'Synthetic electrical test';
workspace.projects[0].items = [
  {
    id: 'synthetic-cable',
    description: 'FRLS copper cable',
    specification: '2.5 sq mm, supply only',
    category: 'Electrical',
    unit: 'm',
    quantity: 100,
    quantityKind: 'measured',
    cost: null,
    reviewed: false,
  },
];
workspace.enquiries = [
  {
    id: 'voice-test-enquiry',
    projectId: workspace.projects[0].id,
    vendorId: workspace.vendors[0].id,
    itemIds: [workspace.projects[0].items[0].id],
    status: 'Prepared',
    createdAt: '2026-09-22',
    notes: 'Synthetic internal browser test. Do not call any phone number.',
    transcript: '',
  },
];
db.prepare('UPDATE workspaces SET data=? WHERE user_id=?').run(JSON.stringify(workspace), id);
mkdirSync('data', { recursive: true });
writeFileSync(
  'data/voice-test-login.json',
  JSON.stringify({ email, password, enquiryId: 'voice-test-enquiry' }),
  { mode: 0o600 },
);
const app = makeApp({ db });
await app.listen({ port: 8787, host: '127.0.0.1' });
console.log('Ephemeral voice-test API ready. Credentials in private ignored data file.');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(
    signal,
    () =>
      void app.close().then(() => {
        db.close();
        process.exit(0);
      }),
  );
