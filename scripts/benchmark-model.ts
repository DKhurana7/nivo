/** Synthetic-only model evaluation. Never reads or writes a studio database. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { extractQuotes } from '../server/extraction';

const base = process.env.LLM_BASE_URL || 'http://127.0.0.1:11434/v1';
const model = process.env.LLM_MODEL || 'qwen3:4b-instruct';
const textOnly = process.env.NIVO_EVAL_TEXT_ONLY === '1';
const voiceOnly = process.env.NIVO_EVAL_VOICE_ONLY === '1';
for (const endpoint of [base, process.env.EXTRACTION_BASE_URL || '']) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(endpoint).hostname))
    throw new Error(
      'This benchmark is local-only. Do not send data or spend cloud credits implicitly.',
    );
}
const brief = {
  company: 'Synthetic Studio',
  project: 'Synthetic electrical BOQ',
  location: 'Delhi',
  vendor: 'Synthetic Vendor',
  phone: '',
  notes: '',
  generalNotes: '',
  items: [
    {
      id: 'cable-1',
      reference: '1',
      context: undefined,
      brand: undefined,
      model: undefined,
      description: 'FRLS copper cable',
      specification: '2.5 sq mm, supply only',
      unit: 'm',
      quantity: 100,
      quantityKind: 'measured' as const,
    },
  ],
};
const system = execFileSync(
  'agent/.venv/bin/python',
  [
    '-c',
    'import json,sys; from agent.worker import instructions; print(instructions(json.load(sys.stdin), "English"))',
  ],
  { input: JSON.stringify(brief), encoding: 'utf8' },
).trim();
const round = (v: number) => Math.round(v * 1000) / 1000;
const voice: any[] = [];
const extraction: any[] = [];
const tools = [
  {
    type: 'function',
    function: {
      name: 'end_call',
      description:
        'End after refusal, wrong number, voicemail, or a completed quotation and goodbye.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];
const cases = [
  ['consent', 'Yes, you may transcribe. Which cable do you need?'],
  [
    'quote',
    'The 2.5 square millimetre FRLS copper cable is 125 rupees per metre excluding GST. Supply only, delivery extra, valid for seven days.',
  ],
  ['refusal', 'No. I do not consent. Do not call me again. End the call.'],
];
for (let repeat = 0; repeat < 2; repeat++) {
  for (const [name, vendor] of cases) {
    const start = performance.now();
    let firstTextMs: number | null = null,
      firstSentenceMs: number | null = null;
    let answer = '',
      toolName = '',
      pending = '';
    const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LLM_API_KEY || 'local'}`,
      },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.2,
        max_completion_tokens: 220,
        ...(textOnly ? {} : { tools, tool_choice: 'auto' }),
        messages: [
          { role: 'system', content: system },
          {
            role: 'assistant',
            content:
              'Hello, I am Nivo, an automated quotation assistant. May I continue and transcribe our conversation?',
          },
          { role: 'user', content: vendor },
        ],
      }),
    });
    if (!response.ok || !response.body) throw new Error(`LLM HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith('data: ') || line.slice(6).trim() === '[DONE]') continue;
        const chunk = JSON.parse(line.slice(6));
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          firstTextMs ??= performance.now() - start;
          answer += delta.content;
          if (/[.!?](?:\s|$)/.test(answer)) firstSentenceMs ??= performance.now() - start;
        }
        for (const call of delta?.tool_calls || []) toolName += call.function?.name || '';
      }
    }
    const result = {
      name,
      repeat,
      firstRequest: voice.length === 0,
      textOnly,
      firstTextSeconds: firstTextMs === null ? null : round(firstTextMs / 1000),
      firstSentenceSeconds: firstSentenceMs === null ? null : round(firstSentenceMs / 1000),
      totalSeconds: round((performance.now() - start) / 1000),
      answer,
      toolName,
      refusalToolPassed: name === 'refusal' ? toolName.includes('end_call') : null,
    };
    voice.push(result);
    console.log(JSON.stringify({ stage: 'voice', ...result }));
  }
}
const checks = [
  {
    name: 'excluding-gst',
    vendor:
      'The FRLS cable is 125 rupees per metre excluding GST. Supply only, delivery extra, valid seven days.',
    cost: 125,
    basis: 'excluding-gst',
  },
  {
    name: 'including-gst',
    vendor: 'The FRLS cable is 147.50 rupees per metre including GST.',
    cost: 147.5,
    basis: 'including-gst',
  },
  {
    name: 'unclear-tax-word',
    vendor: 'The FRLS cable is 125 rupees per metre excluding GSD.',
    cost: 125,
    basis: 'unknown',
  },
  {
    name: 'corrected-price',
    vendor:
      'The FRLS cable is not 125 rupees. The correct price is 135 rupees per metre excluding GST.',
    cost: 135,
    basis: 'excluding-gst',
  },
  {
    name: 'different-unit',
    vendor:
      'The FRLS cable is 11250 rupees per 90-metre coil excluding GST. I have not quoted a per-metre rate.',
    cost: 11250,
    basis: 'excluding-gst',
    unit: 'coil',
  },
  {
    name: 'no-vendor-price',
    vendor: 'I cannot quote a price yet. I will check stock and call you back.',
    cost: null,
    basis: 'unknown',
  },
];
for (let repeat = 0; repeat < (voiceOnly ? 0 : 2); repeat++) {
  for (const c of checks) {
    const start = performance.now();
    try {
      const drafts = await extractQuotes(brief, [
        { role: 'assistant', text: 'Would 100 rupees per metre excluding GST be possible?' },
        { role: 'user', text: c.vendor },
      ]);
      const passed =
        c.cost === null
          ? drafts.every((d) => d.cost === null)
          : drafts.length === 1 &&
            drafts[0].cost === c.cost &&
            drafts[0].basis === c.basis &&
            (c.unit
              ? /coil/i.test(drafts[0].unit)
              : /^(m|mtr|metre|meter|metres|meters)$/i.test(drafts[0].unit));
      const result = {
        name: c.name,
        repeat,
        seconds: round((performance.now() - start) / 1000),
        passed,
        drafts,
      };
      extraction.push(result);
      console.log(JSON.stringify({ stage: 'extraction', ...result }));
    } catch (error) {
      const result = {
        name: c.name,
        repeat,
        seconds: round((performance.now() - start) / 1000),
        passed: false,
        error: (error as Error).message,
        statusCode: (error as { statusCode?: number }).statusCode,
      };
      extraction.push(result);
      console.log(JSON.stringify({ stage: 'extraction', ...result }));
    }
  }
}
const median = (values: number[]) => {
  if (!values.length) return null;
  const a = [...values].sort((a, b) => a - b);
  const n = a.length;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
};
const warmText = voice
  .slice(1)
  .map((r) => r.firstTextSeconds)
  .filter((v) => v !== null);
const summary = {
  model,
  textOnly,
  firstRequestTextSeconds: voice[0].firstTextSeconds,
  subsequentFirstTextMedianSeconds: median(warmText),
  subsequentFirstTextRangeSeconds: warmText.length
    ? [Math.min(...warmText), Math.max(...warmText)]
    : null,
  extractionPassed: extraction.filter((r) => r.passed).length,
  extractionTotal: extraction.length,
  extractionMedianSeconds: median(extraction.map((r) => r.seconds)),
  refusalToolsPassed: voice.filter((r) => r.refusalToolPassed).length,
  limits:
    'Small synthetic English sample; LLM-only timing, not STT/endpointing/TTS/WebRTC latency or a general accuracy percentage.',
};
mkdirSync('data/model-evals', { recursive: true, mode: 0o700 });
writeFileSync(
  'data/model-evals/latest.json',
  JSON.stringify({ timestamp: new Date().toISOString(), summary, voice, extraction }, null, 2),
  { mode: 0o600 },
);
console.log(JSON.stringify({ stage: 'summary', ...summary }));
