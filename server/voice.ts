import { AccessToken, AgentDispatchClient, RoomServiceClient, SipClient } from 'livekit-server-sdk';
import type { Workspace } from '../src/lib/types';
export function voiceConfig() {
  const required = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'AGENT_CALLBACK_SECRET',
  ];
  const missing = required.filter((k) => !process.env[k]);
  return {
    configured: !missing.length,
    missing,
    browserUrl: process.env.LIVEKIT_PUBLIC_URL || process.env.LIVEKIT_URL || '',
    outboundEnabled:
      process.env.ENABLE_OUTBOUND_CALLS === 'true' && !!process.env.LIVEKIT_SIP_TRUNK_ID,
    maxSeconds: Math.max(30, Math.min(900, Number(process.env.CALL_MAX_SECONDS) || 300)),
  };
}
export function callBrief(w: Workspace, enquiryId: string) {
  const e = w.enquiries.find((e) => e.id === enquiryId);
  const p = w.projects.find((p) => p.id === e?.projectId);
  const v = w.vendors.find((v) => v.id === e?.vendorId);
  if (!e || !p || !v) throw new Error('The enquiry, project or vendor no longer exists.');
  const items = p.items.filter((i) => e.itemIds.includes(i.id));
  if (!items.length || items.length > 20 || items.length !== e.itemIds.length)
    throw new Error('Use an enquiry with 1–20 current BOQ items per call.');
  return {
    company: w.settings.company,
    project: p.name,
    location: p.location,
    vendor: v.name,
    phone: v.phone,
    notes: e.notes,
    generalNotes: p.generalNotes || '',
    items: items.map((i) => ({
      id: i.id,
      reference: i.reference,
      description: i.description,
      specification: i.specification,
      context: i.context,
      unit: i.unit,
      quantity: i.quantity,
      quantityKind: i.quantityKind,
    })),
  };
}
export function clients() {
  const url = process.env.LIVEKIT_URL!.replace(/^ws/, 'http');
  const key = process.env.LIVEKIT_API_KEY!,
    secret = process.env.LIVEKIT_API_SECRET!;
  return {
    rooms: new RoomServiceClient(url, key, secret),
    dispatch: new AgentDispatchClient(url, key, secret),
    sip: new SipClient(url, key, secret),
  };
}
export async function startRoom(
  id: string,
  userId: string,
  mode: string,
  brief: ReturnType<typeof callBrief>,
) {
  const { rooms, dispatch, sip } = clients();
  const room = `nivo-${id}`;
  await rooms.createRoom({
    name: room,
    emptyTimeout: 60,
    maxParticipants: 2,
    metadata: JSON.stringify({ callId: id }),
  });
  try {
    await dispatch.createDispatch(room, 'nivo-quotes', {
      metadata: JSON.stringify({ callId: id }),
    });
    if (mode === 'phone') {
      await sip.createSipParticipant(process.env.LIVEKIT_SIP_TRUNK_ID!, brief.phone, room, {
        participantIdentity: `vendor-${id}`,
        participantName: brief.vendor,
        playDialtone: false,
        waitUntilAnswered: false,
      });
    }
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: `tester-${userId}`,
      ttl: '5m',
    });
    token.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });
    return {
      room,
      token: mode === 'browser' ? await token.toJwt() : undefined,
      url: voiceConfig().browserUrl,
    };
  } catch (e) {
    await rooms.deleteRoom(room).catch(() => {});
    throw e;
  }
}
export async function agentReachable() {
  try {
    const r = await fetch(process.env.AGENT_HEALTH_URL || 'http://127.0.0.1:8081/', {
      signal: AbortSignal.timeout(2000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
export async function endRoom(room: string) {
  try {
    await clients().rooms.deleteRoom(room);
  } catch (error) {
    // A worker can delete the room before the browser's End request arrives.
    if ((error as { code?: string }).code !== 'not_found') throw error;
  }
}
