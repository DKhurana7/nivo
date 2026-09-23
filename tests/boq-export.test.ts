import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildBoqExport, defaultExportOptions, previewCell } from '../src/lib/boq-export';
import { seedWorkspace } from '../src/lib/seed';
import { loadWorkbook, parseSheet } from '../src/lib/spreadsheet';
import { applyRate, withOfferIdentity } from '../src/lib/costing';
import { validateWorkspace } from '../src/lib/validation';

function fixture() {
  const w = seedWorkspace(),
    p = w.projects[0];
  p.items = [
    {
      ...p.items[0],
      cost: 10.13,
      quantity: 3,
      brand: 'Brand A',
      model: 'M-1',
      vendorId: 'private-vendor',
      markupOverride: undefined,
    },
    { ...p.items[0], id: 'ro', cost: 100, quantity: null, quantityKind: 'rate-only' },
    { ...p.items[0], id: 'unknown', cost: 100, quantity: null, quantityKind: 'unknown' },
    { ...p.items[0], id: 'unpriced', cost: null, quantity: 10 },
    { ...p.items[0], id: 'zero', cost: 0, quantity: 10 },
  ];
  p.markup = 20;
  p.gst = 18;
  p.generalNotes = 'Private notes only when explicitly included';
  return p;
}
describe('reviewable Excel exports', () => {
  it('client output contains rounded selling prices and product identity, never suppliers or costs', async () => {
    const p = fixture(),
      before = JSON.stringify(p);
    const output = await buildBoqExport(p, defaultExportOptions, undefined, [
      { id: 'private-vendor', name: 'Private supplier' } as any,
    ]);
    const book = await loadWorkbook(output.bytes),
      s = book.getWorksheet('BOQ')!;
    expect(s.getCell('F5').value).toBe(12.16);
    expect(s.getCell('G5').value).toBe(36.48);
    expect(s.getCell('C5').text).toContain('Brand: Brand A');
    expect(s.getCell('C5').text).toContain('Model: M-1');
    expect(s.getCell('E6').value).toBe('RO');
    expect(s.getCell('G6').value).toBeNull();
    expect(s.getCell('G7').value).toBeNull();
    expect(s.getCell('F8').value).toBeNull();
    expect(s.getCell('F9').value).toBe(0);
    expect(s.getCell('G13').value).toBe(43.05);
    expect(book.worksheets).toHaveLength(1);
    expect(JSON.stringify(s.model)).not.toMatch(/Private supplier|private-vendor|Unit cost|10\.13/);
    expect(s.getCell('G5').numFmt).toBe('#,##0.00');
    expect(s.views[0].state).toBe('frozen');
    expect(s.pageSetup.orientation).toBe('landscape');
    expect(s.getCell('C5').alignment.wrapText).toBe(true);
    expect(s.getRow(5).height).toBeGreaterThan(20);
    expect(output.filename).toContain('draft');
    expect(JSON.stringify(p)).toBe(before);
  });
  it('formula mode has usable cached totals and never computes RO, unknown or unpriced amounts', async () => {
    const { bytes } = await buildBoqExport(fixture(), {
      ...defaultExportOptions,
      calculations: 'formulas',
    });
    const s = (await loadWorkbook(bytes)).getWorksheet('BOQ')!;
    expect(s.getCell('G5').formula).toBe('ROUND(E5*F5,2)');
    expect(s.getCell('G5').result).toBe(36.48);
    expect(s.getCell('G11').formula).toBe('SUM(G5:G9)');
    expect(s.getCell('G12').result).toBe(6.57);
    expect(s.getCell('G13').result).toBe(43.05);
    for (const row of [6, 7, 8]) expect(s.getCell(`G${row}`).value).toBeNull();
    expect(previewCell(s.getCell('G5'), false)).toBe('36.48');
  });
  it('rates-only omits amounts/totals and internal export includes selected supplier and cost', async () => {
    const p = fixture();
    const rates = await buildBoqExport(p, {
      ...defaultExportOptions,
      fill: 'rates',
      formatting: 'plain',
    });
    const s = rates.book.getWorksheet('BOQ')!;
    expect(s.rowCount).toBe(9);
    expect(s.getCell('G4').value).toBe('Status');
    expect(s.getCell('A4').fill?.type).not.toBe('pattern');
    const internal = await buildBoqExport(
      p,
      { ...defaultExportOptions, kind: 'internal', notes: true },
      undefined,
      [{ id: 'private-vendor', name: 'Private supplier' } as any],
    );
    const sheet = internal.book.getWorksheet('BOQ')!;
    expect(sheet.getCell('F5').value).toBe(10.13);
    expect(sheet.getCell('H5').value).toBe(36.48);
    expect(sheet.getCell('J5').value).toBe('Private supplier');
    expect(internal.book.worksheets).toHaveLength(2);
  });
  it('original rates-only preserves amounts and updates mapped product text without interpreting formulas', async () => {
    const b = new ExcelJS.Workbook(),
      s = b.addWorksheet('BOQ');
    s.addRow(['Description', 'Unit', 'Qty', 'Rate', 'Amount', 'Brand', 'Model']);
    s.addRow(['Cable', 'm', 3, 4, { formula: 'C2*D2', result: 12 }, 'Old brand', 'Old model']);
    b.addWorksheet('Private', { state: 'hidden' }).getCell('A1').value = 'Confidential';
    const bytes = (await b.xlsx.writeBuffer()) as ArrayBuffer;
    const mapping = {
      sheet: 'BOQ',
      headerRow: 1,
      description: 1,
      unit: 2,
      quantity: 3,
      rate: 4,
      amount: 5,
      brand: 6,
      model: 7,
    };
    const { items } = parseSheet(b, mapping, false);
    expect(items[0].brand).toBe('Old brand');
    Object.assign(items[0], { cost: 100, brand: 'A & B <Make> $&', model: '=1+1' });
    const out = await buildBoqExport(
      { ...fixture(), mapping, items },
      { ...defaultExportOptions, kind: 'original', fill: 'rates' },
      bytes,
    );
    const result = out.book.getWorksheet('BOQ')!;
    expect(result.getCell('D2').value).toBe(120);
    expect(result.getCell('E2').value).toEqual({ formula: 'C2*D2', result: 12 });
    expect(previewCell(result.getCell('E2'), true)).toContain('recalculates in Excel');
    expect(result.getCell('F2').value).toBe('A & B <Make> $&');
    expect(result.getCell('G2').value).toBe('=1+1');
    expect(result.getCell('G2').formula).toBeUndefined();
    expect(out.book.getWorksheet('Private')!.state).toBe('hidden');
  });
});

describe('brand and supplier costing', () => {
  it('switches the full offer identity and leaves alternative evidence intact', () => {
    const w = seedWorkspace(),
      i = w.projects[0].items[0];
    const a = { ...w.rates[0], brand: 'Brand A', model: 'A1', vendorId: 'v1', cost: 100 };
    const b = { ...a, id: 'alternative', brand: 'Brand B', model: 'B2', vendorId: 'v2', cost: 150 };
    const first = applyRate(i, a),
      second = applyRate(first, b);
    expect(second).toMatchObject({
      brand: 'Brand B',
      model: 'B2',
      vendorId: 'v2',
      cost: 150,
      rateId: 'alternative',
      reviewed: false,
    });
    expect(first.cost).toBe(100);
    expect(a.brand).toBe('Brand A');
    expect(applyRate(second, { ...a, brand: undefined, model: undefined })).toMatchObject({
      brand: '',
      model: '',
    });
    expect(withOfferIdentity({ ...i, cost: a.cost, rateId: a.id }, [a])).toMatchObject({
      brand: 'Brand A',
      vendorId: 'v1',
    });
    expect(withOfferIdentity({ ...i, cost: 123, rateId: a.id }, [a]).vendorId).toBeUndefined();
  });
  it('restores legacy workspaces and validates added product fields', () => {
    const w = seedWorkspace();
    expect(validateWorkspace(w)).toBe(true);
    w.projects[0].items[0].brand = 'A';
    w.rates[0].model = 'M';
    expect(validateWorkspace(JSON.parse(JSON.stringify(w)))).toBe(true);
    (w.projects[0].items[0] as any).vendorId = {};
    expect(validateWorkspace(w)).toBe(false);
  });
});
