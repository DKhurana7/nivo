import { VoiceDesk } from './VoiceDesk';
import { remote } from '../lib/api';
import { useState } from 'react';
import { today, uid, type Enquiry, type Item, type Rate, type Workspace } from '../lib/types';
import { dateLabel, quantityLabel } from '../lib/costing';
import { downloadBlob } from '../lib/spreadsheet';
import { Badge, Empty, Field, Icon, Modal } from './ui';
import { RateForm } from './forms';

export function EnquiriesPage({
  workspace,
  selectedProject,
  onSave,
  onRate,
  notify,
}: {
  workspace: Workspace;
  selectedProject: string;
  onSave: (e: Enquiry) => void;
  onRate: (r: Rate, enquiry: Enquiry) => void;
  notify: (s: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [projectId, setProjectId] = useState(selectedProject || workspace.projects[0]?.id || '');
  const [vendorId, setVendorId] = useState(workspace.vendors[0]?.id ?? '');
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [detailId, setDetailId] = useState('');
  const [capture, setCapture] = useState<{ enquiry: Enquiry; item: Item } | null>(null);
  const project = workspace.projects.find((p) => p.id === projectId);
  const detail = workspace.enquiries.find((e) => e.id === detailId);
  const detailProject = workspace.projects.find((p) => p.id === detail?.projectId);
  const detailVendor = workspace.vendors.find((v) => v.id === detail?.vendorId);
  function brief(e: Enquiry) {
    const p = workspace.projects.find((p) => p.id === e.projectId);
    const v = workspace.vendors.find((v) => v.id === e.vendorId);
    return `${workspace.settings.company}\nQuotation enquiry: ${p?.name}\nVendor: ${v?.name}\nDelivery location: ${p?.location}\nDate: ${today()}\n\n${p?.items
      .filter((i) => e.itemIds.includes(i.id))
      .map(
        (i, n) =>
          `${n + 1}. ${i.description}\nSpecification: ${[...(i.context ?? []).map((c) => c.text), i.specification].filter(Boolean).join(' / ') || 'Please clarify before quoting'}\nQuantity: ${quantityLabel(i)} ${i.unit}`,
      )
      .join(
        '\n\n',
      )}\n\nPlease confirm for every item:\n- Exact brand, model, grade and dimensions\n- Price per stated unit, excluding GST\n- GST separately, freight and installation inclusions\n- Stock, lead time and quotation validity\n- Minimum quantity and payment terms\n- Any substitute as a separate offer\n\nPlease provide a written quotation. This enquiry is not a purchase order.\n\n${p?.generalNotes || ''}\n\n${e.notes}`;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>The enquiry desk</h1>
          <p>Clear specifications out. Comparable quotations back.</p>
        </div>
        <button
          className="button primary"
          disabled={!workspace.projects.length || !workspace.vendors.length}
          onClick={() => {
            const p =
              workspace.projects.find((p) => p.id === selectedProject) ?? workspace.projects[0];
            setProjectId(p?.id ?? '');
            setItemIds(p?.items.filter((i) => i.cost === null).map((i) => i.id) ?? []);
            setCreating(true);
          }}
        >
          <Icon name="plus" />
          Prepare enquiry
        </button>
      </div>
      <div className="voice-banner">
        <div className="voice-banner-icon">
          <Icon name="phone" size={28} />
        </div>
        <div>
          <Badge>
            {remote ? 'Self-hosted voice workspace' : 'Voice calling / Studio sign-in required'}
          </Badge>
          <h2>A well-prepared call starts here.</h2>
          <p>
            Prepare a complete vendor brief, test the voice agent in your browser, and review
            extracted quotations before adding them to your BOQ.
          </p>
        </div>
        <div className="voice-banner-detail">
          <span>Available now</span>
          <strong>Brief → Quote → BOQ</strong>
          <small>Phone calls require an enabled SIP carrier.</small>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>Enquiry register</h2>
          <p>{workspace.enquiries.length} enquiries in your workspace</p>
        </div>
      </div>
      {workspace.enquiries.length ? (
        <div className="enquiry-list">
          {workspace.enquiries.map((e) => (
            <button key={e.id} className="enquiry-row" onClick={() => setDetailId(e.id)}>
              <span className="enquiry-symbol">
                <Icon name="enquiries" size={25} />
              </span>
              <div>
                <h3>
                  {workspace.vendors.find((v) => v.id === e.vendorId)?.name ?? 'Vendor unavailable'}
                </h3>
                <p>
                  {workspace.projects.find((p) => p.id === e.projectId)?.name ??
                    'Project unavailable'}{' '}
                  / {e.itemIds.length} items / {dateLabel(e.createdAt)}
                </p>
              </div>
              <Badge tone={e.status === 'Quote received' ? 'blue' : ''}>{e.status}</Badge>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="Your next quotation starts here"
          text="Choose a project, select the items you need priced, and prepare a brief for one of your vendors."
        >
          {!workspace.projects.length || !workspace.vendors.length ? (
            <p>Add a project and vendor first.</p>
          ) : (
            <button
              className="button secondary"
              onClick={() => {
                setItemIds(project?.items.filter((i) => i.cost === null).map((i) => i.id) ?? []);
                setCreating(true);
              }}
            >
              Prepare first enquiry
            </button>
          )}
        </Empty>
      )}
      {creating && (
        <Modal
          title="Prepare a vendor enquiry"
          subtitle="One vendor, one clear brief. You choose which items to include."
          onClose={() => setCreating(false)}
          wide
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const enquiry: Enquiry = {
                id: uid(),
                projectId,
                vendorId,
                itemIds,
                status: 'Prepared',
                createdAt: today(),
                notes: String(d.get('notes')),
                transcript: '',
                quotes: [],
              };
              onSave(enquiry);
              setCreating(false);
              setDetailId(enquiry.id);
              notify('Enquiry prepared. Nothing has been sent.');
            }}
          >
            <div className="form-grid">
              <Field label="Project">
                <select
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setItemIds([]);
                  }}
                >
                  {workspace.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vendor">
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  {workspace.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="section-heading compact">
              <h3>Select BOQ items</h3>
              <span>{itemIds.length} selected</span>
            </div>
            {itemIds.length > 20 && (
              <p className="notice">
                Voice calls support up to 20 items per enquiry. Select a smaller batch to use the
                voice agent; the full brief can still be saved for manual enquiries.
              </p>
            )}
            <div className="enquiry-items">
              {project?.items.map((i) => (
                <label key={i.id} className="select-item">
                  <input
                    type="checkbox"
                    checked={itemIds.includes(i.id)}
                    onChange={(e) =>
                      setItemIds(
                        e.target.checked ? [...itemIds, i.id] : itemIds.filter((id) => id !== i.id),
                      )
                    }
                  />
                  <div>
                    <strong>{i.description}</strong>
                    <span>{i.specification}</span>
                  </div>
                  <small>
                    {quantityLabel(i)} {i.unit}
                  </small>
                </label>
              ))}
              {!project?.items.length && (
                <p className="notice">Add BOQ items to this project first.</p>
              )}
            </div>
            <Field label="Additional instructions">
              <textarea
                name="notes"
                rows={3}
                placeholder="Required delivery date, preferred brands, site access…"
              />
            </Field>
            <div className="form-footer">
              <button type="button" className="button secondary" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={!itemIds.length || !vendorId}>
                Prepare brief
              </button>
            </div>
          </form>
        </Modal>
      )}
      {detail && !capture && (
        <Modal
          title={detailVendor?.name ?? 'Vendor enquiry'}
          subtitle={`${detailProject?.name ?? 'Project'} / ${detail.status}`}
          onClose={() => setDetailId('')}
          wide
        >
          <div className="brief-actions">
            <button
              className="button secondary small"
              onClick={() => {
                downloadBlob(brief(detail), 'Nivo-vendor-enquiry.txt', 'text/plain');
                notify('Enquiry brief downloaded');
              }}
            >
              <Icon name="download" size={16} />
              Download brief
            </button>
            <button
              className="button secondary small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(brief(detail));
                  notify('Enquiry brief copied');
                } catch {
                  notify('Clipboard unavailable. Download the brief instead.');
                }
              }}
            >
              Copy brief
            </button>
          </div>
          <VoiceDesk enquiry={detail} workspace={workspace} onRate={onRate} />
          <details>
            <summary>Read the complete enquiry brief</summary>
            <div className="brief-preview">{brief(detail)}</div>
          </details>
          <h3 className="preview-title">Record the response</h3>
          <p className="muted small-text">
            Capture confirmed quotation details for each item. Save original conversation notes
            below for reference.
          </p>
          <div className="capture-items">
            {detailProject?.items
              .filter((i) => detail.itemIds.includes(i.id))
              .map((i) => (
                <div key={i.id}>
                  <span>{i.description}</span>
                  <button
                    className="button secondary small"
                    onClick={() => setCapture({ enquiry: detail, item: i })}
                  >
                    {detail.quotes?.some((q) => q.itemId === i.id)
                      ? 'Update quotation'
                      : 'Record quotation'}
                  </button>
                </div>
              ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              onSave({
                ...detail,
                notes: String(d.get('notes')),
                transcript: String(d.get('transcript')),
              });
              notify('Conversation notes saved');
            }}
          >
            <Field label="Enquiry notes">
              <textarea name="notes" rows={2} defaultValue={detail.notes} />
            </Field>
            <Field
              label="Transcript or conversation notes"
              hint="Manual notes are separate from the original voice transcript above."
            >
              <textarea
                name="transcript"
                rows={4}
                defaultValue={detail.transcript}
                placeholder="Paste a transcript or record what the vendor confirmed…"
              />
            </Field>
            <div className="form-footer">
              {detail.status === 'Prepared' && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    onSave({ ...detail, status: 'Awaiting quote' });
                    notify('Marked as awaiting quote');
                  }}
                >
                  I have contacted the vendor
                </button>
              )}
              <button className="button primary">Save notes</button>
            </div>
          </form>
        </Modal>
      )}
      {capture && (
        <RateForm
          vendors={workspace.vendors}
          item={capture.item}
          vendorId={capture.enquiry.vendorId}
          onClose={() => setCapture(null)}
          onSave={(r) => {
            const quotes = [
              ...(capture.enquiry.quotes ?? []).filter((q) => q.itemId !== capture.item.id),
              { itemId: capture.item.id, rateId: r.id },
            ];
            onRate(r, {
              ...capture.enquiry,
              quotes,
              status: capture.enquiry.itemIds.every((id) => quotes.some((q) => q.itemId === id))
                ? 'Quote received'
                : 'Awaiting quote',
            });
            setCapture(null);
            notify('Quotation captured. Apply it from the project BOQ when ready.');
          }}
        />
      )}
    </>
  );
}
