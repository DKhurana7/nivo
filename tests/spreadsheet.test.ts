import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { cellText, loadWorkbook, numeric, parseSheet } from '../src/lib/spreadsheet';
const mapping = {
  sheet: 'Client BOQ',
  headerRow: 2,
  description: 2,
  unit: 3,
  quantity: 4,
  rate: 5,
  amount: 6,
};
describe('workbook parsing', () => {
  it('retains source row addresses, reads formula results and reports malformed rows', async () => {
    const book = new ExcelJS.Workbook();
    const s = book.addWorksheet(mapping.sheet);
    s.addRow(['Client title']);
    s.addRow(['Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']);
    s.addRow(['J-01', 'Plywood', 'sq ft', 32, 100]);
    s.addRow(['J-02', 'Laminate', 'sheet', 2, { formula: '100+50', result: 150 }]);
    s.addRow(['', 'Joinery subtotal']);
    s.addRow(['J-03', 'Hardware', 'set', 'TBC', 300]);
    const bytes = await book.xlsx.writeBuffer();
    const loaded = await loadWorkbook(bytes as unknown as ArrayBuffer);
    const parsed = parseSheet(loaded, mapping);
    expect(parsed.items).toHaveLength(3);
    expect(parsed.items[2].quantity).toBeNull();
    expect(parsed.items[2].quantityKind).toBe('unknown');
    expect(parsed.items.map((i) => i.sourceRow)).toEqual([3, 4, 6]);
    expect(parsed.items[1].cost).toBe(150);
    expect(parsed.warnings).toHaveLength(2);
  });
  it('does not import existing selling prices as costs when the user opts out', () => {
    const book = new ExcelJS.Workbook();
    const s = book.addWorksheet(mapping.sheet);
    s.addRow([]);
    s.addRow(['Ref', 'Description', 'Unit', 'Qty', 'Rate']);
    s.addRow([1, 'Tile', 'sq ft', 250, 95]);
    expect(parseSheet(book, mapping, false).items[0].cost).toBeNull();
  });
  it('accepts Indian numeric formatting but rejects ambiguity', () => {
    expect(numeric('₹1,25,000.50')).toBe(125000.5);
    expect(numeric('')).toBeNull();
    expect(numeric('95 + GST')).toBeNull();
    expect(numeric('-2')).toBeNull();
    expect(cellText({ richText: [{ text: 'Ply' }, { text: 'wood' }] })).toBe('Plywood');
  });
});
