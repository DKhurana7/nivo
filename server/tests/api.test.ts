import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { makeApp } from '../app';
import { database, addUser } from '../db';
import { validateDrafts } from '../extraction';
import { seedWorkspace } from '../../src/lib/seed';
const headers = { 'x-nivo-request': '1' };
test('private studios, CSRF, revision conflicts, files and sessions', async () => {
  const db = database(':memory:');
  addUser(db, 'first@example.test', 'long private password', 'First');
  addUser(db, 'second@example.test', 'other long password', 'Second');
  const app = makeApp({ db });
  try {
    assert.equal((await app.inject('/api/workspace')).statusCode, 401);
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/api/login',
          payload: { email: 'first@example.test', password: 'long private password' },
        })
      ).statusCode,
      403,
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers,
      payload: { email: 'first@example.test', password: 'long private password' },
    });
    assert.equal(login.statusCode, 200);
    assert.match(String(login.headers['set-cookie']), /HttpOnly/);
    const cookie = login.cookies[0].value;
    const auth = { ...headers, cookie: `nivo_session=${cookie}` };
    const w = (await app.inject({ url: '/api/workspace', headers: auth })).json();
    assert.equal(w.workspace.settings.company, 'First');
    assert.equal(
      (await app.inject({ method: 'PUT', url: '/api/workspace', headers: auth, payload: w }))
        .statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ method: 'PUT', url: '/api/workspace', headers: auth, payload: w }))
        .statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/workspace',
          headers: { ...auth, origin: 'https://attacker.test' },
          payload: w,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/files/file-1',
          headers: { ...auth, 'content-type': 'application/octet-stream' },
          payload: Buffer.from('PKfixture'),
        })
      ).statusCode,
      200,
    );
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers,
      payload: { email: 'second@example.test', password: 'other long password' },
    });
    const auth2 = { ...headers, cookie: `nivo_session=${login2.cookies[0].value}` };
    assert.equal((await app.inject({ url: '/api/files/file-1', headers: auth2 })).statusCode, 404);
    assert.equal((await app.inject({ url: '/api/workspace', headers: auth2 })).json().revision, 0);
    const pdf = Buffer.from('%PDF-1.4 synthetic quotation');
    const pdfRequest = {
      method: 'PUT' as const,
      url: '/api/files/vendor-pdf',
      headers: { ...auth, 'content-type': 'application/octet-stream' },
      payload: pdf,
    };
    assert.equal(
      (
        await app.inject({
          ...pdfRequest,
          headers: { 'content-type': 'application/octet-stream', cookie: auth.cookie },
        })
      ).statusCode,
      403,
    );
    assert.equal((await app.inject(pdfRequest)).statusCode, 200);
    assert.deepEqual((await app.inject({ url: pdfRequest.url, headers: auth })).rawPayload, pdf);
    assert.equal((await app.inject({ url: pdfRequest.url, headers: auth2 })).statusCode, 404);
    assert.equal(
      (await app.inject({ ...pdfRequest, payload: Buffer.from('<script>bad</script>') }))
        .statusCode,
      400,
    );

    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/api/calls',
          headers: auth,
          payload: { mode: 'browser', enquiryId: 'missing', requestId: randomUUID() },
        })
      ).statusCode,
      503,
    );
    await app.inject({ method: 'POST', url: '/api/logout', headers: auth });
    assert.equal((await app.inject({ url: '/api/workspace', headers: auth })).statusCode, 401);
  } finally {
    await app.close();
    db.close();
  }
});
test('agent callbacks are signed, replay safe and cannot reopen ended calls', async () => {
  const old = process.env.AGENT_CALLBACK_SECRET;
  process.env.AGENT_CALLBACK_SECRET = 'a'.repeat(40);
  const db = database(':memory:'),
    uid = addUser(db, 'test@example.test', 'long private password', 'Studio'),
    id = randomUUID();
  db.prepare(
    'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
  ).run(id, uid, 'e', 'browser', 'starting', 'room', Date.now(), Date.now(), '{}', 'request');
  const app = makeApp({ db });
  try {
    const payload = JSON.stringify({
      id: randomUUID(),
      callId: id,
      status: 'ended',
      transcript: [{ role: 'user', text: 'Rate is 120 rupees per metre excluding GST.' }],
    });
    const stamp = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', process.env.AGENT_CALLBACK_SECRET)
      .update(`${stamp}.${payload}`)
      .digest('hex');
    const request = {
      method: 'POST' as const,
      url: '/api/agent/events',
      headers: { 'x-nivo-timestamp': stamp, 'x-nivo-signature': sig },
      payload: { payload },
    };
    assert.equal((await app.inject({ ...request, headers: {} })).statusCode, 401);
    const malformed = 'null';
    assert.equal(
      (
        await app.inject({
          ...request,
          headers: {
            'x-nivo-timestamp': stamp,
            'x-nivo-signature': createHmac('sha256', process.env.AGENT_CALLBACK_SECRET)
              .update(`${stamp}.${malformed}`)
              .digest('hex'),
          },
          payload: { payload: malformed },
        })
      ).statusCode,
      400,
    );
    assert.equal((await app.inject(request)).statusCode, 200);
    assert.equal((await app.inject(request)).json().duplicate, true);
    const later = JSON.stringify({
      id: randomUUID(),
      callId: id,
      status: 'active',
      transcript: [],
    });
    const sig2 = createHmac('sha256', process.env.AGENT_CALLBACK_SECRET)
      .update(`${stamp}.${later}`)
      .digest('hex');
    await app.inject({
      ...request,
      headers: { 'x-nivo-timestamp': stamp, 'x-nivo-signature': sig2 },
      payload: { payload: later },
    });
    const stored = db.prepare('SELECT status,transcript FROM calls WHERE id=?').get(id) as any;
    assert.equal(stored.status, 'ended');
    assert.equal(JSON.parse(stored.transcript).length, 1);
  } finally {
    await app.close();
    db.close();
    if (old) process.env.AGENT_CALLBACK_SECRET = old;
    else delete process.env.AGENT_CALLBACK_SECRET;
  }
});
test('voice lifecycle gates unhealthy workers, serializes retries and handles cancellation during setup', async () => {
  const keys = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'AGENT_CALLBACK_SECRET'];
  const old = keys.map((key) => process.env[key]);
  keys.forEach((key) => {
    process.env[key] = 'test-only-config';
  });
  const db = database(':memory:');
  const uid = addUser(db, 'voice@example.test', 'long private password', 'Studio');
  const w = seedWorkspace();
  w.enquiries = [
    {
      id: 'enquiry',
      projectId: w.projects[0].id,
      vendorId: w.vendors[0].id,
      itemIds: [w.projects[0].items[0].id],
      status: 'Prepared',
      createdAt: '2026-09-23',
      notes: '',
      transcript: '',
    },
  ];
  db.prepare('UPDATE workspaces SET data=? WHERE user_id=?').run(JSON.stringify(w), uid);
  let healthy = false,
    starts = 0,
    ends = 0;
  let release!: () => void;
  const setup = new Promise<void>((resolve) => {
    release = resolve;
  });
  const app = makeApp({
    db,
    voice: {
      agentReachable: async () => {
        await Promise.resolve();
        return healthy;
      },
      startRoom: async (id) => {
        starts++;
        await setup;
        return { room: `nivo-${id}`, token: 'synthetic-token', url: 'ws://localhost' };
      },
      endRoom: async () => {
        ends++;
      },
    },
  });
  try {
    const login = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers,
      payload: { email: 'voice@example.test', password: 'long private password' },
    });
    const auth = { ...headers, cookie: `nivo_session=${login.cookies[0].value}` };
    const request = {
      method: 'POST' as const,
      url: '/api/calls',
      headers: auth,
      payload: { mode: 'browser', enquiryId: 'enquiry', requestId: randomUUID() },
    };
    assert.equal((await app.inject(request)).statusCode, 503);
    assert.equal(starts, 0);
    healthy = true;
    const pending = app.inject(request);
    // Wait for the request to reserve its row while provider setup remains pending.
    for (let n = 0; n < 50 && !starts; n++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(starts, 1);
    const repeated = await app.inject(request);
    assert.equal(repeated.statusCode, 200);
    assert.equal(repeated.json().replayed, true);
    assert.equal(starts, 1);
    assert.equal(
      (await app.inject({ ...request, payload: { ...request.payload, requestId: randomUUID() } }))
        .statusCode,
      409,
    );
    const id = repeated.json().id;
    assert.equal(
      (await app.inject({ method: 'POST', url: `/api/calls/${id}/end`, headers: auth })).statusCode,
      200,
    );
    release();
    assert.equal((await pending).statusCode, 409);
    assert.equal(
      (await app.inject({ url: `/api/calls/${id}`, headers: auth })).json().status,
      'ended',
    );
    assert.equal(ends, 2); // second deletion catches a room created after cancellation
    await app.inject({ method: 'POST', url: `/api/calls/${id}/end`, headers: auth });
    assert.equal(ends, 2);
  } finally {
    release();
    await app.close();
    db.close();
    keys.forEach((key, i) => {
      if (old[i] === undefined) delete process.env[key];
      else process.env[key] = old[i];
    });
  }
});
test('extraction rejects invented evidence, unknown items and invalid money', () => {
  const brief = { items: [{ id: 'a' }] } as any;
  const transcript = [{ role: 'user', text: 'It is 100 per metre plus GST.' }];
  const q = {
    itemId: 'a',
    unit: 'm',
    cost: 100,
    basis: 'excluding-gst',
    brand: '',
    terms: '',
    evidence: transcript[0].text,
  };
  assert.equal(validateDrafts([q], brief, transcript)[0].needsReview, true);
  const unclearTax = 'It is 100 per metre excluding GSD.';
  assert.equal(
    validateDrafts([{ ...q, evidence: unclearTax }], brief, [{ role: 'user', text: unclearTax }])[0]
      .basis,
    'unknown',
  );
  for (const patch of [
    { evidence: 'Invented quote' },
    { itemId: 'b' },
    { cost: -1 },
    { cost: NaN },
    { basis: 'inferred' },
  ])
    assert.throws(() => validateDrafts([{ ...q, ...patch }], brief, transcript));
  assert.throws(() => validateDrafts([q], brief, [{ role: 'assistant', text: q.evidence }]));
});
