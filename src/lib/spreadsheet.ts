import { remote, fetchWorkbook, uploadWorkbook } from './api';
import type ExcelJS from 'exceljs';
import { get, set } from 'idb-keyval';
import type { Item, Project, WorkbookMapping } from './types';
import { uid } from './types';
import { quantityLabel } from './costing';

export const workbookKey = (id: string) => `nivo.workbook.${id}`;
async function createWorkbook() {
  const { default: Excel } = await import('exceljs');
  return new Excel.Workbook();
}
export async function loadWorkbook(bytes: ArrayBuffer) {
  const book = await createWorkbook();
  await book.xlsx.load(bytes);
  return book;
}
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    if ('text' in value) return value.text;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return '';
  }
  return String(value);
}
export function numeric(value: string) {
  const s = value.trim().replace(/[₹,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function parseSheet(book: ExcelJS.Workbook, mapping: WorkbookMapping, importCosts = true) {
  const sheet = book.getWorksheet(mapping.sheet);
  if (!sheet) throw new Error('The selected worksheet no longer exists.');
  const items: Item[] = [];
  const warnings: string[] = [];
  let context: { row: number; text: string }[] = [];
  let section = '';
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= mapping.headerRow) return;
    const text = (col?: number) => (col ? cellText(row.getCell(col).value).trim() : '');
    const description = text(mapping.description);
    if (!description) return;
    const reference = text(mapping.reference);
    const unit = text(mapping.unit);
    const qtyCell = row.getCell(mapping.quantity);
    if (qtyCell.isMerged && Number(qtyCell.master.row) !== rowNumber) {
      const parent = items.find((i) => i.sourceRow === Number(qtyCell.master.row));
      if (parent)
        parent.specification = [parent.specification, description].filter(Boolean).join('\n');
      else warnings.push(`Row ${rowNumber}: merged continuation needs manual review.`);
      return;
    }
    const rawQuantity = text(mapping.quantity);
    const quantity = numeric(rawQuantity);
    if (!unit) {
      if (/^(?:[A-Z]|[IVX]+)[.)]?$/.test(reference) && description.length < 130) {
        section = `${reference} · ${description}`;
        // Context is conservative: retain preceding technical text until an explicit section.
        context = [];
      }
      context.push({ row: rowNumber, text: [reference, description].filter(Boolean).join(' ') });
      warnings.push(`Row ${rowNumber}: retained as specification/context, not a priced line.`);
      return;
    }
    const quantityKind = /^r\.?\s*o\.?$/i.test(rawQuantity)
      ? 'rate-only'
      : quantity === null
        ? 'unknown'
        : 'measured';
    if (quantityKind === 'unknown')
      warnings.push(`Row ${rowNumber}: quantity needs confirmation; retained without an amount.`);
    const sourceRate = numeric(text(mapping.rate));
    const cost = importCosts && sourceRate !== null && sourceRate > 0 ? sourceRate : null;
    if (sourceRate === 0 && importCosts)
      warnings.push(`Row ${rowNumber}: zero source rate treated as an unpriced placeholder.`);
    items.push({
      id: uid(),
      description,
      specification: text(mapping.specification),
      brand: text(mapping.brand),
      model: text(mapping.model),
      category: 'Other',
      quantity: quantityKind === 'measured' ? quantity : null,
      quantityKind,
      unit,
      cost,
      reference,
      section,
      context: context.map((c) => ({ ...c })),
      ...(sourceRate !== null ? { sourceRate } : {}),
      reviewed: false,
      sourceRow: rowNumber,
    });
  });
  return { items, warnings };
}
export async function retainWorkbook(bytes: ArrayBuffer) {
  const id = uid();
  if (remote) await uploadWorkbook(id, bytes);
  else await set(workbookKey(id), bytes);
  return id;
}
export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
/** Load source bytes only for an explicitly selected original-workbook export. */
export async function originalBytes(project: Project) {
  if (!project.workbookId || !project.mapping?.rate)
    throw new Error('Original export needs a retained workbook and a mapped rate column.');
  const bytes = remote
    ? await fetchWorkbook(project.workbookId)
    : await get<ArrayBuffer>(workbookKey(project.workbookId));
  if (!bytes)
    throw new Error('The source workbook is missing. Choose a new client quotation instead.');
  return bytes;
}
