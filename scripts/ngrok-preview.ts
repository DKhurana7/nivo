/** Temporary authenticated tester instance. Deliberately separate from data/nivo.sqlite. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { database, addUser } from '../server/db';
import { makeApp } from '../server/app';
import { seedWorkspace } from '../src/lib/seed';

const metadata = (await fetch('http://127.0.0.1:4040/api/tunnels').then((r) => {
  if (!r.ok) throw new Error('Cannot read ngrok tunnel. Start ngrok http 8792 first.');
  return r.json();
})) as { tunnels: { public_url: string; config: { addr: string } }[] };
const tunnel = metadata.tunnels.find(
  (t) => t.public_url.startsWith('https://') && /:8792\/?$/.test(t.config.addr),
);
if (!tunnel) throw new Error('Start an HTTPS ngrok tunnel to port 8792 first.');
const origin = new URL(tunnel.public_url).origin;
if (!existsSync('dist/index.html')) throw new Error('Run npm run build first.');
// Do not inherit local voice/provider credentials into the public preview.
for (const key of Object.keys(process.env)) {
  if (/^(LIVEKIT_|AGENT_|DEEPGRAM_|GROQ_|OLLAMA_|EXTRACTION_|OPENAI_)/.test(key))
    delete process.env[key];
}
process.env.ENABLE_OUTBOUND_CALLS = 'false';
process.env.APP_ORIGIN = origin;
mkdirSync('data', { recursive: true, mode: 0o700 });
const db = database('data/ngrok-preview.sqlite');
const loginPath = 'data/ngrok-preview-login.json';
let login: { email: string; password: string; url: string };
if (existsSync(loginPath)) {
  login = JSON.parse(readFileSync(loginPath, 'utf8'));
  if (!db.prepare('SELECT id FROM users WHERE email=?').get(login.email))
    throw new Error('Preview login does not match its database. Restore both files together.');
} else {
  if ((db.prepare('SELECT count(*) n FROM users').get() as { n: number }).n)
    throw new Error('Preview already has users but no login file; refusing to overwrite.');
  login = {
    email: 'tester@nivo.local',
    password: randomBytes(15).toString('base64url'),
    url: origin,
  };
  const id = addUser(db, login.email, login.password, 'Technosmart tester');
  const workspace = seedWorkspace();
  workspace.settings.company = 'Technosmart tester';
  db.prepare('UPDATE workspaces SET data=? WHERE user_id=?').run(JSON.stringify(workspace), id);
}
login.url = origin;
writeFileSync(loginPath, JSON.stringify(login, null, 2) + '\n', { mode: 0o600 });
const app = makeApp({ db, production: true });
await app.listen({ host: '127.0.0.1', port: 8792 });
console.log(
  `Tester preview: ${origin}; private login: ${loginPath}; database: data/ngrok-preview.sqlite`,
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(
    signal,
    () =>
      void app.close().then(() => {
        db.close();
        process.exit(0);
      }),
  );
