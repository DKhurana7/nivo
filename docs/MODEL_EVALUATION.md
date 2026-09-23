# Model evaluation: 23 September 2026

## Local Ollama result

Tested `qwen3:4b-instruct` on the user's Apple M3 Pro with 18 GiB RAM. Ollama 0.34.2 uses Metal; its service had stopped and was restarted with cloud features disabled. The benchmark uses fictional BOQ data, the worker's actual instruction function, and the production extraction function. It does not read or modify the studio database.

| Measurement                                              | Observed result                                |
| -------------------------------------------------------- | ---------------------------------------------- |
| Warm text-only first response text, six requests         | 0.104–0.223 seconds                            |
| Text-only first completed sentence                       | 0.202–0.442 seconds                            |
| Full text-only response                                  | 0.453–2.587 seconds                            |
| Extraction correctness checks                            | 8 of 12 passed: six cases, each repeated twice |
| Extraction median completion                             | 2.286 seconds                                  |
| Explicit auto-tool selection, normal conversation probes | Premature `end_call` in 3 of 4 requests        |
| Explicit auto-tool selection, opt-out probes             | Correct `end_call` in 2 of 2 requests          |

The first request after restart took 6.618 seconds but returned only an end-call tool selection, not spoken text. The earlier omitted-tool-choice run ended all four normal-conversation probes. The explicit `auto` control was added to distinguish model behavior from omitted request options. These are isolated LLM probes with a representative end-call schema, not a new full LiveKit session or a universal failure rate.

Simple excluding-GST, including-GST and ambiguous “GSD” quotes passed; no-price transcripts produced no invented price. Corrected prices failed exact-evidence validation (422, nothing saved). Coil-based quotes were left unpriced rather than captured in the quoted unit. The text-only output could also become verbose or ask multiple questions despite the prompt. **Local inference is fast enough to investigate further, but the current model is not reliable enough for unsupervised vendor calls.** Do not remove the end-call tool or evidence validator to make results appear better.

The text timings exclude microphone capture, end-of-speech detection, STT, TTS and network/playback delays. They are not end-to-end voice latency. Twelve synthetic checks cannot establish production accuracy or Hindi/Hinglish quality.

## Reproduction

```sh
node --env-file=.env --import tsx scripts/benchmark-model.ts
NIVO_EVAL_TEXT_ONLY=1 NIVO_EVAL_VOICE_ONLY=1 node --env-file=.env --import tsx scripts/benchmark-model.ts
NIVO_EVAL_VOICE_ONLY=1 node --env-file=.env --import tsx scripts/benchmark-model.ts
```

The script refuses remote endpoints. It writes ignored `data/model-evals/latest.json`; preserve that output between runs. This session retained `ollama-default-tools.json`, `ollama-text-only.json`, and `ollama-auto-tools.json`. The ordinary benchmark now requests explicit automatic tool selection. Backend typechecking includes the script.

## Cloud choice and current credentials

The user prefers testing free Gemini models if local Ollama is unsuitable, with Deepgram managed Voice Agent as a fallback. Groq is no longer the assumed default: its [billing documentation](https://console.groq.com/docs/billing-faqs) still describes Free versus paid Developer tiers, but the user sees pay-as-you-go and their account's plan has not been verified.

Google currently lists free input/output for `gemini-2.5-flash`, `gemini-2.5-flash-lite`, and `gemini-3.1-flash-lite`. Start with Flash-Lite for a latency comparison and Flash for extraction comparison, using models actually enabled in the user's AI Studio project. [Pricing](https://ai.google.dev/gemini-api/docs/pricing), [project-specific limits](https://ai.google.dev/gemini-api/docs/rate-limits). Free-tier prompts can be used for product improvement, so initial evaluation must remain synthetic/redacted. No Gemini key is configured or tested.

Nivo's compatible chat endpoints can target `https://generativelanguage.googleapis.com/v1beta/openai/` through `LLM_BASE_URL` and `EXTRACTION_BASE_URL`, with separate configured model/key settings. Google's endpoint supports streaming and function calling, but Nivo's exact tool schema, token limits, JSON extraction and end-to-end audio must be tested before claiming compatibility. [Google compatibility documentation](https://ai.google.dev/gemini-api/docs/openai). No live provider switch was made.

After the user added their own Deepgram and Groq keys to ignored `.env`, `node --env-file=.env scripts/check-provider-keys.mjs` confirmed **HTTP 200 authentication for both**. Groq returned 11 models. Deepgram project listing succeeded but member/balance queries returned 403, so account ownership and credit balance are not verified. Account/project labels were shown privately to the user and are not copied here. Neither inference quota nor billable API execution was tested. Keys were not printed, committed, or copied from another project.
