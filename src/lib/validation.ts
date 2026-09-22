import { categories, type Workspace } from './types';
export function validateWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== 'object') return false;
  const w = value as Workspace;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const str = (v: unknown) => typeof v === 'string';
  const date = (v: unknown) =>
    str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string) && Number.isFinite(Date.parse(v as string));
  const column = (v: unknown) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 100;
  return (
    w.version === 1 &&
    !!w.settings &&
    str(w.settings.company) &&
    str(w.settings.city) &&
    num(w.settings.defaultMarkup) &&
    num(w.settings.defaultGst) &&
    Array.isArray(w.projects) &&
    w.projects.every(
      (p) =>
        p &&
        str(p.id) &&
        str(p.name) &&
        str(p.client) &&
        str(p.location) &&
        (p.dueDate === '' || date(p.dueDate)) &&
        date(p.createdAt) &&
        ['Residential', 'Commercial'].includes(p.kind) &&
        ['Draft', 'In review', 'Approved'].includes(p.stage) &&
        (!p.mapping ||
          (str(p.mapping.sheet) &&
            column(p.mapping.description) &&
            column(p.mapping.unit) &&
            column(p.mapping.quantity) &&
            Number.isInteger(p.mapping.headerRow) &&
            p.mapping.headerRow >= 1 &&
            p.mapping.headerRow <= 10000 &&
            [p.mapping.rate, p.mapping.amount, p.mapping.specification, p.mapping.reference].every(
              (v) => v === undefined || column(v),
            ))) &&
        num(p.markup) &&
        num(p.gst) &&
        Array.isArray(p.items) &&
        p.items.every(
          (i) =>
            i &&
            str(i.id) &&
            str(i.description) &&
            str(i.specification) &&
            str(i.unit) &&
            categories.includes(i.category) &&
            (i.sourceRow === undefined ||
              (Number.isInteger(i.sourceRow) && i.sourceRow > 0 && i.sourceRow <= 10000)) &&
            (num(i.quantity) ||
              (i.quantity === null && ['rate-only', 'unknown'].includes(i.quantityKind ?? ''))) &&
            (i.quantityKind === undefined ||
              ['measured', 'rate-only', 'unknown'].includes(i.quantityKind)) &&
            (i.markupOverride === undefined || num(i.markupOverride)) &&
            (i.reference === undefined || str(i.reference)) &&
            (i.section === undefined || str(i.section)) &&
            (i.context === undefined ||
              (Array.isArray(i.context) &&
                i.context.every((c) => c && num(c.row) && str(c.text)))) &&
            (i.assembly === undefined ||
              [
                i.assembly.material,
                i.assembly.labour,
                i.assembly.other,
                i.assembly.adjustment,
              ].every(num)) &&
            (i.cost === null || num(i.cost)) &&
            typeof i.reviewed === 'boolean',
        ),
    ) &&
    Array.isArray(w.vendors) &&
    w.vendors.every(
      (v) =>
        v &&
        str(v.id) &&
        str(v.name) &&
        str(v.contact) &&
        str(v.phone) &&
        str(v.email) &&
        str(v.location) &&
        str(v.notes) &&
        categories.includes(v.category),
    ) &&
    Array.isArray(w.rates) &&
    w.rates.every(
      (r) =>
        r &&
        str(r.id) &&
        str(r.description) &&
        str(r.specification) &&
        str(r.unit) &&
        categories.includes(r.category) &&
        num(r.cost) &&
        date(r.quotedAt) &&
        date(r.validUntil) &&
        ['Vendor quote', 'Past purchase', 'Online reference', 'Manual estimate'].includes(
          r.source,
        ) &&
        str(r.location) &&
        str(r.notes) &&
        str(r.vendorId) &&
        str(r.sourceRef),
    ) &&
    Array.isArray(w.enquiries) &&
    w.enquiries.every(
      (e) =>
        e &&
        str(e.id) &&
        str(e.projectId) &&
        str(e.vendorId) &&
        ['Prepared', 'Awaiting quote', 'Quote received'].includes(e.status) &&
        date(e.createdAt) &&
        (e.quotes === undefined ||
          (Array.isArray(e.quotes) &&
            e.quotes.every((q) => q && str(q.itemId) && str(q.rateId)))) &&
        Array.isArray(e.itemIds) &&
        e.itemIds.every(str) &&
        str(e.notes) &&
        str(e.transcript),
    )
  );
}
