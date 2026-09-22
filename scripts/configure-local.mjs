import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env'))
  throw new Error('.env already exists. Preserve its secrets; update it manually.');
const key = `nivo${randomBytes(8).toString('hex')}`,
  secret = randomBytes(32).toString('hex'),
  callback = randomBytes(32).toString('hex');
let env = readFileSync('.env.example', 'utf8')
  .replace(/^LIVEKIT_API_KEY=$/m, `LIVEKIT_API_KEY=${key}`)
  .replace(/^LIVEKIT_API_SECRET=$/m, `LIVEKIT_API_SECRET=${secret}`)
  .replace(/^AGENT_CALLBACK_SECRET=$/m, `AGENT_CALLBACK_SECRET=${callback}`);
writeFileSync('.env', env, { mode: 0o600, flag: 'wx' });
mkdirSync('deploy/generated', { recursive: true, mode: 0o700 });
writeFileSync(
  'deploy/generated/livekit.yaml',
  `port: 7880\nbind_addresses: ["0.0.0.0"]\nrtc:\n  tcp_port: 7881\n  udp_port: 7882\n  use_external_ip: false\n  enable_loopback_candidate: true\nkeys:\n  ${key}: ${secret}\n`,
  { mode: 0o600 },
);
writeFileSync(
  'deploy/generated/livekit-linux.yaml',
  `port: 7880\nbind_addresses: ["0.0.0.0"]\nrtc:\n  tcp_port: 7881\n  udp_port: 7882\n  use_external_ip: true\nredis:\n  address: 127.0.0.1:6379\nkeys:\n  ${key}: ${secret}\nturn:\n  enabled: true\n  udp_port: 3478\n`,
  { mode: 0o600 },
);
writeFileSync(
  'deploy/generated/sip.yaml',
  `api_key: ${key}\napi_secret: ${secret}\nws_url: ws://127.0.0.1:7880\nredis:\n  address: 127.0.0.1:6379\nsip_port: 5060\nrtp_port: 10000-20000\nuse_external_ip: true\nlogging:\n  level: info\n`,
  { mode: 0o600 },
);
console.log(
  'Created private local configuration. No secrets printed. Outbound calling is disabled.',
);
