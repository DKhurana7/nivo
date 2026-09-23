import type ExcelJS from 'exceljs';
import type { Project, Vendor } from './types';
import { lineAmount, sellingRate, totals } from './costing';
import { loadWorkbook } from './spreadsheet';

export interface ExportOptions {
  kind: 'client' | 'original' | 'internal';
  fill: 'amounts' | 'rates';
  calculations: 'values' | 'formulas';
  formatting: 'simple' | 'plain';
  notes: boolean;
}
export const defaultExportOptions: ExportOptions = {
  kind: 'client',
  fill: 'amounts',
  calculations: 'values',
  formatting: 'simple',
  notes: false,
};
export const excelColumn = (n: number): string =>
  n > 26
    ? excelColumn(Math.floor((n - 1) / 26)) + String.fromCharCode(65 + ((n - 1) % 26))
    : String.fromCharCode(64 + n);

/** Build once; the preview and download use this same workbook. Never modifies project/source. */
export async function buildBoqExport(
  project: Project,
  options: ExportOptions,
  source?: ArrayBuffer,
  vendors: Vendor[] = [],
) {
  const safe = project.name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Project';
  if (options.kind === 'original') {
    if (!source) throw new Error('The original workbook is unavailable.');
    const { patchOriginal } = await import('./workbook-patch');
    const bytes = await patchOriginal(source, project, options.fill);
    return {
      bytes,
      book: await loadWorkbook(bytes),
      filename: `${safe}-internal-priced-original.xlsx`,
    };
  }
  const { default: Excel } = await import('exceljs');
  const book = new Excel.Workbook();
  const sheet = book.addWorksheet('BOQ');
  const internal = options.kind === 'internal';
  const amounts = options.fill === 'amounts';
  const formulas = amounts && options.calculations === 'formulas';
  const t = totals(project);
  const draft =
    project.stage !== 'Approved' ||
    t.missing > 0 ||
    t.unresolved > 0 ||
    t.reviewed < project.items.length;
  const rateCol = internal ? 7 : 6,
    amountCol = rateCol + 1;
  const headers = [
    'Ref',
    'Description',
    'Specification & inclusions',
    'Unit',
    'Quantity',
    ...(internal ? ['Unit cost (INR)'] : []),
    'Selling rate (INR)',
    ...(amounts ? ['Amount (INR)'] : []),
    'Status',
    ...(internal ? ['Vendor', 'Brand', 'Model'] : []),
  ];
  sheet.addRow([project.name]);
  sheet.addRow([[project.client, project.location].filter(Boolean).join(' / ')]);
  sheet.addRow([
    `${internal ? 'INTERNAL COSTING. ' : ''}${draft ? 'DRAFT. ' : ''}Rates exclude GST. ${t.missing} unpriced; ${t.unresolved} quantities unresolved. ${amounts ? 'Rate-only lines have no amount.' : 'Rates only; no amounts or totals.'}`,
  ]);
  sheet.addRow(headers);
  project.items.forEach((item, index) => {
    const row = index + 5;
    const rate = sellingRate(item, project.markup),
      amount = lineAmount(item, project.markup);
    const amountValue =
      amount !== null && formulas
        ? { formula: `ROUND(E${row}*${excelColumn(rateCol)}${row},2)`, result: amount }
        : amount;
    sheet.addRow([
      item.reference || index + 1,
      item.description,
      [
        ...(item.context ?? []).map((c) => c.text),
        item.specification,
        item.brand ? `Brand: ${item.brand}` : '',
        item.model ? `Model: ${item.model}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      item.unit,
      item.quantityKind === 'rate-only' ? 'RO' : item.quantity,
      ...(internal ? [item.cost] : []),
      rate,
      ...(amounts ? [amountValue] : []),
      item.cost === null
        ? 'Unpriced'
        : item.quantity === null && item.quantityKind !== 'rate-only'
          ? 'Quantity needed'
          : item.reviewed
            ? 'Reviewed'
            : 'Needs review',
      ...(internal
        ? [
            vendors.find((v) => v.id === item.vendorId)?.name ??
              (item.vendorId ? 'Vendor unavailable' : 'No vendor linked'),
            item.brand ?? '',
            item.model ?? '',
          ]
        : []),
    ]);
  });
  const lastItem = sheet.rowCount;
  if (amounts) {
    sheet.addRow([]);
    const subtotalRow = sheet.rowCount + 1;
    const col = excelColumn(amountCol);
    const summary = (label: string, result: number, formula: string) => {
      const row = sheet.addRow([]);
      row.height = 32;
      row.getCell(2).value = label;
      row.getCell(amountCol).value = formulas ? { formula, result } : result;
    };
    summary(
      'Subtotal (priced lines)',
      t.selling,
      lastItem >= 5 ? `SUM(${col}5:${col}${lastItem})` : '0',
    );
    summary(`GST ${project.gst}%`, t.tax, `ROUND(${col}${subtotalRow}*${project.gst}/100,2)`);
    summary(
      t.missing || t.unresolved
        ? 'Partial total: unresolved lines excluded'
        : 'Total (rate-only lines excluded)',
      t.total,
      `SUM(${col}${subtotalRow}:${col}${subtotalRow + 1})`,
    );
  }
  const widths = [
    10,
    40,
    58,
    12,
    13,
    ...(internal ? [18] : []),
    20,
    ...(amounts ? [20] : []),
    20,
    ...(internal ? [26, 20, 20] : []),
  ];
  widths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
  for (let col = internal ? 6 : rateCol; col <= (amounts ? amountCol : rateCol); col++)
    sheet.getColumn(col).numFmt = '#,##0.00';
  sheet.getColumn(5).numFmt = '#,##0.###';
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });
  for (const row of [1, 2, 3]) sheet.mergeCells(row, 1, row, headers.length);
  sheet.getRow(1).height = 28;
  sheet.getRow(3).height = 34;
  sheet.getRow(4).height = 30;
  sheet.getRow(1).font = { name: 'Calibri', size: 16, bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  sheet.autoFilter = `A4:${excelColumn(headers.length)}${Math.max(4, lastItem)}`;
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:4',
    printArea: `A1:${excelColumn(headers.length)}${sheet.rowCount}`,
  };
  sheet.headerFooter.oddFooter = '&LBOQ&RPage &P of &N';
  if (options.formatting === 'simple') {
    sheet.getRow(4).eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFF6F7F5' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF183247' } };
    });
    for (let n = 5; n <= lastItem; n++) {
      const row = sheet.getRow(n);
      // Excel does not reliably auto-fit wrapped cells; size to the longest text column.
      row.height = Math.min(
        409,
        Math.max(
          32,
          15 *
            Math.max(
              ...[2, 3].map((c) =>
                String(row.getCell(c).value ?? '')
                  .split('\n')
                  .reduce(
                    (sum, line) => sum + Math.max(1, Math.ceil(line.length / (widths[c - 1] - 4))),
                    0,
                  ),
              ),
            ),
        ),
      );
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD6DFE4' } } };
        if (n % 2 === 1)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F3F5' } };
      });
    }
    for (let n = lastItem + 2; n <= sheet.rowCount; n++)
      sheet.getRow(n).font = { name: 'Calibri', bold: true, size: 11 };
  }
  if (options.notes && project.generalNotes) {
    const notes = book.addWorksheet('General notes');
    notes.getColumn(1).width = 100;
    for (const line of project.generalNotes.split('\n')) {
      const row = notes.addRow([line]);
      row.alignment = { wrapText: true, vertical: 'top' };
      row.height = Math.min(409, Math.max(18, 15 * Math.ceil(line.length / 90)));
    }
  }
  book.calcProperties.fullCalcOnLoad = true;
  const bytes = (await book.xlsx.writeBuffer()) as unknown as ArrayBuffer;
  return {
    bytes,
    book,
    filename: `${safe}${internal ? '-internal-costing' : '-client-BOQ'}${draft ? '-draft' : ''}.xlsx`,
  };
}

export type PreparedExport = Awaited<ReturnType<typeof buildBoqExport>>;
export function previewCell(cell: ExcelJS.Cell, original: boolean) {
  if (original && cell.formula) return `=${cell.formula} (recalculates in Excel)`;
  const value = cell.formula ? cell.result : cell.value;
  if (typeof value === 'number')
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: cell.numFmt === '#,##0.00' ? 2 : 0,
      maximumFractionDigits: cell.numFmt === '#,##0.00' ? 2 : 3,
    });
  return cell.text;
}
