// Prepare only the fictional Phase 0 account, never the retained Raisina studio.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { seedWorkspace } from '../src/lib/seed.ts';
const login = JSON.parse(readFileSync('data/audit-login.json', 'utf8'));
assert.equal(login.database, 'data/audit.sqlite');
const account = login.accounts.find((a) => a.email === 'alpha@audit.local');
const base = 'http://127.0.0.1:8787/api';
const headers = { 'X-Nivo-Request': '1', 'Content-Type': 'application/json', 'X-Forwarded-For':'198.18.1.5' };
const response = await fetch(`${base}/login`, {
  method: 'POST',
  headers,
  body: JSON.stringify(account),
});
assert.equal(response.status, 200);
headers.Cookie = response.headers.getSetCookie()[0].split(';')[0];
const status = await (await fetch(`${base}/voice/status`, { headers })).json();
assert.equal(status.outboundEnabled, false);
const current = await (await fetch(`${base}/workspace`, { headers })).json();
const workspace = seedWorkspace();
workspace.settings.company = 'Fictional audit studio';
workspace.projects[0].name = 'Synthetic electrical conversation';
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
    id: 'audit-voice-enquiry',
    projectId: 'p1',
    vendorId: 'v1',
    itemIds: ['synthetic-cable'],
    status: 'Prepared',
    createdAt: new Date().toISOString().slice(0, 10),
    notes: 'Synthetic browser test only. Do not call a phone number.',
    transcript: '',
  },
];
const save = await fetch(`${base}/workspace`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ revision: current.revision, workspace }),
});
assert.equal(save.status, 200);
writeFileSync(
  'data/audit-voice-login.json',
  JSON.stringify({ ...account, enquiryId: 'audit-voice-enquiry' }),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    fixture: 'fictional audit account',
    outboundEnabled: status.outboundEnabled,
    reachable: status.reachable,
    agentVerified: status.agentVerified,
  }),
);
