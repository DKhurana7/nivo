import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import staticFiles from '@fastify/static';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { database, digest, passwordMatches } from './db';
import { validateWorkspace } from '../src/lib/validation';
import { callBrief, clients, voiceConfig } from './voice';
import * as voice from './voice';
import type { Workspace } from '../src/lib/types';
type User = { id: string; email: string; company: string; password: string };
type Call = {
  id: string;
  user_id: string;
  enquiry_id: string;
  mode: string;
  status: string;
  room: string;
  created: number;
  updated: number;
  brief: string;
  transcript: string;
  drafts: string;
  error: string;
};
const fail = (message: string, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export function makeApp(
  options: {
    db?: DatabaseSync;
    production?: boolean;
    voice?: Pick<typeof voice, 'startRoom' | 'endRoom' | 'agentReachable'>;
  } = {},
) {
  const { startRoom, endRoom, agentReachable } = options.voice ?? voice;
  const db = options.db ?? database(process.env.DATABASE_PATH || './data/nivo.sqlite');
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const app = Fastify({
    bodyLimit: 20 * 1024 * 1024,
    logger: false,
    trustProxy: ['127.0.0.1', '::1'],
  });
  const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:5178';
  const audit = (uid: string, action: string) =>
    db.prepare('INSERT INTO audit VALUES(?,?,?,?)').run(randomUUID(), uid, action, Date.now());
  const getUser = (req: any): User => {
    const token = req.cookies.nivo_session;
    const user =
      token &&
      (db
        .prepare(
          'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',
        )
        .get(digest(token), Date.now()) as User);
    if (!user) throw fail('Sign in to your studio.', 401);
    return user;
  };
  const getCall = (id: string, uid: string) => {
    const call = db.prepare('SELECT * FROM calls WHERE id=? AND user_id=?').get(id, uid) as Call;
    if (!call) throw fail('Call not found.', 404);
    return call;
  };
  const present = (c: Call) => ({
    id: c.id,
    enquiryId: c.enquiry_id,
    mode: c.mode,
    status: c.status,
    created: c.created,
    updated: c.updated,
    transcript: JSON.parse(c.transcript),
    drafts: JSON.parse(c.drafts),
    error: c.error,
  });
  app.register(cookie);
  app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: [
          "'self'",
          ...(process.env.LIVEKIT_PUBLIC_URL ? [process.env.LIVEKIT_PUBLIC_URL] : []),
        ],
        mediaSrc: ["'self'", 'blob:'],
        workerSrc: ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.url.startsWith('/api/agent/')) {
      if (
        req.headers['x-nivo-request'] !== '1' ||
        (req.headers.origin && req.headers.origin !== origin)
      )
        throw fail('Request origin could not be verified.', 403);
    }
  });
  app.setErrorHandler((err, req, reply) => {
    const status = (err as any).statusCode || 500;
    if (status >= 500)
      console.error('API request failed', req.method, req.url, (err as Error).name);
    reply.code(status).send({
      error:
        status === 500
          ? 'The service could not complete this request. Check server configuration and retry.'
          : (err as Error).message,
    });
  });
  // Declare routes after cookie, rate-limit and security plugins have booted.
  // In particular rate-limit installs onRoute; eager declarations bypass it.
  app.register(async (app) => {
    app.get('/api/health', async () => ({
      ok: true,
      storage: db.prepare('SELECT 1').get() ? 'ready' : 'unavailable',
    }));
    app.get('/api/session', async (req) => {
      const u = getUser(req);
      return { id: u.id, email: u.email, company: u.company };
    });
    app.post(
      '/api/login',
      { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
      async (req, reply) => {
        const body = req.body as any;
        if (
          typeof body?.email !== 'string' ||
          typeof body?.password !== 'string' ||
          body.password.length > 1024
        )
          throw fail('Email and password are required.');
        const u = db
          .prepare('SELECT * FROM users WHERE email=?')
          .get(body.email.trim().toLowerCase()) as User;
        // Same work for absent accounts; do not disclose whether an email is registered.
        const hash = u?.password || `00000000000000000000000000000000:${'0'.repeat(128)}`;
        if (!passwordMatches(body.password, hash) || !u)
          throw fail('Email or password is incorrect.', 401);
        const token = randomBytes(32).toString('hex');
        db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(
          digest(token),
          u.id,
          Date.now() + 7 * 86400000,
        );
        reply.setCookie('nivo_session', token, {
          httpOnly: true,
          secure: production,
          sameSite: 'strict',
          path: '/',
          maxAge: 7 * 86400,
        });
        audit(u.id, 'login');
        return { id: u.id, email: u.email, company: u.company };
      },
    );
    app.post('/api/logout', async (req, reply) => {
      if (req.cookies.nivo_session)
        db.prepare('DELETE FROM sessions WHERE token=?').run(digest(req.cookies.nivo_session));
      reply.clearCookie('nivo_session', { path: '/' });
      return { ok: true };
    });
    app.get('/api/workspace', async (req) => {
      const u = getUser(req);
      const row = db
        .prepare('SELECT data,revision FROM workspaces WHERE user_id=?')
        .get(u.id) as any;
      return { workspace: JSON.parse(row.data), revision: row.revision };
    });
    app.put('/api/workspace', async (req) => {
      const u = getUser(req);
      const b = req.body as any;
      if (!validateWorkspace(b?.workspace) || !Number.isInteger(b?.revision))
        throw fail('Workspace validation failed.');
      const result = db
        .prepare('UPDATE workspaces SET data=?,revision=revision+1 WHERE user_id=? AND revision=?')
        .run(JSON.stringify(b.workspace), u.id, b.revision);
      if (!result.changes)
        throw fail(
          'Another session changed this workspace. Export your pending changes before reloading.',
          409,
        );
      audit(u.id, 'workspace.saved');
      return { revision: b.revision + 1 };
    });
    app.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer' },
      (_req, body, done) => done(null, body),
    );
    app.put('/api/files/:id', { bodyLimit: 10 * 1024 * 1024 }, async (req) => {
      const u = getUser(req),
        id = (req.params as any).id;
      const bytes = req.body as Buffer;
      if (
        !/^[\w-]{1,80}$/.test(id) ||
        !Buffer.isBuffer(bytes) ||
        (bytes.subarray(0, 2).toString() !== 'PK' && bytes.subarray(0, 5).toString() !== '%PDF-')
      )
        throw fail('An XLSX workbook or PDF quotation is required.');
      const usage = db
        .prepare('SELECT COALESCE(SUM(length(bytes)),0) AS n FROM files WHERE user_id=? AND id<>?')
        .get(u.id, id) as any;
      if (usage.n + bytes.length > 200 * 1024 * 1024)
        throw fail('Studio file storage limit reached (200 MB).', 413);
      db.prepare(
        'INSERT INTO files VALUES(?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET bytes=excluded.bytes',
      ).run(u.id, id, bytes);
      return { id };
    });
    app.get('/api/files/:id', async (req, reply) => {
      const u = getUser(req);
      const row = db
        .prepare('SELECT bytes FROM files WHERE user_id=? AND id=?')
        .get(u.id, (req.params as any).id) as any;
      if (!row) throw fail('Source workbook not found.', 404);
      return reply.type('application/octet-stream').send(Buffer.from(row.bytes));
    });
    app.get('/api/voice/status', async (req) => {
      getUser(req);
      const config = voiceConfig();
      let reachable = false;
      if (config.configured) {
        try {
          await Promise.race([
            clients().rooms.listRooms(),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2500)),
          ]);
          reachable = true;
        } catch {}
      }
      return {
        ...config,
        reachable,
        agentVerified: await agentReachable(),
        extractionConfigured: !!process.env.EXTRACTION_BASE_URL && !!process.env.EXTRACTION_MODEL,
      };
    });
    app.get('/api/calls', async (req) => {
      const u = getUser(req);
      return (
        db
          .prepare('SELECT * FROM calls WHERE user_id=? ORDER BY created DESC LIMIT 100')
          .all(u.id) as Call[]
      ).map(present);
    });
    app.get('/api/calls/:id', async (req) =>
      present(getCall((req.params as any).id, getUser(req).id)),
    );
    app.post(
      '/api/calls',
      { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
      async (req, reply) => {
        const u = getUser(req),
          b = req.body as any,
          config = voiceConfig();
        if (
          !['browser', 'phone'].includes(b?.mode) ||
          typeof b?.enquiryId !== 'string' ||
          !/^[\w-]{10,80}$/.test(b?.requestId ?? '')
        )
          throw fail('Choose a valid enquiry and call mode.');
        const existing = db
          .prepare('SELECT * FROM calls WHERE user_id=? AND request_id=?')
          .get(u.id, b.requestId) as Call;
        if (existing) return { ...present(existing), replayed: true };
        if (!config.configured)
          throw fail('LiveKit and the agent callback secret must be configured first.', 503);
        if (!(await agentReachable()))
          throw fail('The voice worker is not connected. Start it and retry.', 503);
        // Recheck after the asynchronous health probe: a concurrent retry may have reserved it.
        const reserved = db
          .prepare('SELECT * FROM calls WHERE user_id=? AND request_id=?')
          .get(u.id, b.requestId) as Call;
        if (reserved) return { ...present(reserved), replayed: true };
        if (b.mode === 'phone' && (!config.outboundEnabled || b.confirmed !== true))
          throw fail('Phone calling is disabled or the vendor call was not confirmed.', 403);
        const w = JSON.parse(
          (db.prepare('SELECT data FROM workspaces WHERE user_id=?').get(u.id) as any).data,
        ) as Workspace;
        let brief;
        try {
          brief = callBrief(w, b.enquiryId);
        } catch (e) {
          throw fail((e as Error).message);
        }
        if (b.mode === 'phone' && !/^\+[1-9]\d{7,14}$/.test(brief.phone))
          throw fail(
            'Enter the vendor number in international format, for example +91 followed by 10 digits.',
          );
        // Never permit parallel automatic enquiries for the same studio.
        const active = db
          .prepare(
            "SELECT id FROM calls WHERE user_id=? AND status IN ('starting','connected','active')",
          )
          .get(u.id);
        if (active) throw fail('End the current call before starting another.', 409);
        const id = randomUUID(),
          now = Date.now();
        db.prepare(
          'INSERT INTO calls(id,user_id,enquiry_id,mode,status,room,created,updated,brief,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
        ).run(
          id,
          u.id,
          b.enquiryId,
          b.mode,
          'starting',
          `nivo-${id}`,
          now,
          now,
          JSON.stringify(brief),
          b.requestId,
        );
        audit(u.id, `call.${b.mode}.requested`);
        try {
          const connection = await startRoom(id, u.id, b.mode, brief);
          const saved = getCall(id, u.id);
          if (['ended', 'failed'].includes(saved.status)) {
            await endRoom(saved.room);
            throw fail('The session ended during setup. Start a new session.', 409);
          }
          return reply.code(201).send({ ...present(getCall(id, u.id)), ...connection });
        } catch (error) {
          db.prepare(
            "UPDATE calls SET status='failed',error=?,updated=? WHERE id=? AND status NOT IN ('ended','failed')",
          ).run(
            'Could not create the voice session. Verify LiveKit, agent dispatch and SIP configuration.',
            Date.now(),
            id,
          );
          if ((error as { statusCode?: number }).statusCode === 409) throw error;
          throw fail('Voice session could not start. No successful call was recorded.', 502);
        }
      },
    );
    app.post('/api/calls/:id/end', async (req) => {
      const c = getCall((req.params as any).id, getUser(req).id);
      if (['ended', 'failed'].includes(c.status)) return present(c);
      await endRoom(c.room);
      db.prepare(
        "UPDATE calls SET status='ended',updated=? WHERE id=? AND status NOT IN ('ended','failed')",
      ).run(Date.now(), c.id);
      return present(getCall(c.id, c.user_id));
    });
    const verifyAgent = (req: any, payload: string) => {
      const secret = process.env.AGENT_CALLBACK_SECRET || '',
        stamp = String(req.headers['x-nivo-timestamp'] || ''),
        sig = String(req.headers['x-nivo-signature'] || '');
      if (
        secret.length < 32 ||
        Math.abs(Date.now() / 1000 - Number(stamp)) > 300 ||
        !/^\d+$/.test(stamp) ||
        !/^[a-f0-9]{64}$/.test(sig)
      )
        throw fail('Invalid agent signature.', 401);
      const expected = createHmac('sha256', secret).update(`${stamp}.${payload}`).digest();
      if (!timingSafeEqual(expected, Buffer.from(sig, 'hex')))
        throw fail('Invalid agent signature.', 401);
    };
    app.get('/api/agent/calls/:id', async (req) => {
      verifyAgent(req, req.url);
      const c = db.prepare('SELECT * FROM calls WHERE id=?').get((req.params as any).id) as Call;
      if (!c) throw fail('Call not found.', 404);
      return {
        callId: c.id,
        mode: c.mode,
        brief: JSON.parse(c.brief),
        maxSeconds: voiceConfig().maxSeconds,
      };
    });
    // JSON callback signs the exact JSON string carried in an envelope, avoiding parser reserialization differences.
    app.post('/api/agent/events', async (req) => {
      const payload = (req.body as any)?.payload;
      if (typeof payload !== 'string' || payload.length > 1000000) throw fail('Invalid event.');
      verifyAgent(req, payload);
      let e: any;
      try {
        e = JSON.parse(payload);
      } catch {
        throw fail('Invalid event JSON.');
      }
      if (
        !e ||
        typeof e.id !== 'string' ||
        !e.id ||
        e.id.length > 100 ||
        typeof e.callId !== 'string' ||
        !['active', 'ended', 'failed'].includes(e.status) ||
        !Array.isArray(e.transcript) ||
        e.transcript.length > 2000 ||
        !e.transcript.every(
          (x: any) =>
            x &&
            ['user', 'assistant'].includes(x.role) &&
            typeof x.text === 'string' &&
            x.text.length < 20000,
        )
      )
        throw fail('Invalid transcript event.');
      const c = db.prepare('SELECT * FROM calls WHERE id=?').get(e.callId) as Call;
      if (!c) throw fail('Call not found.', 404);
      if (db.prepare('SELECT id FROM events WHERE id=?').get(e.id))
        return { ok: true, duplicate: true };
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO events VALUES(?,?,?)').run(e.id, c.id, Date.now());
        const transcript =
          e.transcript.length >= JSON.parse(c.transcript).length
            ? JSON.stringify(e.transcript)
            : c.transcript;
        const status = ['ended', 'failed'].includes(c.status) ? c.status : e.status;
        db.prepare('UPDATE calls SET status=?,transcript=?,error=?,updated=? WHERE id=?').run(
          status,
          transcript,
          e.status === 'failed'
            ? 'Agent pipeline failed. Review worker logs and provider configuration.'
            : c.error,
          Date.now(),
          c.id,
        );
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return { ok: true };
    });
    app.post('/api/calls/:id/extract', async (req) => {
      const c = getCall((req.params as any).id, getUser(req).id);
      const { extractQuotes } = await import('./extraction');
      const drafts = await extractQuotes(JSON.parse(c.brief), JSON.parse(c.transcript));
      db.prepare('UPDATE calls SET drafts=?,updated=? WHERE id=?').run(
        JSON.stringify(drafts),
        Date.now(),
        c.id,
      );
      return drafts;
    });
    if (existsSync(resolve('dist/index.html')))
      app.register(staticFiles, { root: resolve('dist'), prefix: '/', wildcard: false });
  });
  // Bound abandoned calls even if the worker crashes before sending a final callback.
  const timer = setInterval(() => {
    const stale = db
      .prepare(
        "SELECT * FROM calls WHERE status IN ('starting','connected','active') AND created<?",
      )
      .all(Date.now() - (voiceConfig().maxSeconds + 90) * 1000) as Call[];
    for (const c of stale) {
      if (voiceConfig().configured)
        void endRoom(c.room)
          .then(() => {
            db.prepare(
              "UPDATE calls SET status='failed',error='Session timed out.',updated=? WHERE id=? AND status IN ('starting','connected','active')",
            ).run(Date.now(), c.id);
          })
          .catch(() => {
            db.prepare(
              "UPDATE calls SET error='Session timed out; room cleanup pending. Retry End call when voice service is available.' WHERE id=? AND status IN ('starting','connected','active')",
            ).run(c.id);
          });
    }
  }, 30000);
  timer.unref();
  app.addHook('onClose', async () => {
    clearInterval(timer);
    if (!options.db) db.close();
  });
  return app;
}
