import { useEffect, useRef, useState } from 'react';
import type { Rate, Workspace } from '../lib/types';
import { today, uid } from '../lib/types';
import { money, normalUnit } from '../lib/costing';
import {
  alignedRows,
  compareOffer,
  extractMappedOffers,
  readVendorDocument,
  reviewedCost,
  suggestMapping,
  suggestedMatches,
  type DocumentOffer,
  type QuoteMapping,
  type VendorDocument,
} from '../lib/vendor-document';
import { retainVendorDocument } from '../lib/document-storage';
import { downloadBlob } from '../lib/spreadsheet';
import { Field, Modal } from './ui';

export function VendorDocumentDialog({
  workspace,
  projectId: initialProject,
  vendorId: initialVendor,
  itemIds,
  onSave,
  onClose,
}: {
  workspace: Workspace;
  projectId?: string;
  vendorId?: string;
  itemIds?: string[];
  onSave: (r: Rate) => void;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState(initialProject ?? workspace.projects[0]?.id ?? '');
  const [vendorId, setVendorId] = useState(initialVendor ?? '');
  const [document, setDocument] = useState<VendorDocument>();
  const [tableIndex, setTableIndex] = useState(0);
  const [mapping, setMapping] = useState<QuoteMapping>();
  const [offers, setOffers] = useState<DocumentOffer[]>([]);
  const [selected, setSelected] = useState<DocumentOffer>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [itemId, setItemId] = useState('');
  const [rate, setRate] = useState(''),
    [brand, setBrand] = useState(''),
    [model, setModel] = useState('');
  const [tax, setTax] = useState('unknown'),
    [gst, setGst] = useState(''),
    [discount, setDiscount] = useState('0'),
    [units, setUnits] = useState('1');
  const [checked, setChecked] = useState(false);
  const [page, setPage] = useState(0),
    [sourcePage, setSourcePage] = useState(0);
  const operation = useRef(0);
  useEffect(
    () => () => {
      operation.current++;
    },
    [],
  );
  const project = workspace.projects.find((p) => p.id === projectId);
  const eligibleItems = project?.items.filter((i) => !itemIds || itemIds.includes(i.id)) ?? [];
  const item = eligibleItems.find((i) => i.id === itemId);
  const table = document?.tables[tableIndex];
  const rows = table && mapping ? alignedRows(table, mapping.header) : [];
  const columns = Math.min(100, Math.max(0, ...rows.map((r) => r.cells.length)));
  const cost = reviewedCost(
    rate.trim() === '' ? null : Number(rate),
    tax,
    Number(gst),
    Number(discount),
    Number(units),
  );
  const comparison =
    selected && item ? compareOffer({ ...selected, brand, model }, item) : undefined;
  const duplicate =
    selected &&
    document &&
    workspace.rates.some(
      (r) =>
        r.vendorId === vendorId &&
        r.document?.sha256 === document.hash &&
        r.document.location === selected.location &&
        r.document.itemId === itemId &&
        r.document.projectId === projectId,
    );
  function resetReview() {
    setChecked(false);
    setError('');
  }
  function choose(offer: DocumentOffer) {
    setSelected(offer);
    setRate(offer.rate === null ? '' : String(offer.rate));
    setBrand(offer.brand);
    setModel(offer.model);
    setItemId('');
    setTax('unknown');
    setGst('');
    setDiscount('0');
    setUnits('1');
    resetReview();
    setMessage('');
  }
  async function read(file?: File) {
    if (!file) return;
    const id = ++operation.current;
    setBusy(true);
    setError('');
    setDocument(undefined);
    setOffers([]);
    setSelected(undefined);
    setMapping(undefined);
    try {
      const result = await readVendorDocument(file);
      if (id !== operation.current) return;
      setDocument(result);
      setTableIndex(0);
      setMapping(suggestMapping(result.tables[0]));
      setSourcePage(0);
    } catch (e) {
      if (id === operation.current) setError((e as Error).message);
    } finally {
      if (id === operation.current) setBusy(false);
    }
  }
  return (
    <Modal
      title="Import vendor quotation"
      subtitle="Extract source rows, compare your BOQ requirements, then save reviewed offers."
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="notice">
        Files are read on this device without paid AI. Nothing prices your BOQ automatically. PDFs
        need selectable text; scanned pages require a searchable PDF or Excel copy.
      </p>
      {!workspace.vendors.length && (
        <p className="notice">Add a vendor in Vendors before saving imported quotations.</p>
      )}
      <fieldset disabled={busy} className="document-controls">
        <div className="form-grid">
          <Field label="Match to project">
            <select
              disabled={!!initialProject}
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setItemId('');
                resetReview();
              }}
            >
              {workspace.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quotation vendor">
            <select
              disabled={!!initialVendor}
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                resetReview();
              }}
            >
              <option value="">Select the vendor</option>
              {workspace.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Vendor PDF or Excel file">
          <input type="file" accept=".xlsx,.pdf" onChange={(e) => void read(e.target.files?.[0])} />
        </Field>
        {document && (
          <>
            <div className="document-file">
              <strong>{document.filename}</strong>
              <button
                className="button secondary small"
                onClick={() =>
                  downloadBlob(
                    document.bytes,
                    document.filename,
                    /\.pdf$/i.test(document.filename)
                      ? 'application/pdf'
                      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  )
                }
              >
                Open original copy
              </button>
            </div>
            {document.warnings.map((w) => (
              <p key={w} className="notice">
                {w}
              </p>
            ))}
            <div className="form-grid">
              <Field label="Quotation sheet or page">
                <select
                  value={tableIndex}
                  onChange={(e) => {
                    const index = Number(e.target.value);
                    setTableIndex(index);
                    setMapping(suggestMapping(document.tables[index]));
                    setOffers([]);
                    setSelected(undefined);
                    setSourcePage(0);
                  }}
                >
                  {document.tables.map((t, i) => (
                    <option key={t.name} value={i}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quotation header row">
                <input
                  type="number"
                  min="1"
                  max={table?.rows.at(-1)?.row ?? 1}
                  value={mapping?.header ?? 1}
                  onChange={(e) => {
                    setMapping((m) =>
                      m ? { ...m, header: Math.max(1, Number(e.target.value)) } : m,
                    );
                    setOffers([]);
                    setSelected(undefined);
                    setSourcePage(0);
                  }}
                />
              </Field>
            </div>
            <p className="small-text">
              Map the <strong>unit rate</strong>, not quantity, line amount, MRP or total. PDF
              columns are aligned to your chosen header. Check all pages for tax, discounts, freight
              and conditions; they are not automatically applied.
            </p>
            <div
              className="document-source table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Quotation source rows"
            >
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    {Array.from({ length: columns }, (_, i) => (
                      <th key={i}>Column {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(sourcePage * 10, sourcePage * 10 + 10).map((r) => (
                    <tr key={r.row}>
                      <th>{r.row}</th>
                      {Array.from({ length: columns }, (_, i) => (
                        <td key={i}>{r.cells[i]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="export-pagination">
              <button
                className="button secondary"
                disabled={!sourcePage}
                onClick={() => setSourcePage((p) => p - 1)}
              >
                Previous source rows
              </button>
              <span>{rows.length} source rows</span>
              <button
                className="button secondary"
                disabled={(sourcePage + 1) * 10 >= rows.length}
                onClick={() => setSourcePage((p) => p + 1)}
              >
                Next source rows
              </button>
            </div>
            {mapping && (
              <div className="form-grid thirds">
                {(
                  [
                    ['description', 'Quoted description'],
                    ['specification', 'Quoted specification'],
                    ['unit', 'Quoted unit'],
                    ['rate', 'Unit rate column'],
                    ['brand', 'Quoted brand column'],
                    ['model', 'Quoted model column'],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <select
                      value={mapping[key]}
                      onChange={(e) => {
                        setMapping({ ...mapping, [key]: Number(e.target.value) });
                        setOffers([]);
                        setSelected(undefined);
                      }}
                    >
                      <option value="0">
                        {['description', 'unit', 'rate'].includes(key)
                          ? 'Choose a column'
                          : 'Not supplied'}
                      </option>
                      {Array.from({ length: columns }, (_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1}.{' '}
                          {rows.find((r) => r.row === mapping.header)?.cells[i]?.slice(0, 50) ||
                            'Unnamed column'}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            )}
            <button
              className="button primary"
              onClick={() => {
                try {
                  setError('');
                  const list = extractMappedOffers(table!, mapping!);
                  setOffers(list);
                  setSelected(undefined);
                  setPage(0);
                  if (!list.length)
                    setError(
                      'No quotation rows found. Check the header, columns or another sheet/page.',
                    );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Extract quotation rows
            </button>
          </>
        )}
        {!!offers.length && (
          <section className="document-offers">
            <h3>{offers.length} quotation rows to review</h3>
            <p className="small-text">
              Suggestions compare wording, unit, brand/model and dimensions. They are not verified
              equivalents. Select each offer and its BOQ item explicitly.
            </p>
            {offers.slice(page * 10, page * 10 + 10).map((o) => (
              <button
                className="document-offer"
                key={o.id}
                aria-pressed={selected?.id === o.id}
                onClick={() => choose(o)}
              >
                <strong>{o.description}</strong>
                <span>
                  {[o.brand, o.model].filter(Boolean).join(' / ')} ·{' '}
                  {o.rate === null ? 'Rate unclear' : money(o.rate, 2)} / {o.unit || 'unit unknown'}
                </span>
                <small>{o.location}</small>
              </button>
            ))}
            <div className="export-pagination">
              <button
                className="button secondary"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous offers
              </button>
              <span>
                {page * 10 + 1}–{Math.min(offers.length, (page + 1) * 10)}
              </span>
              <button
                className="button secondary"
                disabled={(page + 1) * 10 >= offers.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next offers
              </button>
            </div>
          </section>
        )}
        {selected && project && (
          <form
            key={selected.id}
            className="document-review"
            onChange={resetReview}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!checked || !item || !document || !vendorId || cost === null || duplicate) return;
              const data = new FormData(e.currentTarget),
                quotedAt = String(data.get('quotedAt')),
                validUntil = String(data.get('validUntil'));
              if (quotedAt > today() || validUntil < quotedAt || validUntil < today()) {
                setError(
                  'Use a quotation dated today or earlier, with current validity on or after its quotation date.',
                );
                return;
              }
              setBusy(true);
              setError('');
              try {
                const fileId = await retainVendorDocument(document);
                onSave({
                  id: uid(),
                  description: selected.description,
                  specification: String(data.get('specification')).trim(),
                  category: item.category,
                  brand: brand.trim(),
                  model: model.trim(),
                  unit: item.unit,
                  cost,
                  vendorId,
                  source: 'Vendor quote',
                  sourceRef: `${document.filename} · ${selected.location}`,
                  quotedAt,
                  validUntil,
                  location: String(data.get('location')).trim(),
                  notes: `${String(data.get('terms')).trim()}\nImported source: ${selected.evidence}\nReviewed calculation: quoted ${rate} / ${selected.unit}; ${tax}; GST ${gst || '0'}%; discount ${discount}%; ${units} BOQ ${item.unit} per quoted unit.`,
                  document: {
                    fileId,
                    filename: document.filename,
                    sha256: document.hash,
                    location: selected.location,
                    excerpt: selected.evidence,
                    projectId,
                    itemId,
                    quotedDescription: selected.description,
                    quotedUnit: selected.unit,
                    quotedRate: Number(rate),
                    taxBasis: tax as 'excluding-gst' | 'including-gst',
                    gst: Number(gst),
                    discount: Number(discount),
                    unitsPerQuote: Number(units),
                  },
                });
                setSelected(undefined);
                setChecked(false);
                setMessage(
                  'Quotation saved with its source file. Use Find rate on the BOQ item to compare and apply it.',
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Review offer and BOQ match</h3>
            <blockquote className="document-evidence">
              {selected.location}: {selected.evidence}
            </blockquote>
            {selected.warnings.map((w) => (
              <p key={w} className="notice">
                {w}
              </p>
            ))}
            <details open>
              <summary>Suggested BOQ items</summary>
              {suggestedMatches(selected, eligibleItems).map((m) => (
                <p key={m.item.id}>
                  <strong>
                    {m.item.reference || 'Item'}: {m.item.description}
                  </strong>{' '}
                  / {m.item.unit}
                  <br />
                  <small>
                    {m.warnings.join(' ') ||
                      'Wording and unit overlap. Confirm all specifications before accepting.'}
                  </small>
                </p>
              ))}
            </details>
            <Field label="Matched BOQ item">
              <select
                required
                value={itemId}
                onChange={(e) => {
                  setItemId(e.target.value);
                  setUnits('1');
                  resetReview();
                }}
              >
                <option value="">Select the correct BOQ item</option>
                {eligibleItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.reference ? `${i.reference}: ` : ''}
                    {i.description} / {i.unit}
                  </option>
                ))}
              </select>
            </Field>
            {item && (
              <div className="notice">
                <strong>BOQ requirement</strong>
                <p>
                  {item.description} · {[item.brand, item.model].filter(Boolean).join(' / ')}
                </p>
                <p>
                  {[...(item.context ?? []).map((c) => c.text), item.specification]
                    .filter(Boolean)
                    .join('\n')}
                </p>
                {comparison?.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}
            <div className="form-grid">
              <Field label="Verified quoted brand">
                <input value={brand} maxLength={200} onChange={(e) => setBrand(e.target.value)} />
              </Field>
              <Field label="Verified quoted model">
                <input value={model} maxLength={200} onChange={(e) => setModel(e.target.value)} />
              </Field>
            </div>
            <Field
              label="Verified offer specification"
              hint="Record what the vendor actually supplies, including size, grade and installation scope."
            >
              <textarea
                name="specification"
                required
                rows={3}
                defaultValue={[selected.description, selected.specification]
                  .filter(Boolean)
                  .join('\n')}
              />
            </Field>
            <div className="form-grid">
              <Field label="Verified quoted unit rate (₹)">
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </Field>
              <Field label="Quoted tax basis">
                <select value={tax} onChange={(e) => setTax(e.target.value)}>
                  <option value="unknown">Not yet confirmed</option>
                  <option value="excluding-gst">Excluding GST</option>
                  <option value="including-gst">Including GST</option>
                </select>
              </Field>
              <Field label="GST included (%)" hint="Required only for a tax-inclusive rate.">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required={tax === 'including-gst'}
                  disabled={tax !== 'including-gst'}
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                />
              </Field>
              <Field
                label="Additional discount (%)"
                hint="Use 0 if the quoted rate is already net. Do not subtract twice."
              >
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </Field>
              <Field
                label="BOQ units per quoted unit"
                hint={`Example: a 90 m coil quoted per coil = 90. Quoted unit: ${selected.unit || 'unknown'}; BOQ: ${item?.unit ?? 'choose item'}.`}
              >
                <input
                  type="number"
                  required
                  min="0.000001"
                  step="any"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                />
              </Field>
            </div>
            {item && normalUnit(item.unit) !== normalUnit(selected.unit) && (
              <p className="notice">
                Unit conversion needs explicit verification. Confirm the actual pack
                length/coverage; the app does not infer it.
              </p>
            )}
            <p className="document-cost" aria-live="polite">
              {cost === null
                ? 'Confirm the rate, tax basis and conversion to calculate cost.'
                : `Reviewed cost: ${money(cost, 2)} / ${item?.unit ?? 'BOQ unit'}, excluding GST`}
            </p>
            <div className="form-grid">
              <Field label="Document quotation date">
                <input name="quotedAt" type="date" required />
              </Field>
              <Field label="Document valid until">
                <input name="validUntil" type="date" required />
              </Field>
            </div>
            <Field label="Quotation delivery location">
              <input name="location" defaultValue={project.location} required />
            </Field>
            <Field label="Verified commercial terms">
              <textarea
                name="terms"
                required
                rows={2}
                placeholder="Supply/installation, freight, MOQ, discount conditions, lead time and any substitution approval"
              />
            </Field>
            {duplicate && (
              <p className="notice">
                This source row is already saved for this vendor and BOQ item. Review the existing
                rate in the library.
              </p>
            )}
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  e.stopPropagation();
                  setChecked(e.target.checked);
                }}
              />
              I checked the original file, unit rate (not line total), brand/model, specification,
              tax, conversion and commercial terms against this BOQ item.
            </label>
            <div className="form-footer">
              <button
                className="button primary"
                disabled={!checked || !item || !vendorId || cost === null || duplicate}
              >
                Save reviewed quotation
              </button>
            </div>
          </form>
        )}
      </fieldset>
      {busy && <p role="status">{document ? 'Saving quotation source…' : 'Reading quotation…'}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </Modal>
  );
}
