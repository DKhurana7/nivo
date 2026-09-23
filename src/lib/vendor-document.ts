import type { Item } from './types';
import { normalUnit, round } from './costing';
import { cellText, loadWorkbook } from './spreadsheet';

export interface SourceLine {
  row: number;
  cells: string[];
  formulas?: number[];
  positions?: { x: number; text: string }[];
}
export interface SourceTable {
  name: string;
  page?: number;
  rows: SourceLine[];
}
export interface VendorDocument {
  filename: string;
  hash: string;
  bytes: ArrayBuffer;
  tables: SourceTable[];
  warnings: string[];
}
export interface QuoteMapping {
  header: number;
  description: number;
  unit: number;
  rate: number;
  brand: number;
  model: number;
  specification: number;
}
export interface DocumentOffer {
  id: string;
  location: string;
  description: string;
  specification: string;
  brand: string;
  model: string;
  unit: string;
  rate: number | null;
  evidence: string;
  warnings: string[];
}
const headers = {
  description:
    /^(?:description(?: of (?:goods|item|material|work))?|item(?: description| name)?|particulars|product(?: name)?|material)$/i,
  unit: /^(?:unit|uom|u\/m|per)$/i,
  rate: /^(?:(?:unit|net|basic)\s*(?:rate|price)|rate|price)(?:\s*\((?:rs\.?|inr|₹)\))?$/i,
  brand: /^(?:brand|make|brand\s*\/\s*make)$/i,
  model: /^(?:model|model no\.?|product code|part no\.?)$/i,
  specification: /^(?:specification|specifications|details)$/i,
};
export function suggestMapping(table: SourceTable): QuoteMapping {
  let best: QuoteMapping = {
      header: 1,
      description: 0,
      unit: 0,
      rate: 0,
      brand: 0,
      model: 0,
      specification: 0,
    },
    score = -1;
  for (const row of table.rows.slice(0, 40)) {
    const candidate = { ...best, header: row.row };
    let current = 0;
    for (const key of Object.keys(headers) as (keyof typeof headers)[]) {
      candidate[key] = row.cells.findIndex((c) => headers[key].test(c.trim())) + 1;
      if (candidate[key]) current += key === 'description' || key === 'rate' ? 3 : 1;
    }
    if (current > score) {
      best = candidate;
      score = current;
    }
  }
  return best;
}
/** Align PDF text to the explicitly selected header's column starts. */
export function alignedRows(table: SourceTable, header: number): SourceLine[] {
  if (!table.page) return table.rows;
  const anchors = table.rows.find((r) => r.row === header)?.positions;
  if (!anchors?.length) return table.rows;
  return table.rows.map((row) => {
    const cells = anchors.map(() => '');
    for (const part of row.positions ?? []) {
      let col = 0;
      for (let i = 1; i < anchors.length; i++) if (part.x >= anchors[i].x - 5) col = i;
      cells[col] += (cells[col] ? ' ' : '') + part.text;
    }
    return { ...row, cells };
  });
}
export function extractMappedOffers(table: SourceTable, mapping: QuoteMapping): DocumentOffer[] {
  const used = Object.entries(mapping)
    .filter(([k, v]) => k !== 'header' && v > 0)
    .map(([, v]) => v);
  if (!mapping.description || !mapping.unit || !mapping.rate)
    throw new Error(
      'Map description, quoted unit and unit rate. Never map the line amount as the rate.',
    );
  if (new Set(used).size !== used.length)
    throw new Error('Each quotation field needs a different column.');
  const result: DocumentOffer[] = [];
  for (const row of alignedRows(table, mapping.header)) {
    if (row.row <= mapping.header) continue;
    const read = (col: number) => row.cells[col - 1]?.trim() ?? '';
    const description = read(mapping.description),
      raw = read(mapping.rate);
    if (
      !description ||
      /^(?:grand\s+total|sub\s*total|total|gst|cgst|sgst|igst|freight|discount)\b/i.test(
        description,
      )
    )
      continue;
    if (headers.description.test(description) || (!raw && !read(mapping.unit))) continue;
    const rate = quotedNumber(raw);
    result.push({
      id: `${table.name}:${row.row}`,
      location: table.page
        ? `Page ${table.page}, line ${row.row}`
        : `${table.name}, row ${row.row}`,
      description,
      specification: read(mapping.specification),
      brand: read(mapping.brand),
      model: read(mapping.model),
      unit: read(mapping.unit),
      rate,
      evidence: row.cells.map((text, i) => `${i + 1}: ${text}`).join(' | '),
      warnings: [
        ...(rate === null ? ['Unit rate is missing or ambiguous.'] : []),
        ...(row.formulas?.includes(mapping.rate)
          ? ['Rate comes from a cached Excel formula; verify it in the source workbook.']
          : []),
        ...(table.page
          ? ['Check PDF column alignment and wrapped descriptions against the original page.']
          : []),
      ],
    });
  }
  return result;
}

export const hashDocument = async (bytes: ArrayBuffer) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
export async function readVendorDocument(file: File): Promise<VendorDocument> {
  if (!/\.(xlsx|pdf)$/i.test(file.name))
    throw new Error('Choose .xlsx or .pdf. Save legacy .xls files as .xlsx first.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file no larger than 10 MB.');
  const bytes = await file.arrayBuffer(),
    hash = await hashDocument(bytes),
    tables: SourceTable[] = [],
    warnings: string[] = [];
  if (/\.xlsx$/i.test(file.name)) {
    const book = await loadWorkbook(bytes);
    if (book.worksheets.some((s) => s.rowCount > 10000 || s.columnCount > 100))
      throw new Error('Limit worksheets to 10,000 rows and 100 columns.');
    for (const sheet of book.worksheets) {
      const rows: SourceLine[] = [];
      sheet.eachRow((row, n) =>
        rows.push({
          row: n,
          cells: Array.from({ length: sheet.columnCount }, (_, i) =>
            cellText(row.getCell(i + 1).value),
          ),
          formulas: Array.from({ length: sheet.columnCount }, (_, i) => i + 1).filter(
            (i) => !!row.getCell(i).formula,
          ),
        }),
      );
      tables.push({ name: sheet.name, rows });
    }
  } else {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = (
      await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ).default;
    const task = pdfjs.getDocument({ data: bytes.slice(0), useWorkerFetch: false });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 40) throw new Error('Limit PDF quotations to 40 pages per file.');
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n),
          content = await page.getTextContent();
        if (content.items.length > 10000)
          throw new Error('PDF page is too complex. Split or simplify this quotation.');
        const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
        for (const item of content.items) {
          if (!('str' in item) || !item.str.trim()) continue;
          const y = item.transform[5],
            x = item.transform[4];
          let line = lines.find((l) => Math.abs(l.y - y) < 3);
          if (!line) {
            line = { y, parts: [] };
            lines.push(line);
          }
          line.parts.push({ x, text: item.str });
        }
        lines.sort((a, b) => b.y - a.y);
        const rows = lines.map((line, i) => {
          const positions = line.parts.sort((a, b) => a.x - b.x);
          return { row: i + 1, cells: positions.map((p) => p.text), positions };
        });
        if (!rows.length)
          warnings.push(
            `Page ${n} has no selectable text; it was not extracted. Request a searchable PDF or Excel copy.`,
          );
        tables.push({ name: `Page ${n}`, page: n, rows });
        page.cleanup();
      }
      if (!tables.some((t) => t.rows.length))
        throw new Error(
          'This PDF has no selectable text. Scanned/photo PDFs need OCR; request a searchable PDF or Excel copy.',
        );
    } finally {
      await task.destroy();
    }
  }
  if (!tables.length) throw new Error('The document contains no sheets or pages.');
  return { filename: file.name, hash, bytes, tables, warnings };
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .match(/[a-z]+|\d+(?:\.\d+)?/g)
      ?.filter((s) => s.length > 2 || /^\d/.test(s)) ?? [],
  );
export function compareOffer(offer: DocumentOffer, item: Item) {
  const source = `${offer.description} ${offer.specification} ${offer.brand} ${offer.model}`,
    target = `${item.description} ${item.specification} ${(item.context ?? []).map((c) => c.text).join(' ')} ${item.brand ?? ''} ${item.model ?? ''}`;
  const a = words(source),
    b = words(target),
    common = [...a].filter((w) => b.has(w));
  const warnings: string[] = [];
  if (!offer.unit || normalUnit(offer.unit) !== normalUnit(item.unit))
    warnings.push(`Unit mismatch: quoted ${offer.unit || 'unknown'}, BOQ ${item.unit}.`);
  for (const key of ['brand', 'model'] as const)
    if (item[key] && item[key]!.toLowerCase() !== offer[key].toLowerCase())
      warnings.push(`${key === 'brand' ? 'Brand' : 'Model'} differs or is unspecified.`);
  const sizes = (s: string) =>
    [
      ...s
        .toLowerCase()
        .matchAll(/\b\d+(?:\.\d+)?\s*(?:sq\s*mm|mm2|mm²|mm|kw|kva|w|amp|a|core)\b/g),
    ].map((m) => m[0].replace(/\s/g, ''));
  const needed = sizes(target),
    offered = sizes(source);
  if (needed.some((n) => !offered.includes(n)))
    warnings.push('Size / rating requirements are not fully confirmed by this offer.');
  if (
    /install|laying|fixing|labou?r/i.test(target) &&
    !/install|laying|fixing|labou?r/i.test(source)
  )
    warnings.push('BOQ may require installation/labour; supplier scope is not confirmed.');
  if (common.length < 2) warnings.push('Weak description match; inspect the specification.');
  const score =
    common.length / Math.max(1, a.size) +
    (normalUnit(offer.unit) === normalUnit(item.unit) ? 0.2 : 0);
  return { item, score, warnings };
}
export function suggestedMatches(offer: DocumentOffer, items: Item[]) {
  return items
    .map((i) => compareOffer(offer, i))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
export function reviewedCost(
  rate: number | null,
  tax: string,
  gst: number,
  discount: number,
  unitsPerQuote: number,
) {
  if (
    rate === null ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    !['excluding-gst', 'including-gst'].includes(tax) ||
    !Number.isFinite(gst) ||
    gst < 0 ||
    gst > 100 ||
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > 100 ||
    !Number.isFinite(unitsPerQuote) ||
    unitsPerQuote <= 0
  )
    return null;
  const cost = round(
    (rate * (1 - discount / 100)) / (tax === 'including-gst' ? 1 + gst / 100 : 1) / unitsPerQuote,
  );
  return Number.isFinite(cost) ? cost : null;
}

/** Reject ranges, two prices, annotations, foreign currencies and malformed grouping. */
export function quotedNumber(text: string): number | null {
  const value = text.trim().replace(/^(?:₹|INR|Rs\.?)\s*/i, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/.test(value)) return null;
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
