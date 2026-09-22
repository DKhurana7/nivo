import { makeApp } from './app';
const app = makeApp();
await app.listen({ host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT) || 8787 });
console.log(`Nivo API listening on port ${Number(process.env.PORT) || 8787}`);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => void app.close().then(() => process.exit(0)));
