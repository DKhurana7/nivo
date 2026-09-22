/** Read-only compatibility check. Does not write app data or copy the input file. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadWorkbook, parseSheet } from '../src/lib/spreadsheet';
const path = process.argv[2];
if (!path) throw new Error('Pass a local XLSX file path.');
const bytes = await readFile(path);
const hash = createHash('sha256').update(bytes).digest('hex');
const book = await loadWorkbook(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
const mapping = {
  sheet: process.argv[3] || 'BOQ',
  headerRow: 3,
  reference: 1,
  description: 2,
  unit: 3,
  quantity: 4,
  rate: 5,
  amount: 6,
};
const result = parseSheet(book, mapping, false);
console.log(
  JSON.stringify(
    {
      sheets: book.worksheets.length,
      lines: result.items.length,
      measured: result.items.filter((i) => i.quantity !== null).length,
      rateOnly: result.items.filter((i) => i.quantityKind === 'rate-only').length,
      unknownQuantity: result.items.filter((i) => i.quantityKind === 'unknown').length,
      withContext: result.items.filter((i) => i.context?.length).length,
      sourceRates: result.items.filter((i) => (i.sourceRate ?? 0) > 0).length,
      distinctSourceRows: new Set(result.items.map((i) => i.sourceRow)).size,
      sourceUnchanged:
        hash ===
        createHash('sha256')
          .update(await readFile(path))
          .digest('hex'),
    },
    null,
    2,
  ),
);
