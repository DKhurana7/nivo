import { useEffect, useRef, useState } from 'react';
import { api, remote, flushWorkspace } from '../lib/api';
import type { Enquiry, Workspace, Rate } from '../lib/types';
import { Badge, Field, Icon } from './ui';
import { RateForm } from './forms';
import { normalUnit } from '../lib/costing';
type Draft = {
  itemId: string;
  unit: string;
  cost: number | null;
  basis: string;
  brand: string;
  model?: string;
  terms: string;
  evidence: string;
};
type Call = {
  id: string;
  enquiryId: string;
  mode: string;
  status: string;
  created: number;
  error: string;
  transcript: { role: string; text: string }[];
  drafts: Draft[];
};
type Status = {
  configured: boolean;
  reachable: boolean;
  agentVerified: boolean;
  outboundEnabled: boolean;
  missing: string[];
  extractionConfigured: boolean;
};
export function VoiceDesk({
  enquiry,
  workspace,
  onRate,
}: {
  enquiry: Enquiry;
  workspace: Workspace;
  onRate: (r: Rate, e: Enquiry) => void;
}) {
  const [status, setStatus] = useState<Status>(),
    [calls, setCalls] = useState<Call[]>([]),
    [activeId, setActiveId] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [consent, setConsent] = useState(false),
    [connected, setConnected] = useState(false),
    [muted, setMuted] = useState(false),
    [review, setReview] = useState<{ draft: Draft; call: Call } | null>(null);
  const room = useRef<import('livekit-client').Room | null>(null),
    audio = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const attempt = useRef(0);
  const project = workspace.projects.find((p) => p.id === enquiry.projectId),
    vendor = workspace.vendors.find((v) => v.id === enquiry.vendorId);
  const current = calls.find((c) => c.id === activeId) || calls[0];
  async function refresh() {
    const all = await api<Call[]>('/calls');
    if (mounted.current) setCalls(all.filter((c) => c.enquiryId === enquiry.id));
  }
  useEffect(() => {
    mounted.current = true;
    if (!remote) return;
    void api<Status>('/voice/status')
      .then(setStatus)
      .catch((e) => setError(e.message));
    void refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => void refresh().catch(() => {}), 2500);
    return () => {
      mounted.current = false;
      attempt.current++;
      clearInterval(timer);
      void room.current?.disconnect();
    };
  }, [enquiry.id]);
  useEffect(() => {
    if (current && ['ended', 'failed'].includes(current.status)) {
      void room.current?.disconnect();
      setConnected(false);
    }
  }, [current?.status]);
  async function start(mode: 'browser' | 'phone') {
    const currentAttempt = ++attempt.current;
    const ensureOpen = () => {
      if (!mounted.current || attempt.current !== currentAttempt)
        throw new Error('Voice workspace closed during setup.');
    };
    setBusy(true);
    setError('');
    let callId = '';
    try {
      if (mode === 'browser' && !window.isSecureContext)
        throw new Error('Microphone access needs HTTPS or localhost.');
      // Permission first, before a server room is created.
      if (mode === 'browser') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
      ensureOpen();
      await flushWorkspace();
      ensureOpen();
      const result = await api<Call & { token?: string; url: string }>('/calls', {
        method: 'POST',
        body: JSON.stringify({
          enquiryId: enquiry.id,
          mode,
          confirmed: consent,
          requestId: crypto.randomUUID(),
        }),
      });
      callId = result.id;
      ensureOpen();
      setActiveId(result.id);
      await refresh();
      if (mode === 'browser') {
        const { Room, RoomEvent, Track } = await import('livekit-client');
        const r = new Room({
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        room.current = r;
        r.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            audio.current?.append(el);
          }
        });
        r.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
        r.on(RoomEvent.Disconnected, () => {
          if (mounted.current) setConnected(false);
        });
        await r.connect(result.url, result.token!);
        ensureOpen();
        await r.startAudio();
        await r.localParticipant.setMicrophoneEnabled(true);
        ensureOpen();
        setConnected(true);
        setMuted(false);
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
      void room.current?.disconnect();
      if (callId) await api(`/calls/${callId}/end`, { method: 'POST' }).catch(() => {});
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (!remote)
    return (
      <p className="notice">
        Sign in to a studio server to test the voice agent. Manual briefs and quotations remain
        available in local mode.
      </p>
    );
  return (
    <section className="voice-desk">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">VOICE WORKSPACE</span>
          <h3>Let the brief lead the conversation.</h3>
        </div>
        <Badge>
          {connected
            ? 'Microphone connected'
            : status?.reachable && status.agentVerified
              ? 'Worker connected'
              : 'Not ready'}
        </Badge>
      </div>
      <p className="muted small-text">
        Test in your browser by playing the vendor. The agent asks for rates, units, GST, inclusions
        and validity. Both LiveKit and the voice worker must be reachable before starting.
      </p>
      {!status && <p role="status">Checking voice services…</p>}
      {status?.configured && !status.agentVerified && (
        <p className="notice">
          Voice worker is not connected. Start the worker before making a test call.
        </p>
      )}
      {status && !status.configured && (
        <p className="notice">
          Server setup needed: your studio administrator needs to connect the voice service. Manual
          quotations remain available.
        </p>
      )}
      <div className="brief-actions">
        <button
          className="button primary"
          disabled={
            busy ||
            enquiry.itemIds.length > 20 ||
            !status?.reachable ||
            !status.agentVerified ||
            (!!current && ['starting', 'active'].includes(current.status))
          }
          onClick={() => void start('browser')}
        >
          <Icon name="phone" />
          Test in browser
        </button>
        {connected && (
          <button
            className="button secondary"
            onClick={async () => {
              await room.current?.localParticipant.setMicrophoneEnabled(muted);
              setMuted(!muted);
            }}
          >
            {muted ? 'Unmute microphone' : 'Mute microphone'}
          </button>
        )}
        {current && ['starting', 'active', 'connected'].includes(current.status) && (
          <button
            className="button danger"
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/calls/${current.id}/end`, { method: 'POST' });
                await room.current?.disconnect();
                setConnected(false);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            End call
          </button>
        )}
      </div>
      <details className="phone-options">
        <summary>Call {vendor?.name || 'the vendor'} by phone</summary>
        <p>{vendor?.phone || 'Add an international phone number to the vendor record.'}</p>
        <p className="small-text">
          Telephone calls require a configured SIP carrier and can incur carrier and model charges.
          The agent identifies itself as an automated assistant and asks permission to continue.
        </p>
        <label className="checkbox-line">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          I have verified this vendor and number and want to request these quotations by phone.
        </label>
        <button
          className="button secondary"
          disabled={
            busy ||
            enquiry.itemIds.length > 20 ||
            !consent ||
            !status?.reachable ||
            !status.agentVerified ||
            !status.outboundEnabled ||
            (!!current && ['starting', 'active'].includes(current.status))
          }
          onClick={() => void start('phone')}
        >
          Call vendor
        </button>
        {!status?.outboundEnabled && (
          <p className="muted small-text">Phone calling is disabled on this server.</p>
        )}
      </details>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {enquiry.itemIds.length > 20 && (
        <p className="notice">Prepare an enquiry with up to 20 items for a voice call.</p>
      )}
      {!!calls.length && (
        <>
          <Field label="Conversation">
            <select value={current?.id} onChange={(e) => setActiveId(e.target.value)}>
              {calls.map((c) => (
                <option key={c.id} value={c.id}>
                  {new Date(c.created).toLocaleString('en-IN')} · {c.mode} · {c.status}
                </option>
              ))}
            </select>
          </Field>
          <Badge>{current?.status}</Badge>
          {current?.error && <p className="error">{current.error}</p>}
          <div className="conversation-log" role="log" aria-label="Call transcript">
            {current?.transcript.length ? (
              current.transcript.map((t, i) => (
                <p key={i}>
                  <strong>{t.role === 'user' ? 'Vendor / tester' : 'Nivo assistant'}</strong>
                  <span>{t.text}</span>
                </p>
              ))
            ) : (
              <p className="muted">
                No speech has been transcribed yet. Check the worker if this session remains at
                “starting”.
              </p>
            )}
          </div>
          <button
            className="button secondary"
            disabled={busy || !status?.extractionConfigured || !current?.transcript.length}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await api(`/calls/${current!.id}/extract`, { method: 'POST' });
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Extract quotation drafts
          </button>
          {!status?.extractionConfigured && (
            <p className="small-text muted">
              Configure the extraction model on the server to generate drafts. You can still record
              quotations manually.
            </p>
          )}
          {current?.drafts.map((d, index) => (
            <article className="quote-draft" key={`${d.itemId}-${index}`}>
              <Badge>Unverified draft</Badge>
              <h4>{project?.items.find((i) => i.id === d.itemId)?.description}</h4>
              <p>
                {d.cost === null ? 'Price unclear' : `₹${d.cost} / ${d.unit}`} · {d.basis}
              </p>
              <p>{[d.brand, d.model].filter(Boolean).join(' / ') || 'Brand / model not stated'}</p>
              <blockquote>{d.evidence}</blockquote>
              <p>{d.terms}</p>
              <button
                className="button secondary small"
                onClick={() => setReview({ draft: d, call: current })}
              >
                Review & record quotation
              </button>
            </article>
          ))}
        </>
      )}
      <div ref={audio} />
      {review && (
        <RateForm
          vendors={workspace.vendors}
          item={project?.items.find((i) => i.id === review.draft.itemId)}
          vendorId={enquiry.vendorId}
          draft={{
            brand: review.draft.brand,
            model: review.draft.model,
            cost:
              review.draft.basis === 'excluding-gst' &&
              normalUnit(review.draft.unit) ===
                normalUnit(project?.items.find((i) => i.id === review.draft.itemId)?.unit || '')
                ? (review.draft.cost ?? undefined)
                : undefined,
            sourceRef: `Voice call ${review.call.id}`,
            notes: `Unverified extraction. Tax basis: ${review.draft.basis}. Quoted unit: ${review.draft.unit}. Brand: ${review.draft.brand}. ${review.draft.terms}\nEvidence: ${review.draft.evidence}`,
          }}
          onClose={() => setReview(null)}
          onSave={(r) => {
            const quotes = [
              ...(enquiry.quotes ?? []),
              { itemId: review.draft.itemId, rateId: r.id },
            ];
            onRate(r, {
              ...enquiry,
              quotes,
              status: enquiry.itemIds.every((id) => quotes.some((q) => q.itemId === id))
                ? 'Quote received'
                : 'Awaiting quote',
            });
            setReview(null);
          }}
        />
      )}
    </section>
  );
}
