// Read-only authentication checks. No inference, audio uploads, or secret output.
async function get(url, authorization) {
  const response = await fetch(url, {
    headers: { Authorization: authorization },
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, body: response.ok ? await response.json() : null };
}
const results = await Promise.allSettled([
  (async () => {
    const key = process.env.GROQ_API_KEY;
    if (!key) return { provider: 'Groq', configured: false };
    const r = await get('https://api.groq.com/openai/v1/models', `Bearer ${key}`);
    return {
      provider: 'Groq',
      status: r.status,
      authenticated: r.status === 200,
      modelCount: r.body?.data?.length,
      candidateModels: r.body?.data
        ?.filter((m) => /llama-3\.1-8b|gpt-oss|qwen/i.test(m.id))
        .map((m) => m.id),
      note: 'Model listing does not establish free billing, inference quota, or completion quality.',
    };
  })(),
  (async () => {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) return { provider: 'Deepgram', configured: false };
    const r = await get('https://api.deepgram.com/v1/projects', `Token ${key}`);
    const projects = [];
    for (const p of r.body?.projects || []) {
      const [members, balances] = await Promise.all([
        get(
          `https://api.deepgram.com/v1/projects/${encodeURIComponent(p.project_id)}/members`,
          `Token ${key}`,
        ),
        get(
          `https://api.deepgram.com/v1/projects/${encodeURIComponent(p.project_id)}/balances`,
          `Token ${key}`,
        ),
      ]);
      projects.push({
        name: p.name,
        membersStatus: members.status,
        memberEmails: members.body?.members?.map((m) => m.email),
        balancesStatus: balances.status,
        balances: balances.body?.balances?.map((b) => ({ amount: b.amount, units: b.units })),
      });
    }
    return {
      provider: 'Deepgram',
      status: r.status,
      authenticated: r.status === 200,
      projects,
      note: 'Project membership identifies associated emails, not necessarily the key creator. No speech API request made.',
    };
  })(),
]);
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  if (result.status === 'fulfilled') console.log(JSON.stringify(result.value));
  else
    console.log(
      JSON.stringify({
        provider: i ? 'Deepgram' : 'Groq',
        error: 'Network or response error; authentication not established.',
      }),
    );
}
