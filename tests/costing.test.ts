import { describe, expect, it } from 'vitest';
import { applyRate, normalUnit, rateCandidates, sellingRate, totals } from '../src/lib/costing';
import { seedWorkspace } from '../src/lib/seed';
import { validateWorkspace } from '../src/lib/storage';
describe('pricing invariants', () => {
  it('does not turn an unpriced item into a zero quote', () => {
    const p = seedWorkspace().projects[0];
    const unpriced = p.items.find((i) => i.cost === null)!;
    expect(sellingRate(unpriced, 20)).toBeNull();
    const t = totals({ ...p, items: [unpriced] });
    expect(t.missing).toBe(1);
    expect(t.total).toBe(0);
  });
  it('uses markup on cost and rounds per-line selling prices before GST', () => {
    const p = seedWorkspace().projects[0];
    const item = { ...p.items[0], cost: 10.13, quantity: 3 };
    const t = totals({ ...p, items: [item], markup: 20, gst: 18 });
    expect(sellingRate(item, 20)).toBe(12.16);
    expect(t.selling).toBe(36.48);
    expect(t.tax).toBe(6.57);
    expect(t.total).toBe(43.05);
  });
  it('rejects incompatible units and expired quotations', () => {
    const w = seedWorkspace();
    expect(() => applyRate(w.projects[0].items[0], w.rates[1])).toThrow('Units do not match');
    expect(() => applyRate(w.projects[0].items[6], w.rates[4])).toThrow('expired');
  });
  it('applying a quotation always requires renewed review', () => {
    const w = seedWorkspace();
    const updated = applyRate(w.projects[0].items[0], w.rates[0]);
    expect(updated.reviewed).toBe(false);
    expect(updated.rateId).toBe('r1');
  });
  it('normalizes unit aliases without confusing sheet and area pricing', () => {
    expect(normalUnit('sq. ft.')).toBe('sqft');
    const w = seedWorkspace();
    expect(rateCandidates(w.projects[0].items[0], w.rates).map((r) => r.id)).toEqual(['r1']);
  });
  it('rejects corrupted backups and invalid monetary values', () => {
    const w = seedWorkspace();
    expect(validateWorkspace(w)).toBe(true);
    expect(validateWorkspace({ version: 1 })).toBe(false);
    w.projects[0].items[0].cost = -1;
    expect(validateWorkspace(w)).toBe(false);
  });
  it('rejects malformed enquiry evidence and invalid workbook mappings before restore', () => {
    const w = seedWorkspace();
    const malformed = {
      ...w,
      enquiries: [
        {
          id: 'e1',
          projectId: 'p1',
          vendorId: 'v1',
          itemIds: ['i1'],
          status: 'Prepared',
          createdAt: '2026-09-22',
          notes: '',
          transcript: '',
          quotes: {},
        },
      ],
    };
    expect(validateWorkspace(malformed)).toBe(false);
    expect(
      validateWorkspace({
        ...w,
        projects: [
          {
            ...w.projects[0],
            mapping: { sheet: 'BOQ', headerRow: 1, description: -1, unit: 2, quantity: 3 },
          },
        ],
      }),
    ).toBe(false);
  });
});
