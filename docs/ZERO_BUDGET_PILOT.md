# Technosmart pilot: zero-budget deployment and models

Decision recorded 23 September 2026: Technosmart only, one operator testing one real BOQ, no monthly spending. Multi-firm/member features are deferred. Use existing free hosting accounts and provider subdomains; Deepgram credits are preferred. No paid upgrade, automatic top-up or telephone carrier purchase is authorized.

## Recommended deployment target

Netlify Free for the frontend and its supplied `.netlify.app` hostname; Supabase Free for authenticated data and private workbook storage. This is a target, **not a deployed or drop-in configuration**: current Fastify/SQLite persistence must be adapted and migrated on copies, preserving revision conflicts, authentication, exact workbook bytes and private exports. Netlify static hosting alone cannot run the current persistent API or Python worker.

Netlify Free supports commercial projects and currently has 300 monthly credits. Supabase Free lists a 500 MB database, 1 GB file storage and pausing after one inactive week. Vercel Hobby restricts use to personal/non-commercial projects. Railway Free supplies only $1/month after a $5/30-day trial, insufficient to promise always-on app plus voice/model hosting. Sources checked 23 September 2026: [Netlify pricing](https://www.netlify.com/pricing/), [commercial use](https://www.netlify.com/blog/introducing-netlify-free-plan/), [Supabase](https://supabase.com/pricing), [Vercel](https://vercel.com/docs/plans/hobby), [Railway](https://railway.com/pricing).

For the existing LiveKit pipeline, investigate LiveKit Cloud Build: 1,000 hosted agent-session minutes/month with a hard free-plan cap. Provider inference is separate; remote worker readiness and durable callbacks need adaptation. Keeping the worker local is another option but requires the Mac to be running and reachable. Neither topology is configured remotely yet. [LiveKit quotas](https://docs.livekit.io/deploy/admin/quotas-and-limits/).

## LLM options

| Option                       | Benefit                                                                          | Limitation / use                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Groq Free                    | Recommended first cloud candidate; compatible chat API and a free developer tier | Account/model quotas apply; evaluate speech tool calls and exact-evidence extraction before selecting a model. No promise of a specific model's free availability. |
| Gemini API free tier         | Free access to selected models; useful extraction comparison                     | Free-tier data may be used to improve products. Use synthetic/redacted material for evaluation; do not silently route private BOQs/transcripts there.              |
| Local Ollama                 | Already working; no API charge or external model data transfer                   | Mac must run; speed and extraction repeatability remain constraints. Electricity/hardware are not free.                                                            |
| Deepgram managed Voice Agent | Can include STT, LLM and TTS under the same credit balance                       | Requires a new integration; does not itself pay for telephone minutes or app hosting.                                                                              |

[Groq limits](https://console.groq.com/docs/rate-limits), [Groq billing](https://console.groq.com/docs/billing-faqs), [Gemini pricing/data use](https://ai.google.dev/gemini-api/docs/pricing). Cloudflare Workers AI is another capped option (10,000 neurons/day), but some models require a paid plan: [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [restricted models](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/).

Deepgram advertises $200 signup credit and Standard managed-agent pricing of $0.075/minute. Arithmetic upper bound: about 2,667 minutes / 44 hours if all $200 is available and spent solely on that tier; actual balance, taxes, other API usage and grant terms must be checked. Its startup program advertises up to $100,000 over 12 months **if accepted**; eligibility/award is not established. [Pricing](https://deepgram.com/pricing), [startup program](https://offers.deepgram.com/startup-program).

Do not assume Google's $300 Cloud welcome credit funds the Gemini Developer API: current billing documentation explicitly excludes it from March 2026. Vertex AI is a separate service whose eligible credits/access need checking before use. [Gemini billing](https://ai.google.dev/gemini-api/docs/billing).

## Implemented now and next steps

- Existing worker accepts `STT_PROVIDER=deepgram`; added `TTS_PROVIDER=deepgram` and `DEEPGRAM_TTS_MODEL` (default `aura-2-andromeda-en`) using the installed LiveKit plugin. Local defaults and live `.env` remain unchanged.
- Six Python tests and offline construction of both Deepgram providers pass. No authenticated Deepgram call was made. Its managed Voice Agent API remains an alternative, not an implemented backend.
- Deepgram's current TTS catalog lists English options, including newer Flux Indian-English voices, but not Hindi. The installed plugin path above uses Aura-2; Flux support is not claimed. English versus Hindi/Hinglish for the pilot is pending. [TTS catalog](https://developers.deepgram.com/docs/tts-models-languages-overview).
- Netlify and Railway CLI authentication were verified read-only. No Nivo Netlify site is linked. Supabase CLI has no access token. No account plan/credit balance has been verified and no new site/project was created.
- Deepgram/Groq keys and Supabase configuration are absent from Nivo's private `.env`. Supply keys through private local configuration or provider secret storage, never chat or `VITE_*` variables.
- Next implement the selected free-host backend/storage path and test migration on copies, then configure credit-funded providers and evaluate a synthetic conversation. Import the user's BOQ into the intended private account only after login/storage/export checks pass. Do not migrate the live studio destructively.
