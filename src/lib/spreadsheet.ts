import { remote, fetchWorkbook, uploadWorkbook } from './api';
import type ExcelJS from 'exceljs';
import { get, set } from 'idb-keyval';
import type { Item, Project, WorkbookMapping } from './types';
import { uid } from './types';
import { lineAmount, quantityLabel, sellingRate, totals } from './costing';

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
export async function exportProject(project: Project, original = false, internal = false) {
  let book: ExcelJS.Workbook;
  if (original) {
    if (!project.workbookId || !project.mapping?.rate)
      throw new Error('Original export needs a retained workbook and a mapped rate column.');
    const bytes = remote
      ? await fetchWorkbook(project.workbookId)
      : await get<ArrayBuffer>(workbookKey(project.workbookId));
    if (!bytes)
      throw new Error(
        'The source workbook is missing from this browser. Export a new BOQ instead.',
      );
    const { patchOriginal } = await import('./workbook-patch');
    const patched = await patchOriginal(bytes, project);
    downloadBlob(
      patched as BlobPart,
      `${project.name.replace(/[^a-zA-Z0-9 _-]/g, '')}-internal-priced-original.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    return;
  } else {
    book = await createWorkbook();
    const sheet = book.addWorksheet('BOQ');
    sheet.addRow([project.name]);
    sheet.addRow([project.client, project.location]);
    sheet.addRow(['Rates are INR, excluding GST. Review incomplete lines before issuing.']);
    sheet.addRow([
      'Ref',
      'Description',
      'Specification',
      'Category',
      'Unit',
      'Quantity',
      internal ? 'Unit cost' : 'Reference',
      'Selling rate',
      'Amount',
      'Review',
    ]);
    project.items.forEach((i, index) => {
      const rate = sellingRate(i, project.markup);
      sheet.addRow([
        i.reference || index + 1,
        i.description,
        [...(i.context ?? []).map((c) => c.text), i.specification].filter(Boolean).join('\n'),
        i.category,
        i.unit,
        i.quantityKind === 'rate-only' ? 'RO' : i.quantity,
        internal ? i.cost : '',
        rate,
        lineAmount(i, project.markup),
        i.cost === null ? 'Unpriced' : i.reviewed ? 'Reviewed' : 'Needs review',
      ]);
    });
    if (project.generalNotes) {
      const notes = book.addWorksheet('General notes');
      notes.addRow([project.generalNotes]);
      notes.getColumn(1).width = 100;
      notes.getCell('A1').alignment = { wrapText: true };
    }
    const t = totals(project);
    sheet.addRow([]);
    sheet.addRow(['', 'Subtotal (priced lines)', '', '', '', '', '', '', t.selling]);
    sheet.addRow(['', `GST ${project.gst}%`, '', '', '', '', '', '', t.tax]);
    sheet.addRow([
      '',
      t.missing || t.unresolved
        ? 'Partial total: unresolved lines excluded'
        : 'Total (rate-only lines excluded)',
      '',
      '',
      '',
      '',
      '',
      '',
      t.total,
    ]);
    sheet.columns = [
      { width: 8 },
      { width: 40 },
      { width: 60 },
      { width: 16 },
      { width: 12 },
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 18 },
    ];
    sheet.getRow(4).font = { bold: true, color: { argb: 'FFF6F7F5' } };
    sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF183247' } };
    sheet.views = [{ state: 'frozen', ySplit: 4 }];
    for (const col of [7, 8, 9]) sheet.getColumn(col).numFmt = '#,##0.00';
  }
  const bytes = await book.xlsx.writeBuffer();
  const safe = project.name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Project';
  downloadBlob(
    bytes as unknown as BlobPart,
    `${safe}${internal ? '-internal-costing' : '-client-BOQ'}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
