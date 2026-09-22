import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseSheet, loadWorkbook } from '../src/lib/spreadsheet';
import { patchOriginal } from '../src/lib/workbook-patch';
import { totals, assemblyCost, sellingRate, normalUnit } from '../src/lib/costing';
import type { Project } from '../src/lib/types';
const mapping = {
  sheet: 'BOQ',
  headerRow: 1,
  reference: 1,
  description: 2,
  unit: 3,
  quantity: 4,
  rate: 5,
  amount: 6,
};
function fixture() {
  const b = new ExcelJS.Workbook(),
    s = b.addWorksheet('BOQ');
  s.addRow(['Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']);
  s.addRow(['A', 'Wiring']);
  s.addRow(['1', 'Supply and install FRLS copper with conduit and earthing']);
  s.addRow(['a', 'Primary points', 'Pts', 100, 0, { formula: 'D4*E4', result: 0 }]);
  s.addRow(['b', 'Optional points', 'Pts', 'RO', 0]);
  s.addRow(['2', 'Network switch', 'Nos', '', 0]);
  s.addRow(['3', 'Stabilizer', 'Set', 1, 0]);
  s.addRow(['', 'Includes two-year warranty']);
  for (const c of ['C', 'D', 'E', 'F']) s.mergeCells(`${c}7:${c}8`);
  b.addWorksheet('Costing').getCell('A1').value = 'Private supplier discounts';
  return b;
}
function project(items: Project['items']): Project {
  return {
    id: 'p',
    name: 'Synthetic fixture',
    client: 'Client',
    location: 'Delhi',
    kind: 'Residential',
    stage: 'Draft',
    createdAt: '2026-09-22',
    dueDate: '2026-09-30',
    markup: 25,
    gst: 18,
    items,
    mapping,
  };
}
describe('structured client BOQs', () => {
  it('retains unpriced source evidence and refuses to silently skip a priced rate formula', async () => {
    const book = fixture();
    book.getWorksheet('BOQ')!.getCell('E4').value = 75;
    book.getWorksheet('BOQ')!.getCell('E5').value = { formula: 'E4*2', result: 150 };
    const bytes = await book.xlsx.writeBuffer();
    const { items } = parseSheet(book, mapping, false);
    const output = await loadWorkbook(await patchOriginal(bytes as ArrayBuffer, project(items)));
    expect(output.getWorksheet('BOQ')!.getCell('E4').value).toBe(75);
    expect(output.getWorksheet('BOQ')!.getCell('E5').formula).toBe('E4*2');
    items[1].cost = 100;
    await expect(patchOriginal(bytes as ArrayBuffer, project(items))).rejects.toThrow(
      'Rate cell E5 contains a formula',
    );
  });
  it('keeps RO and unknown quantities, inheritance and merged notes without duplicate prices', () => {
    const { items } = parseSheet(fixture(), mapping, false);
    expect(items).toHaveLength(4);
    expect(items[0].context?.some((c) => c.text.includes('FRLS'))).toBe(true);
    expect(items[1].quantityKind).toBe('rate-only');
    expect(items[1].quantity).toBeNull();
    expect(items[2].quantityKind).toBe('unknown');
    expect(items[3].specification).toContain('two-year warranty');
    expect(items.every((i) => i.cost === null)).toBe(true);
  });
  it('excludes unknown/RO amounts but keeps rates; supports assemblies and unit aliases', () => {
    const { items } = parseSheet(fixture(), mapping, false);
    items.forEach((i) => (i.cost = 100));
    items[0].markupOverride = 10;
    const t = totals(project(items));
    expect(t.unresolved).toBe(1);
    expect(t.selling).toBe(11125);
    expect(sellingRate(items[1], 25)).toBe(125);
    expect(assemblyCost({ material: 621.12, labour: 200, other: 0, adjustment: 10 })).toBe(903.23);
    expect(normalUnit('Mtrs.')).toBe(normalUnit('RM'));
    expect(normalUnit('Pts.')).toBe(normalUnit('point'));
  });
  it('patches original cells without rewriting external links, hidden costing or drawings', async () => {
    const book = fixture();
    const bytes = await book.xlsx.writeBuffer();
    const zip = await JSZip.loadAsync(bytes);
    zip.file(
      'xl/externalLinks/externalLink1.xml',
      '<externalLink>preserve verbatim</externalLink>',
    );
    zip.file('xl/drawings/custom.bin', new Uint8Array([1, 2, 3, 4]));
    const original = await zip.generateAsync({ type: 'arraybuffer' });
    const { items } = parseSheet(book, mapping, false);
    items.forEach((i) => (i.cost = 100));
    const result = await patchOriginal(original, project(items));
    const patched = await JSZip.loadAsync(result);
    for (const [name, part] of Object.entries(zip.files)) {
      if (part.dir || ['xl/workbook.xml', 'xl/worksheets/sheet1.xml'].includes(name)) continue;
      expect(await patched.file(name)!.async('uint8array')).toEqual(await part.async('uint8array'));
    }
    const output = await loadWorkbook(result);
    expect(output.getWorksheet('BOQ')!.getCell('E7').value).toBe(125);
    expect(output.getWorksheet('BOQ')!.getCell('F4').formula).toBe('D4*E4');
    expect(output.getWorksheet('BOQ')!.getCell('F5').value).toBeNull();
    expect(output.getWorksheet('BOQ')!.getCell('F6').value).toBeNull();
  });
});
