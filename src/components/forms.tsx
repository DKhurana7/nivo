import { assemblyCost } from '../lib/costing';
import { useState } from 'react';
import {
  categories,
  units,
  uid,
  today,
  type Item,
  type Project,
  type Vendor,
  type Rate,
  type Settings,
} from '../lib/types';
import { Field, Modal } from './ui';

export function ProjectForm({
  settings,
  project,
  onDelete,
  onSave,
  onClose,
}: {
  settings: Settings;
  project?: Project;
  onDelete?: () => void;
  onSave: (p: Project) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={project ? 'Project details' : 'Start a project'}
      subtitle="A place for every specification, rate and decision."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          onSave({
            ...project,
            id: project?.id ?? uid(),
            name: String(d.get('name')).trim(),
            client: String(d.get('client')).trim(),
            location: String(d.get('location')).trim(),
            kind: d.get('kind') as Project['kind'],
            dueDate: String(d.get('dueDate')),
            stage: 'Draft',
            createdAt: project?.createdAt ?? today(),
            markup: project?.markup ?? settings.defaultMarkup,
            gst: project?.gst ?? settings.defaultGst,
            items: project?.items.map((item) => ({ ...item, reviewed: false })) ?? [],
          });
        }}
      >
        <Field label="Project name">
          <input
            name="name"
            required
            maxLength={120}
            placeholder="e.g. Kapoor residence"
            defaultValue={project?.name}
            autoFocus
          />
        </Field>
        <div className="form-grid">
          <Field label="Client">
            <input
              name="client"
              required
              maxLength={120}
              placeholder="Client or company"
              defaultValue={project?.client}
            />
          </Field>
          <Field label="Project type">
            <select name="kind" defaultValue={project?.kind}>
              <option>Residential</option>
              <option>Commercial</option>
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Location">
            <input name="location" required defaultValue={project?.location ?? settings.city} />
          </Field>
          <Field label="Target date">
            <input name="dueDate" type="date" defaultValue={project?.dueDate ?? ''} />
          </Field>
        </div>
        <div className="form-footer">
          {project && onDelete && (
            <button type="button" className="text-button delete-project" onClick={onDelete}>
              Delete project
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">
            {project ? 'Save project details' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ItemForm({
  item,
  onSave,
  onClose,
}: {
  item?: Item;
  onSave: (i: Item) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={item ? 'Edit BOQ item' : 'Add a BOQ item'}
      subtitle="Keep the measurement basis and inclusions explicit."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          const raw = String(d.get('cost'));
          const kind = String(d.get('quantityKind')) as NonNullable<Item['quantityKind']>;
          const assembly = d.get('useAssembly')
            ? {
                material: Number(d.get('material')),
                labour: Number(d.get('labour')),
                other: Number(d.get('other')),
                adjustment: Number(d.get('adjustment')),
              }
            : undefined;
          const next = {
            ...item,
            rateId: undefined,
            id: item?.id ?? uid(),
            description: String(d.get('description')).trim(),
            specification: String(d.get('specification')).trim(),
            category: d.get('category') as Item['category'],
            unit: String(d.get('unit')),
            quantity:
              kind === 'measured' && d.get('quantity') !== '' ? Number(d.get('quantity')) : null,
            quantityKind: kind === 'measured' && d.get('quantity') === '' ? 'unknown' : kind,
            assembly,
            markupOverride: d.get('itemMarkup') === '' ? undefined : Number(d.get('itemMarkup')),
            cost: assembly ? assemblyCost(assembly) : raw === '' ? null : Number(raw),
            reviewed: false,
            sourceRow: item?.sourceRow,
          } satisfies Item;
          onSave(next);
        }}
      >
        <Field label="Item description">
          <input
            name="description"
            required
            maxLength={10000}
            defaultValue={item?.description}
            placeholder="e.g. BWP plywood, 18 mm"
            autoFocus
          />
        </Field>
        <Field label="Specification & inclusions">
          <textarea
            name="specification"
            defaultValue={item?.specification}
            placeholder="Brand, grade, dimensions; supply only or installed…"
            rows={3}
          />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <select name="category" defaultValue={item?.category ?? 'Joinery'}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit">
            <select name="unit" defaultValue={item?.unit ?? 'sq ft'}>
              {[...new Set([...units, ...(item ? [item.unit] : [])])].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Quantity basis">
          <select name="quantityKind" defaultValue={item?.quantityKind ?? 'measured'}>
            <option value="measured">Measured quantity</option>
            <option value="rate-only">Rate only (RO), no line amount</option>
            <option value="unknown">Quantity needs confirmation</option>
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Quantity">
            <input
              name="quantity"
              type="number"
              min="0"
              step="0.001"
              defaultValue={item ? (item.quantity ?? '') : 1}
            />
          </Field>
          <Field label="Unit cost (₹, before GST)" hint="Leave blank if a quotation is needed.">
            <input
              name="cost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={item?.cost ?? ''}
              placeholder="Not yet priced"
            />
          </Field>
        </div>
        <details className="notice">
          <summary>Cost breakdown & item markup</summary>
          <label className="checkbox-line">
            <input type="checkbox" name="useAssembly" defaultChecked={!!item?.assembly} />
            Calculate unit cost from the components below
          </label>
          <div className="form-grid">
            {(['material', 'labour', 'other', 'adjustment'] as const).map((key) => (
              <Field
                key={key}
                label={
                  key === 'adjustment'
                    ? 'Adjustment on base cost (%)'
                    : `${key[0].toUpperCase() + key.slice(1)} per unit (₹)`
                }
              >
                <input
                  name={key}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={item?.assembly?.[key] ?? 0}
                />
              </Field>
            ))}
            <Field label="Item markup (%)" hint="Blank uses project markup.">
              <input
                name="itemMarkup"
                type="number"
                min="0"
                max="500"
                step="0.01"
                defaultValue={item?.markupOverride ?? ''}
              />
            </Field>
          </div>
        </details>
        {!!item?.context?.length && (
          <details className="notice">
            <summary>Inherited specification · {item.section || 'Source context'}</summary>
            {item.context.map((c) => (
              <p key={c.row}>
                <small>Row {c.row}</small> {c.text}
              </p>
            ))}
          </details>
        )}
        {item?.sourceRate !== undefined && (
          <p className="notice">
            Original rate: ₹{item.sourceRate}. Verify its basis before using it as a cost.
          </p>
        )}
        {item?.sourceRow && (
          <p className="notice">
            Cost changes can be exported to the original workbook. Changing the description,
            specification, quantity or unit requires a new BOQ export.
          </p>
        )}
        <div className="form-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save item</button>
        </div>
      </form>
    </Modal>
  );
}
export function VendorForm({
  vendor,
  onSave,
  onClose,
}: {
  vendor?: Vendor;
  onSave: (v: Vendor) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={vendor ? 'Edit vendor' : 'Add a vendor'}
      subtitle="Your supplier relationships, in one place."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          onSave({
            id: vendor?.id ?? uid(),
            name: String(d.get('name')).trim(),
            contact: String(d.get('contact')).trim(),
            phone: String(d.get('phone')).trim(),
            email: String(d.get('email')).trim(),
            category: d.get('category') as Vendor['category'],
            location: String(d.get('location')).trim(),
            notes: String(d.get('notes')).trim(),
          });
        }}
      >
        <Field label="Company name">
          <input name="name" required defaultValue={vendor?.name} autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Contact person">
            <input name="contact" defaultValue={vendor?.contact} />
          </Field>
          <Field label="Category">
            <select name="category" defaultValue={vendor?.category}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Phone">
            <input name="phone" type="tel" defaultValue={vendor?.phone} placeholder="+91" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={vendor?.email} />
          </Field>
        </div>
        <Field label="Location">
          <input name="location" defaultValue={vendor?.location} />
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={2} defaultValue={vendor?.notes} />
        </Field>
        <div className="form-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save vendor</button>
        </div>
      </form>
    </Modal>
  );
}
export function RateForm({
  vendors,
  item,
  vendorId,
  draft,
  onSave,
  onClose,
}: {
  vendors: Vendor[];
  item?: Item;
  vendorId?: string;
  draft?: { cost?: number; sourceRef: string; notes: string };
  onSave: (r: Rate) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  return (
    <Modal
      title="Record a quotation"
      subtitle="Store the evidence before using the number."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          if (String(d.get('validUntil')) < String(d.get('quotedAt'))) {
            setError('Validity must be on or after the quotation date.');
            return;
          }
          onSave({
            id: uid(),
            description: String(d.get('description')).trim(),
            specification: String(d.get('specification')).trim(),
            category: d.get('category') as Rate['category'],
            unit: String(d.get('unit')),
            cost: Number(d.get('cost')),
            vendorId: String(d.get('vendorId')),
            source: d.get('source') as Rate['source'],
            sourceRef: String(d.get('sourceRef')).trim(),
            quotedAt: String(d.get('quotedAt')),
            validUntil: String(d.get('validUntil')),
            location: String(d.get('location')).trim(),
            notes: String(d.get('notes')).trim(),
          });
        }}
      >
        {draft && (
          <p className="notice">
            Check the transcript, specification, unit, tax basis and validity. This draft is not
            confirmed evidence until you verify and save it. Tax-inclusive or unclear prices are
            left blank, as are prices quoted in a different unit. Confirm or convert the rate before
            saving.
          </p>
        )}
        <Field label="Item description">
          <input name="description" required defaultValue={item?.description} autoFocus />
        </Field>
        <Field label="Exact specification">
          <textarea
            name="specification"
            required
            rows={2}
            defaultValue={item?.specification}
            placeholder="Brand, model, grade, size and inclusions"
          />
        </Field>
        <div className="form-grid thirds">
          <Field label="Category">
            <select name="category" defaultValue={item?.category}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit">
            <select name="unit" defaultValue={item?.unit}>
              {[...new Set([...units, ...(item ? [item.unit] : [])])].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit cost (₹)">
            <input
              name="cost"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={draft?.cost}
            />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Vendor">
            <select name="vendorId" defaultValue={vendorId ?? ''}>
              <option value="">No vendor / internal estimate</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source type">
            <select name="source">
              <option>Vendor quote</option>
              <option>Past purchase</option>
              <option>Online reference</option>
              <option>Manual estimate</option>
            </select>
          </Field>
        </div>
        <Field label="Source reference">
          <input
            name="sourceRef"
            required
            defaultValue={draft?.sourceRef}
            placeholder="Quote number, invoice reference or URL"
          />
        </Field>
        <div className="form-grid">
          <Field label="Quoted on">
            <input name="quotedAt" type="date" required defaultValue={today()} />
          </Field>
          <Field label="Valid until">
            <input name="validUntil" type="date" required defaultValue={today()} />
          </Field>
        </div>
        <Field label="Delivery location">
          <input name="location" required placeholder="e.g. Gurugram site" />
        </Field>
        <Field
          label="Commercial terms"
          hint="The cost above must exclude GST. State delivery, installation, quantity conditions and exclusions."
        >
          <textarea
            name="notes"
            defaultValue={draft?.notes}
            required
            rows={2}
            placeholder="GST excluded; delivery ₹…; stock…; lead time…"
          />
        </Field>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save quotation</button>
        </div>
      </form>
    </Modal>
  );
}
