# Using the prepared local studio

Open http://127.0.0.1:5178 and sign in with `owner@nivo.local`. Its generated password is in `data/local-studio-login.json` (private and ignored by Git). This is a local login identifier, not an external email account. The persistent database is `data/nivo.sqlite`.

The Raisina electrical BOQ is already imported:112 unpriced items, including25 rate-only lines and one unknown quantity at source row188 (managed switch). Four existing source rates have not been accepted as purchase costs. The original workbook is retained intact. Client, location and due date need confirmation;20% markup and18% GST are reviewable defaults.

1. In **BOQ workbench**, open Project details and Pricing settings. Confirm the commercial metadata and defaults.
2. Review inherited specifications in item details. Resolve the row188 quantity before approving a priced BOQ.
3. Add your actual vendor in **Vendors**. A browser-only test can use a clearly named internal tester with no telephone number.
4. In **Enquiry desk**, select that vendor and1–20 relevant items; prepare the brief. **Test in browser** uses your microphone so you can play the vendor. Use headphones and speak English for the tested baseline.
5. End the call, extract drafts and review each quotation. Unknown tax or mismatched units leave the price field blank for explicit confirmation/conversion. Record the quotation, then apply the rate to the BOQ separately.
6. Review priced items before approval. Use **Client quotation** for a clean selling-price workbook. The **original internal** export retains all original sheets and may contain private source information. Unpriced source cells remain unchanged; a formula in a priced rate cell blocks that export with its address.

Ordinary telephone calls require your own SIP carrier, verified caller number, credentials and supported routes. Outbound remains disabled. No vendor was called or quoted during setup; all live voice tests used synthetic speech and test data. Hindi/Hinglish, real handsets and public hosting remain unvalidated.

## Current listening test: Ollama + Deepgram

Configured 23 September 2026: Nova-3 English recognition, **Meena Indian English** speech (`flux-meena-en`), local `qwen3:4b-instruct` conversation and extraction. Deepgram uses your supplied key/credits; Groq is inactive. [Deepgram voice catalog](https://developers.deepgram.com/docs/flux-tts/voices) also lists Priya (`flux-priya-en`) and Naveen (`flux-naveen-en`). Change `DEEPGRAM_TTS_MODEL` in private `.env` and restart the worker to try another voice; only Meena was tested here.

Use headphones, add an internal tester vendor without a phone number, and prepare an enquiry for one or two Raisina items. Open the enquiry and choose **Test in browser**, allow microphone access, then answer the disclosure as the vendor. **End call** stops it. Calls have a three-minute maximum and a 30-second inactivity timeout. This is a local browser call; telephone dialing remains disabled.

A synthetic Deepgram/Ollama conversation and Chrome call controls passed. Ollama still sometimes invokes hangup prematurely, and extraction is not consistently accurate. Review every draft; test prices never enter your BOQ automatically. Keep the Mac awake and the services below running. Your browser audio goes to Deepgram for recognition/speech; the LLM remains on this Mac.

## Restarting on this Mac

Run from the repository root, in separate terminals, with a Node22.22+ environment where available. Existing validation used22.14. Keep `.env` and `deploy/generated` intact; do not rerun the config generator over them.

```sh
npm run server
npm run dev
livekit-server --config deploy/generated/livekit.yaml --bind 127.0.0.1 --node-ip 127.0.0.1
OLLAMA_NO_CLOUD=1 OLLAMA_HOST=127.0.0.1:11434 OLLAMA_MODELS="$PWD/models/ollama" data/tools/ollama/ollama serve
DPDFNET_ENABLED=true agent/.venv/bin/python -m agent.worker dev
```

The worker does not hot-reload. Start only one process for each service; HANDOVER.md records the last running PIDs. Keep the computer awake while testing. Use port5178 for the browser; configured origin validation expects that origin.

## Private artifacts and verification

- `data/raisina/prepared/workspace.nivo.json`: complete restorable workspace and original workbook. Settings restore replaces the workspace, so only restore deliberately.
- `data/raisina/prepared/readiness.json`: source hash, unresolved row, source-rate references and parser warnings.
- `data/raisina/config.json`: explicit mapping used for preparation.
- `data/backups/`: consistent SQLite backup, including account/workbook data.
- `data/verification/`: inspected real-browser screenshots. Contains private project information; keep it local.

```sh
node scripts/verify-local-studio.mjs
node --env-file=.env --import tsx scripts/backup-server.ts data/backups
```

For future workbook preparation, `scripts/prepare-boq.ts` accepts an XLSX path, a JSON config containing `mapping`, `name`, `company`, `category` and optional client/location/dueDate/markup/GST, then an output directory. It writes a private backup without modifying the input and refuses to overwrite existing outputs. `scripts/setup-local-studio.ts` accepts a prepared backup and optional login email; it refuses an existing studio or credentials file.

Synthetic integration tools are separate: `scripts/voice-test-server.ts` uses an in-memory database on8787, `agent.smoke_session` tests speech through extraction, and `scripts/smoke-browser.mjs` checks microphone controls. **Stop the persistent API before starting the synthetic API**, and restart the persistent API afterward. Never use synthetic login credentials for the real studio. For deployment/SIP configuration see [HOSTING_AND_VOICE.md](HOSTING_AND_VOICE.md).
