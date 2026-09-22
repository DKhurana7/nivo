# Nivo

A BOQ estimating and vendor-quotation workspace for Technosmart Interiors, with an authenticated studio backend and a self-hosted LiveKit voice-agent implementation.

Start with [CODEBASE_REFERENCE.md](CODEBASE_REFERENCE.md) for the complete architecture and [HANDOVER.md](HANDOVER.md) for current validation and outstanding work. A complete synthetic English conversation passed through the local LiveKit and STT/LLM/TTS pipeline. Real vendor calls, Indian-language quality and public deployment still need validation; no paid services were used.

The prepared persistent Raisina studio is available on this Mac. See [local studio instructions](docs/LOCAL_STUDIO.md) for login-file location, BOQ review steps and service startup. Real local speech-to-quotation extraction and browser microphone controls have passed; no actual vendor prices were populated.

```sh
npm ci
npm run dev
```

The local demo is at http://127.0.0.1:5178. For persistent studio accounts:

```sh
node scripts/configure-local.mjs  # once; do not rerun over existing .env
npm run build
npm run user:create -- you@example.com "Your studio"
npm run server
```

See [Hosting and voice setup](docs/HOSTING_AND_VOICE.md) for local models, LiveKit, Linux hosting, SIP, backups and the limits of free deployment. Check HANDOVER before starting servers: a temporary test API may already occupy port8787.

```sh
npm test
npm run check:server
npm run test:server
npm run test:e2e
agent/.venv/bin/python -m pytest agent/tests -q
```

Use Node22.22+ for a fresh install. Credentials belong only in ignored server configuration, never frontend code or committed files.
