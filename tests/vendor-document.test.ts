import { describe, it, expect } from 'vitest';
import {
  alignedRows,
  compareOffer,
  extractMappedOffers,
  quotedNumber,
  reviewedCost,
  suggestMapping,
  type SourceTable,
} from '../src/lib/vendor-document';
import { seedWorkspace } from '../src/lib/seed';
import { validateWorkspace } from '../src/lib/validation';
import { readBackup, sourceIds } from '../src/lib/backup';
import { createHash } from 'node:crypto';

const table: SourceTable = {
  name: 'Prices',
  rows: [
    { row: 1, cells: ['Vendor quotation'] },
    { row: 3, cells: ['Description', 'Unit', 'Quantity', 'Rate', 'Amount', 'Brand', 'Model'] },
    { row: 4, cells: ['Cable 2.5 sq mm', 'coil', '10', '₹1,180.00', '11800', 'Brand A', 'C25'] },
    {
      row: 5,
      cells: ['Cable 4 sq mm', 'coil', '10', '1,500', '15000', 'Brand B', 'C4'],
      formulas: [4],
    },
    { row: 6, cells: ['Cable unclear', 'coil', '10', '125 / 150', '1500'] },
    { row: 7, cells: ['Grand total', '', '', '', '28300'] },
  ],
};
const offer = () => extractMappedOffers(table, suggestMapping(table))[0];
describe('vendor document review', () => {
  it('maps unit rate rather than quantity/amount and retains alternative identity and evidence', () => {
    const mapping = suggestMapping(table);
    expect(mapping).toMatchObject({ header: 3, rate: 4, unit: 2, brand: 6, model: 7 });
    const offers = extractMappedOffers(table, mapping);
    expect(offers).toHaveLength(3);
    expect(offers[0]).toMatchObject({
      rate: 1180,
      brand: 'Brand A',
      model: 'C25',
      location: 'Prices, row 4',
    });
    expect(offers[0].evidence).toContain('5: 11800');
    expect(offers[1].warnings.join()).toContain('cached Excel formula');
    expect(offers[2].rate).toBeNull();
    expect(() => extractMappedOffers(table, { ...mapping, rate: 0 })).toThrow('Map description');
    expect(() => extractMappedOffers(table, { ...mapping, rate: 2 })).toThrow('different column');
  });
  it('rejects ambiguous or foreign prices and accepts explicit Indian currency/grouping', () => {
    for (const text of [
      '125 150',
      '1,25',
      '100-150',
      'USD 100',
      '125 + GST',
      '1e3',
      '-1',
      'Infinity',
      '',
    ])
      expect(quotedNumber(text)).toBeNull();
    for (const text of ['Rs. 1,23,456.50', 'INR 123456.50', '₹123,456.50'])
      expect(quotedNumber(text)).toBe(123456.5);
    expect(quotedNumber('0')).toBe(0);
  });
  it('aligns PDF text fragments to selected header positions without shifting missing cells', () => {
    const pdf: SourceTable = {
      name: 'Page 2',
      page: 2,
      rows: [
        {
          row: 1,
          cells: ['Description', 'Unit', 'Rate', 'Amount'],
          positions: [
            { x: 40, text: 'Description' },
            { x: 280, text: 'Unit' },
            { x: 330, text: 'Rate' },
            { x: 400, text: 'Amount' },
          ],
        },
        {
          row: 2,
          cells: [],
          positions: [
            { x: 40, text: 'Copper' },
            { x: 80, text: 'cable' },
            { x: 330, text: '125' },
            { x: 400, text: '1250' },
          ],
        },
      ],
    };
    expect(alignedRows(pdf, 1)[1].cells).toEqual(['Copper cable', '', '125', '1250']);
    expect(extractMappedOffers(pdf, suggestMapping(pdf))[0]).toMatchObject({
      rate: 125,
      unit: '',
      location: 'Page 2, line 2',
    });
  });
  it('warns about non-equivalent units, dimensions, brand, model and installation scope', () => {
    const item = {
      ...seedWorkspace().projects[0].items[0],
      description: 'Supply and install cable 4 sq mm',
      specification: '',
      context: [],
      unit: 'm',
      brand: 'Brand B',
      model: 'C4',
    };
    const match = compareOffer(offer(), item);
    expect(match.warnings.join(' ')).toMatch(/Unit mismatch.*Brand.*Model.*Size.*installation/);
    expect(item.cost).not.toBe(1180);
  });
  it('calculates discount, GST removal and pack conversion explicitly and refuses unknown basis', () => {
    expect(reviewedCost(1180, 'including-gst', 18, 10, 90)).toBe(10);
    expect(reviewedCost(125, 'excluding-gst', 0, 0, 1)).toBe(125);
    expect(reviewedCost(0, 'including-gst', 0, 0, 1)).toBe(0);
    for (const args of [
      [125, 'unknown', 0, 0, 1],
      [null, 'excluding-gst', 0, 0, 1],
      [125, 'including-gst', 18, 101, 1],
      [125, 'excluding-gst', 0, 0, 0],
      [Number.MAX_VALUE, 'excluding-gst', 0, 0, 1e-300],
    ] as const)
      expect(reviewedCost(args[0], args[1], args[2], args[3], args[4])).toBeNull();
  });
  it('validates provenance and refuses incomplete or changed document backups', async () => {
    const w = seedWorkspace(),
      bytes = Buffer.from('%PDF-1.7 synthetic');
    w.rates[0].document = {
      fileId: 'quote-test',
      filename: 'vendor.pdf',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      location: 'Page 1, line 2',
      excerpt: 'Cable m 125',
      projectId: w.projects[0].id,
      itemId: w.projects[0].items[0].id,
      quotedDescription: 'Cable',
      quotedUnit: 'm',
      quotedRate: 125,
      taxBasis: 'excluding-gst',
      gst: 0,
      discount: 0,
      unitsPerQuote: 1,
    };
    expect(validateWorkspace(w)).toBe(true);
    expect(sourceIds(w)).toEqual(['quote-test']);
    const backup = (workbooks: Record<string, string>) =>
      new File(
        [JSON.stringify({ format: 'nivo-backup-v1', workspace: w, workbooks })],
        'backup.json',
      );
    const restored = await readBackup(backup({ 'quote-test': bytes.toString('base64') }));
    expect(Buffer.from(restored.decoded[0].bytes)).toEqual(bytes);
    await expect(readBackup(backup({}))).rejects.toThrow('missing');
    await expect(
      readBackup(backup({ 'quote-test': Buffer.from('changed').toString('base64') })),
    ).rejects.toThrow('fingerprint');
    w.rates[0].document.unitsPerQuote = 0;
    expect(validateWorkspace(w)).toBe(false);
  });
});
