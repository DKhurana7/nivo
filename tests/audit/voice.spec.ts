import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { clients } from '../../server/voice';

// Run explicitly after scripts/audit-voice.mjs and the speech smoke, never as
// part of the offline suite. The only real transport used here is WebRTC.
test.skip(
  process.env.NIVO_AUDIT_VOICE !== '1',
  'Requires the local voice stack and fictional voice fixture',
);
test.use({
  extraHTTPHeaders: { 'X-Forwarded-For': '198.18.1.3' },
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});
const headers = { 'X-Nivo-Request': '1' };
test.beforeAll(() => process.loadEnvFile('.env'));
test.beforeEach(async ({ page }) => {
  const login = JSON.parse(readFileSync('data/audit-voice-login.json', 'utf8'));
  expect(login.email).toBe('alpha@audit.local');
  expect((await page.request.post('/api/login', { headers, data: login })).status()).toBe(200);
  const status = await (await page.request.get('/api/voice/status')).json();
  expect(status.outboundEnabled).toBe(false);
  expect(status.agentVerified).toBe(true);
  await page.goto('/#enquiries');
  await page.locator('.enquiry-row').first().click();
});

test('overview does not declare configured healthy voice disconnected', async ({ page }) => {
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.evaluate(() => {
    location.hash = 'overview';
  });
  await expect(page.locator('.voice-availability')).not.toHaveText(
    'Voice calling is not connected',
  );
  await page.getByRole('button', { name: 'Open enquiry desk', exact: true }).click();
  await page.locator('.enquiry-row').first().click();
  await expect(page.locator('.voice-desk')).toContainText('Worker connected');
});

test('browser transport, disclosure, mute, concurrent refusal and room deletion', async ({
  page,
}) => {
  test.setTimeout(120000);
  const desk = page.locator('.voice-desk');
  await expect(desk).toContainText('Worker connected');
  await desk.locator('.phone-options summary').click();
  await expect(desk.getByRole('button', { name: 'Call vendor', exact: true })).toBeDisabled();
  await desk.getByRole('checkbox').check();
  await expect(desk.getByRole('button', { name: 'Call vendor', exact: true })).toBeDisabled();
  const refused = await page.request.post('/api/calls', {
    headers,
    data: {
      enquiryId: 'audit-voice-enquiry',
      mode: 'phone',
      confirmed: true,
      requestId: crypto.randomUUID(),
    },
  });
  expect(refused.status()).toBe(403);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/calls') && r.request().method() === 'POST',
  );
  await desk.getByRole('button', { name: 'Test in browser' }).click();
  const call = await (await response).json();
  try {
    await expect(desk).toContainText('Microphone connected', { timeout: 30000 });
    await expect(desk.getByRole('log')).toContainText(/automated|assistant|transcri/i, {
      timeout: 90000,
    });
    await expect.poll(() => page.locator('.voice-desk audio').count()).toBeGreaterThan(0);
    await desk.getByRole('button', { name: 'Mute microphone', exact: true }).click();
    await expect(
      desk.getByRole('button', { name: 'Unmute microphone', exact: true }),
    ).toBeVisible();
    const { rooms } = clients();
    const muted = await rooms.listParticipants(`nivo-${call.id}`);
    expect(muted.find((p) => p.identity.startsWith('tester-'))?.tracks.every((t) => t.muted)).toBe(
      true,
    );
    await desk.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
    await expect(desk.getByRole('button', { name: 'Mute microphone', exact: true })).toBeVisible();
    await expect
      .poll(async () =>
        (await rooms.listParticipants(`nivo-${call.id}`))
          .find((p) => p.identity.startsWith('tester-'))
          ?.tracks.some((t) => !t.muted),
      )
      .toBe(true);
    const second = await page.request.post('/api/calls', {
      headers,
      data: { enquiryId: 'audit-voice-enquiry', mode: 'browser', requestId: crypto.randomUUID() },
    });
    expect(second.status()).toBe(409);
    await desk.getByRole('button', { name: 'End call', exact: true }).click();
    await expect
      .poll(async () => (await (await page.request.get(`/api/calls/${call.id}`)).json()).status)
      .toBe('ended');
    await expect.poll(async () => (await rooms.listRooms([`nivo-${call.id}`])).length).toBe(0);
    await page.screenshot({ path: 'data/audit-ui/voice-ended-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'data/audit-ui/voice-ended-phone.png', fullPage: true });
  } finally {
    if (call.id) await page.request.post(`/api/calls/${call.id}/end`, { headers });
  }
});

test('closing the desk during actual room creation leaves no orphan', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let callId = '';
  await page.route('**/api/calls', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    callId = (await response.json()).id;
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Test in browser' }).click();
  await expect.poll(() => callId).not.toBe('');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  release();
  await expect
    .poll(async () => (await (await page.request.get(`/api/calls/${callId}`)).json()).status)
    .toBe('ended');
  await expect
    .poll(async () => (await clients().rooms.listRooms([`nivo-${callId}`])).length)
    .toBe(0);
});

test('speech extraction remains a draft and saving preserves transcript evidence', async ({
  page,
}) => {
  const all = await (await page.request.get('/api/calls')).json();
  const call = all.find(
    (c: any) => c.enquiryId === 'audit-voice-enquiry' && c.drafts.some((d: any) => d.cost === 125),
  );
  expect(call, 'Run agent.smoke_session against the audit fixture first').toBeTruthy();
  const workspace = await (await page.request.get('/api/workspace')).json();
  expect(workspace.workspace.projects[0].items[0].cost).toBeNull();
  await page.getByRole('combobox', { name: /^Conversation/ }).selectOption(call.id);
  const extraction = page.waitForResponse((r) => r.url().endsWith(`/calls/${call.id}/extract`));
  await page.getByRole('button', { name: 'Extract quotation drafts', exact: true }).click();
  const response = await extraction;
  if (response.status() === 422) {
    // A real model can return an unverifiable excerpt. Preserve the earlier
    // validated draft and make the refusal visible; never relax evidence checks.
    await expect(page.getByRole('alert')).toContainText('transcript evidence');
    const retained = await (await page.request.get(`/api/calls/${call.id}`)).json();
    expect(retained.drafts).toEqual(call.drafts);
    console.log(
      'Live re-extraction safely refused unverifiable evidence; prior validated draft retained.',
    );
  } else {
    expect(response.status()).toBe(200);
  }
  expect(
    (await (await page.request.get('/api/workspace')).json()).workspace.projects[0].items[0].cost,
  ).toBeNull();
  await expect(page.getByRole('log')).toContainText(
    call.transcript.find((t: any) => t.role === 'user').text,
  );
  await page.getByRole('button', { name: 'Review & record quotation' }).click();
  const form = page.getByRole('dialog', { name: 'Record a quotation' });
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await expect(form.getByLabel('Unit cost (₹)', { exact: true })).toHaveValue('125');
  await expect(form.locator('textarea[name="notes"]')).toContainText(call.drafts[0].evidence);
  await form.getByLabel('Delivery location').fill('Fictional audit site');
  await form.getByRole('button', { name: 'Save quotation' }).click();
  await expect
    .poll(async () => {
      const w = await (await page.request.get('/api/workspace')).json();
      return w.workspace.rates.find((r: any) => r.sourceRef === `Voice call ${call.id}`)?.notes;
    })
    .toContain(call.drafts[0].evidence);
  expect(
    (await (await page.request.get('/api/workspace')).json()).workspace.projects[0].items[0].cost,
  ).toBeNull();
});
