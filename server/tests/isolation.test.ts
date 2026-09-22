// Task 5 (Phase 0 audit): tenant isolation and session security, proven by direct API
// request rather than by absence of a link in the interface.
//
// Harness note: server/tests/api.test.ts has no separate helpers.ts — it builds the app
// and logs in inline (database(':memory:'), addUser, makeApp({db})). Per Controller
// Ruling P-03 this file reuses that exact inline pattern rather than inventing a second
// harness or fabricating a helpers.ts that doesn't exist.
//
// Real same-origin header confirmed at server/app.ts:102 as `x-nivo-request: 1`
// (the brief's guess matched). Confirmed by:
//   grep -n "headers\[" server/app.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { makeApp } from '../app';
import { database, addUser } from '../db';
import { seedWorkspace } from '../../src/lib/seed';

const headers = { 'x-nivo-request': '1' };

async function loginAs(app: ReturnType<typeof makeApp>, email: string, password: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers,
    payload: { email, password },
  });
  assert.equal(res.statusCode, 200, `login for ${email} must succeed`);
  const cookie = res.cookies[0].value;
  return { ...headers, cookie: `nivo_session=${cookie}` };
}

// ---------------------------------------------------------------------------
// API-06 / API-11: cross-account workspace and file isolation
// ---------------------------------------------------------------------------

test('API-06: a second account cannot read the first account workspace', async () => {
  const db = database(':memory:');
  addUser(db, 'alpha@example.test', 'alpha private password', 'Alpha Studio');
  addUser(db, 'beta@example.test', 'beta private password', 'Beta Studio');
  const app = makeApp({ db });
  try {
    const alpha = await loginAs(app, 'alpha@example.test', 'alpha private password');
    const beta = await loginAs(app, 'beta@example.test', 'beta private password');

    const alphaWorkspace = seedWorkspace();
    alphaWorkspace.settings.company = 'Alpha Secret Studio';

    const saved = await app.inject({
      method: 'PUT',
      url: '/api/workspace',
      headers: alpha,
      payload: { revision: 0, workspace: alphaWorkspace },
    });
    assert.equal(saved.statusCode, 200);

    // Would pass trivially if tenant scoping were removed and both accounts shared one
    // workspace row: beta must see BETA's own (distinct, unmodified) workspace, not alpha's.
    const stolen = await app.inject({ method: 'GET', url: '/api/workspace', headers: beta });
    assert.equal(stolen.statusCode, 200);
    const betaWorkspace = JSON.parse(stolen.body).workspace;
    assert.notEqual(betaWorkspace.settings.company, 'Alpha Secret Studio');
    assert.equal(betaWorkspace.settings.company, 'Beta Studio');
  } finally {
    await app.close();
    db.close();
  }
});

test('API-11: a second account cannot read the first account files by id', async () => {
  const db = database(':memory:');
  addUser(db, 'alpha@example.test', 'alpha private password', 'Alpha Studio');
  addUser(db, 'beta@example.test', 'beta private password', 'Beta Studio');
  const app = makeApp({ db });
  try {
    const alpha = await loginAs(app, 'alpha@example.test', 'alpha private password');
    const beta = await loginAs(app, 'beta@example.test', 'beta private password');

    const bytes = Buffer.from('PK fictional workbook bytes');
    const put = await app.inject({
      method: 'PUT',
      url: '/api/files/wb-alpha-1',
      headers: { ...alpha, 'content-type': 'application/octet-stream' },
      payload: bytes,
    });
    assert.equal(put.statusCode, 200);

    // Round-trip for the owner: bytes must be byte-identical.
    const own = await app.inject({ method: 'GET', url: '/api/files/wb-alpha-1', headers: alpha });
    assert.equal(own.statusCode, 200);
    assert.ok(Buffer.from(own.rawPayload).equals(bytes));

    const theft = await app.inject({
      method: 'GET',
      url: '/api/files/wb-alpha-1',
      headers: beta,
    });
    assert.equal(theft.statusCode, 404, 'another account must not receive the file, not even a 403 that confirms existence vs 404 that does not');
  } finally {
    await app.close();
    db.close();
  }
});

// ---------------------------------------------------------------------------
// API-13 / API-14: cross-account call isolation
// ---------------------------------------------------------------------------

test('API-13/API-14: a second account cannot list or fetch the first account calls', async () => {
  const db = database(':memory:');
  const aliceId = addUser(db, 'alice@example.test', 'alice private password', 'Alice Studio');
  addUser(db, 'bob@example.test', 'bob private password', 'Bob Studio');
  const app = makeApp({ db });
  try {
    const alice = await loginAs(app, 'alice@example.test', 'alice private password');
    const bob = await loginAs(app, 'bob@example.test', 'bob private password');

    const callId = randomUUID();
    db.prepare(
      'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
    ).run(callId, aliceId, 'e1', 'browser', 'ended', 'room-1', Date.now(), Date.now(), '{}', 'req-1');

    // If tenant scoping were removed, bob's list would include alice's call.
    const bobList = await app.inject({ method: 'GET', url: '/api/calls', headers: bob });
    assert.equal(bobList.statusCode, 200);
    assert.deepEqual(JSON.parse(bobList.body), []);

    const aliceList = await app.inject({ method: 'GET', url: '/api/calls', headers: alice });
    assert.equal(aliceList.statusCode, 200);
    assert.equal(JSON.parse(aliceList.body).length, 1);

    const bobGet = await app.inject({ method: 'GET', url: `/api/calls/${callId}`, headers: bob });
    assert.equal(bobGet.statusCode, 404, 'a call id belonging to another account must not resolve');

    const aliceGet = await app.inject({ method: 'GET', url: `/api/calls/${callId}`, headers: alice });
    assert.equal(aliceGet.statusCode, 200);
  } finally {
    await app.close();
    db.close();
  }
});

// ---------------------------------------------------------------------------
// API-08: stale revision rejected, does not overwrite
// ---------------------------------------------------------------------------

test('API-08: a stale revision is rejected and does not overwrite', async () => {
  const db = database(':memory:');
  addUser(db, 'carol@example.test', 'carol private password', 'Carol Studio');
  const app = makeApp({ db });
  try {
    const carol = await loginAs(app, 'carol@example.test', 'carol private password');
    const ws = seedWorkspace();

    const first = await app.inject({
      method: 'PUT',
      url: '/api/workspace',
      headers: carol,
      payload: { revision: 0, workspace: ws },
    });
    assert.equal(first.statusCode, 200);
    assert.equal(JSON.parse(first.body).revision, 1);

    // Replay the same (now stale) revision with a mutated payload.
    const staleWs = { ...ws, settings: { ...ws.settings, company: 'Overwritten' } };
    const stale = await app.inject({
      method: 'PUT',
      url: '/api/workspace',
      headers: carol,
      payload: { revision: 0, workspace: staleWs },
    });
    assert.equal(stale.statusCode, 409);

    const after = await app.inject({ method: 'GET', url: '/api/workspace', headers: carol });
    assert.notEqual(JSON.parse(after.body).workspace.settings.company, 'Overwritten');
  } finally {
    await app.close();
    db.close();
  }
});

// ---------------------------------------------------------------------------
// API-09: invalid workspace body rejected, not persisted
// ---------------------------------------------------------------------------

test('API-09: an invalid workspace body is rejected and not persisted', async () => {
  const db = database(':memory:');
  addUser(db, 'dave@example.test', 'dave private password', 'Dave Studio');
  const app = makeApp({ db });
  try {
    const dave = await loginAs(app, 'dave@example.test', 'dave private password');

    const bad = await app.inject({
      method: 'PUT',
      url: '/api/workspace',
      headers: dave,
      payload: { revision: 0, workspace: { not: 'a workspace' } },
    });
    assert.equal(bad.statusCode, 400);

    const after = await app.inject({ method: 'GET', url: '/api/workspace', headers: dave });
    assert.equal(JSON.parse(after.body).revision, 0, 'the rejected write must not have advanced the revision');
  } finally {
    await app.close();
    db.close();
  }
});

// ---------------------------------------------------------------------------
// API-26: mutation without the same-origin header is rejected
// ---------------------------------------------------------------------------

test('API-26: a mutation without the same-origin header is rejected', async () => {
  const db = database(':memory:');
  addUser(db, 'erin@example.test', 'erin private password', 'Erin Studio');
  const app = makeApp({ db });
  try {
    const erin = await loginAs(app, 'erin@example.test', 'erin private password');
    const headersNoOrigin = { ...erin } as Record<string, string>;
    delete headersNoOrigin['x-nivo-request'];

    const res = await app.inject({
      method: 'PUT',
      url: '/api/workspace',
      headers: headersNoOrigin,
      payload: { revision: 0, workspace: seedWorkspace() },
    });
    assert.equal(res.statusCode, 403, 'omitting x-nivo-request must be rejected, not silently accepted');

    const after = await app.inject({ method: 'GET', url: '/api/workspace', headers: erin });
    assert.equal(JSON.parse(after.body).revision, 0, 'the rejected write must not have persisted');
  } finally {
    await app.close();
    db.close();
  }
});

// ---------------------------------------------------------------------------
// API-27: authenticated routes without a cookie return 401, never partial data
// ---------------------------------------------------------------------------

test('API-27: authenticated routes without a cookie return 401 and no data', async () => {
  const db = database(':memory:');
  addUser(db, 'frank@example.test', 'frank private password', 'Frank Studio');
  const app = makeApp({ db });
  try {
    for (const req of [
      { method: 'GET' as const, url: '/api/session' },
      { method: 'GET' as const, url: '/api/workspace' },
      { method: 'GET' as const, url: '/api/calls' },
      { method: 'GET' as const, url: '/api/files/anything' },
      { method: 'GET' as const, url: '/api/voice/status' },
    ]) {
      const res = await app.inject({ ...req, headers });
      assert.equal(res.statusCode, 401, `${req.method} ${req.url} without a cookie must be 401`);
      const body = JSON.parse(res.body);
      assert.ok(!('workspace' in body) && !('id' in body), `${req.url} must not leak partial data alongside the 401`);
    }
  } finally {
    await app.close();
    db.close();
  }
});

// ---------------------------------------------------------------------------
// API-04: wrong password rejected, no cookie, rate limited on repeat
// ---------------------------------------------------------------------------

test('API-04: wrong password is rejected, sets no cookie, and repeated attempts are rate limited', async () => {
  const db = database(':memory:');
  addUser(db, 'grace@example.test', 'grace private password', 'Grace Studio');
  const app = makeApp({ db });
  try {
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers,
      payload: { email: 'grace@example.test', password: 'totally wrong password' },
    });
    assert.equal(wrong.statusCode, 401);
    assert.equal(wrong.cookies.length, 0, 'a failed login must not set a session cookie');

    // The login route is rate limited at 10/15min (server/app.ts). Exhaust it.
    let last;
    for (let i = 0; i < 11; i++) {
      last = await app.inject({
        method: 'POST',
        url: '/api/login',
        headers,
        payload: { email: 'grace@example.test', password: 'totally wrong password' },
      });
    }
    assert.equal(last!.statusCode, 429, 'the 11th attempt within the window must be rate limited');
  } finally {
    await app.close();
    db.close();
  }
});

// ---------------------------------------------------------------------------
// API-05: logout invalidates the session
// ---------------------------------------------------------------------------

test('API-05: logout invalidates the session for subsequent requests', async () => {
  const db = database(':memory:');
  addUser(db, 'heidi@example.test', 'heidi private password', 'Heidi Studio');
  const app = makeApp({ db });
  try {
    const heidi = await loginAs(app, 'heidi@example.test', 'heidi private password');
    assert.equal((await app.inject({ url: '/api/session', headers: heidi })).statusCode, 200);

    await app.inject({ method: 'POST', url: '/api/logout', headers: heidi });

    const after = await app.inject({ url: '/api/session', headers: heidi });
    assert.equal(after.statusCode, 401, 'the same cookie must be rejected after logout');
  } finally {
    await app.close();
    db.close();
  }
});

// ---------------------------------------------------------------------------
// API-10: file body size limit enforced
// ---------------------------------------------------------------------------

test('API-10: the 10 MB file body limit is enforced', async () => {
  const db = database(':memory:');
  addUser(db, 'ivan@example.test', 'ivan private password', 'Ivan Studio');
  const app = makeApp({ db });
  try {
    const ivan = await loginAs(app, 'ivan@example.test', 'ivan private password');
    const oversized = Buffer.concat([Buffer.from('PK'), Buffer.alloc(11 * 1024 * 1024, 1)]);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/files/too-big',
      headers: { ...ivan, 'content-type': 'application/octet-stream' },
      payload: oversized,
    });
    assert.equal(res.statusCode, 413);
  } finally {
    await app.close();
    db.close();
  }
});

// ---------------------------------------------------------------------------
// API-16: phone mode refused while outbound calling is disabled
// ---------------------------------------------------------------------------

test('API-16: phone mode is refused while ENABLE_OUTBOUND_CALLS is not true', async () => {
  const keys = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'AGENT_CALLBACK_SECRET', 'ENABLE_OUTBOUND_CALLS', 'LIVEKIT_SIP_TRUNK_ID'];
  const old = keys.map((k) => process.env[k]);
  const db = database(':memory:');
  const uid = addUser(db, 'jack@example.test', 'jack private password', 'Jack Studio');
  const ws = seedWorkspace();
  ws.enquiries = [
    {
      id: 'enquiry',
      projectId: ws.projects[0].id,
      vendorId: ws.vendors[0].id,
      itemIds: [ws.projects[0].items[0].id],
      status: 'Prepared',
      createdAt: '2026-09-23',
      notes: '',
      transcript: '',
    },
  ];
  db.prepare('UPDATE workspaces SET data=? WHERE user_id=?').run(JSON.stringify(ws), uid);
  ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'AGENT_CALLBACK_SECRET'].forEach((k) => {
    process.env[k] = 'test-only-config';
  });
  // Deliberately leave outbound calling disabled — this is the assertion under test.
  delete process.env.ENABLE_OUTBOUND_CALLS;
  delete process.env.LIVEKIT_SIP_TRUNK_ID;
  const app = makeApp({
    db,
    voice: {
      agentReachable: async () => true,
      startRoom: async () => {
        throw new Error('startRoom must not be called: outbound calling is disabled');
      },
      endRoom: async () => {},
    },
  });
  try {
    const jack = await loginAs(app, 'jack@example.test', 'jack private password');
    const res = await app.inject({
      method: 'POST',
      url: '/api/calls',
      headers: jack,
      payload: { mode: 'phone', enquiryId: 'enquiry', requestId: randomUUID(), confirmed: true },
    });
    assert.equal(res.statusCode, 403);
    assert.match(JSON.parse(res.body).error, /Phone calling is disabled/);
  } finally {
    await app.close();
    db.close();
    keys.forEach((k, i) => {
      if (old[i] === undefined) delete process.env[k];
      else process.env[k] = old[i];
    });
  }
});

// ---------------------------------------------------------------------------
// API-18: agent brief endpoint requires HMAC and excludes internal prices
// ---------------------------------------------------------------------------

test('API-18: GET /api/agent/calls/:id requires a valid HMAC and never returns cost', async () => {
  const old = process.env.AGENT_CALLBACK_SECRET;
  process.env.AGENT_CALLBACK_SECRET = 'b'.repeat(40);
  const db = database(':memory:');
  const uid = addUser(db, 'kim@example.test', 'kim private password', 'Kim Studio');
  // Build the brief through the real production path (callBrief, server/voice.ts) against
  // seeded items that DO carry real cost values, so this proves the endpoint's actual
  // behaviour rather than an artificial payload planted straight into the database.
  const { callBrief } = await import('../voice');
  const w = seedWorkspace();
  const project = w.projects[0];
  const pricedItem = project.items.find((i) => typeof i.cost === 'number' && i.cost! > 0)!;
  assert.ok(pricedItem, 'fixture must include a priced item for this test to be meaningful');
  const enquiryId = 'enquiry';
  w.enquiries = [
    {
      id: enquiryId,
      projectId: project.id,
      vendorId: w.vendors[0].id,
      itemIds: [pricedItem.id],
      status: 'Prepared',
      createdAt: '2026-09-23',
      notes: '',
      transcript: '',
    },
  ];
  const brief = callBrief(w, enquiryId);
  assert.equal(JSON.stringify(brief).includes(String(pricedItem.cost)), false, 'callBrief itself must already exclude cost');

  const id = randomUUID();
  db.prepare(
    'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
  ).run(id, uid, enquiryId, 'browser', 'starting', 'room', Date.now(), Date.now(), JSON.stringify(brief), 'req');
  const app = makeApp({ db });
  try {
    const unauthed = await app.inject({ method: 'GET', url: `/api/agent/calls/${id}` });
    assert.equal(unauthed.statusCode, 401, 'no signature at all must be rejected');

    const url = `/api/agent/calls/${id}`;
    const stamp = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', process.env.AGENT_CALLBACK_SECRET!).update(`${stamp}.${url}`).digest('hex');
    const ok = await app.inject({
      method: 'GET',
      url,
      headers: { 'x-nivo-timestamp': stamp, 'x-nivo-signature': sig },
    });
    assert.equal(ok.statusCode, 200);
    const body = JSON.parse(ok.body);
    assert.equal(JSON.stringify(body).includes(String(pricedItem.cost)), false, 'the agent-facing brief must never carry internal pricing');
    assert.equal('cost' in (body.brief.items[0] ?? {}), false);
  } finally {
    await app.close();
    db.close();
    if (old) process.env.AGENT_CALLBACK_SECRET = old;
    else delete process.env.AGENT_CALLBACK_SECRET;
  }
});

// ---------------------------------------------------------------------------
// API-20: bad HMAC signature on agent events is rejected 401
// ---------------------------------------------------------------------------

test('API-20: a bad HMAC signature on agent events is rejected with 401', async () => {
  const old = process.env.AGENT_CALLBACK_SECRET;
  process.env.AGENT_CALLBACK_SECRET = 'c'.repeat(40);
  const db = database(':memory:');
  const uid = addUser(db, 'liam@example.test', 'liam private password', 'Liam Studio');
  const id = randomUUID();
  db.prepare(
    'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
  ).run(id, uid, 'e', 'browser', 'starting', 'room', Date.now(), Date.now(), '{}', 'req');
  const app = makeApp({ db });
  try {
    const payload = JSON.stringify({ id: randomUUID(), callId: id, status: 'active', transcript: [] });
    const stamp = String(Math.floor(Date.now() / 1000));
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/events',
      headers: { 'x-nivo-timestamp': stamp, 'x-nivo-signature': 'f'.repeat(64) },
      payload: { payload },
    });
    assert.equal(res.statusCode, 401);
    const stored = db.prepare('SELECT status FROM calls WHERE id=?').get(id) as any;
    assert.equal(stored.status, 'starting', 'a forged event must not mutate call state');
  } finally {
    await app.close();
    db.close();
    if (old) process.env.AGENT_CALLBACK_SECRET = old;
    else delete process.env.AGENT_CALLBACK_SECRET;
  }
});

// ---------------------------------------------------------------------------
// API-22: expired timestamp on agent events is rejected outside the 5-minute window
// ---------------------------------------------------------------------------

test('API-22: an expired timestamp on agent events is rejected', async () => {
  const old = process.env.AGENT_CALLBACK_SECRET;
  process.env.AGENT_CALLBACK_SECRET = 'd'.repeat(40);
  const db = database(':memory:');
  const uid = addUser(db, 'mona@example.test', 'mona private password', 'Mona Studio');
  const id = randomUUID();
  db.prepare(
    'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
  ).run(id, uid, 'e', 'browser', 'starting', 'room', Date.now(), Date.now(), '{}', 'req');
  const app = makeApp({ db });
  try {
    const payload = JSON.stringify({ id: randomUUID(), callId: id, status: 'active', transcript: [] });
    const staleStamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes old, outside the 5-minute window
    const sig = createHmac('sha256', process.env.AGENT_CALLBACK_SECRET!).update(`${staleStamp}.${payload}`).digest('hex');
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/events',
      headers: { 'x-nivo-timestamp': staleStamp, 'x-nivo-signature': sig },
      payload: { payload },
    });
    assert.equal(res.statusCode, 401);
    const stored = db.prepare('SELECT status FROM calls WHERE id=?').get(id) as any;
    assert.equal(stored.status, 'starting', 'an expired-timestamp event must not mutate call state');
  } finally {
    await app.close();
    db.close();
    if (old) process.env.AGENT_CALLBACK_SECRET = old;
    else delete process.env.AGENT_CALLBACK_SECRET;
  }
});

// ---------------------------------------------------------------------------
// API-23: a late event on a terminal call does not reopen it
// ---------------------------------------------------------------------------

test('API-23: a late event arriving after the call has ended does not reopen it', async () => {
  const old = process.env.AGENT_CALLBACK_SECRET;
  process.env.AGENT_CALLBACK_SECRET = 'e'.repeat(40);
  const db = database(':memory:');
  const uid = addUser(db, 'nate@example.test', 'nate private password', 'Nate Studio');
  const id = randomUUID();
  db.prepare(
    'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,request_id,transcript) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
  ).run(id, uid, 'e', 'browser', 'ended', 'room', Date.now(), Date.now(), '{}', 'req', '[]');
  const app = makeApp({ db });
  try {
    const payload = JSON.stringify({ id: randomUUID(), callId: id, status: 'active', transcript: [{ role: 'user', text: 'late' }] });
    const stamp = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', process.env.AGENT_CALLBACK_SECRET!).update(`${stamp}.${payload}`).digest('hex');
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/events',
      headers: { 'x-nivo-timestamp': stamp, 'x-nivo-signature': sig },
      payload: { payload },
    });
    assert.equal(res.statusCode, 200);
    const stored = db.prepare('SELECT status FROM calls WHERE id=?').get(id) as any;
    assert.equal(stored.status, 'ended', 'a terminal call must stay terminal despite a later active event');
  } finally {
    await app.close();
    db.close();
    if (old) process.env.AGENT_CALLBACK_SECRET = old;
    else delete process.env.AGENT_CALLBACK_SECRET;
  }
});

// ---------------------------------------------------------------------------
// API-24: a null payload returns 400, not 500
// ---------------------------------------------------------------------------

test('API-24: a null event payload returns 400, not 500', async () => {
  const old = process.env.AGENT_CALLBACK_SECRET;
  process.env.AGENT_CALLBACK_SECRET = 'f'.repeat(40);
  const db = database(':memory:');
  const app = makeApp({ db });
  try {
    const payload = 'null';
    const stamp = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', process.env.AGENT_CALLBACK_SECRET!).update(`${stamp}.${payload}`).digest('hex');
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/events',
      headers: { 'x-nivo-timestamp': stamp, 'x-nivo-signature': sig },
      payload: { payload },
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await app.close();
    db.close();
    if (old) process.env.AGENT_CALLBACK_SECRET = old;
    else delete process.env.AGENT_CALLBACK_SECRET;
  }
});

// ---------------------------------------------------------------------------
// API-25: extract endpoint is tenant-scoped (cross-account call id is 404)
// ---------------------------------------------------------------------------

test('API-25: a second account cannot extract from the first account call', async () => {
  const db = database(':memory:');
  const ownerId = addUser(db, 'omar@example.test', 'omar private password', 'Omar Studio');
  addUser(db, 'petra@example.test', 'petra private password', 'Petra Studio');
  const id = randomUUID();
  db.prepare(
    'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,request_id,transcript) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
  ).run(id, ownerId, 'e', 'browser', 'ended', 'room', Date.now(), Date.now(), '{"items":[]}', 'req', '[]');
  const app = makeApp({ db });
  try {
    const petra = await loginAs(app, 'petra@example.test', 'petra private password');
    const res = await app.inject({ method: 'POST', url: `/api/calls/${id}/extract`, headers: petra });
    assert.equal(res.statusCode, 404, 'extraction must be scoped to the owning account before it ever touches the LLM');
  } finally {
    await app.close();
    db.close();
  }
});
