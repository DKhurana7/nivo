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
    w.projects[0].items[0].assembly = { material: 100, labour: 10, other: 0, adjustment: 0 };
    const updated = applyRate(w.projects[0].items[0], w.rates[0]);
    expect(updated.reviewed).toBe(false);
    expect(updated.rateId).toBe('r1');
    expect(updated.assembly).toBeUndefined();
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

import { assemblyCost, isStale, lineAmount, unitCompatible } from '../src/lib/costing';
import type { Item, Rate } from '../src/lib/types';

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1',
  description: 'Test line',
  specification: '',
  category: 'Electrical',
  unit: 'nos',
  quantity: 1,
  cost: 100,
  reviewed: false,
  ...over,
});

describe('costing invariants', () => {
  it('INV-01: zero cost is priced and distinct from null cost', () => {
    expect(sellingRate(item({ cost: 0 }), 20)).toBe(0);
    expect(sellingRate(item({ cost: null }), 20)).toBeNull();
  });

  it('INV-02 and INV-03: a rate-only line has a selling rate but no amount', () => {
    const ro = item({ quantity: null, quantityKind: 'rate-only' });
    expect(sellingRate(ro, 20)).toBe(120);
    expect(lineAmount(ro, 20)).toBeNull();
  });

  it('INV-04: an unknown quantity produces no amount', () => {
    expect(lineAmount(item({ quantity: null, quantityKind: 'unknown' }), 20)).toBeNull();
  });

  it('INV-05: assembly cost applies the adjustment after summing components', () => {
    expect(assemblyCost({ material: 100, labour: 50, other: 10, adjustment: 10 })).toBe(176);
    expect(assemblyCost({ material: 0, labour: 0, other: 0, adjustment: 25 })).toBe(0);
  });

  it('INV-06: markup is applied on cost, not as a gross margin', () => {
    expect(sellingRate(item({ cost: 100 }), 20)).toBe(120);
    expect(sellingRate(item({ cost: 100 }), 0)).toBe(100);
  });

  it('INV-07: a per-item markup override wins over the project markup', () => {
    expect(sellingRate(item({ cost: 100, markupOverride: 50 }), 20)).toBe(150);
    expect(sellingRate(item({ cost: 100, markupOverride: 0 }), 20)).toBe(100);
  });

  it('INV-08: line amount multiplies quantity by the already-rounded selling rate', () => {
    const i = item({ cost: 33.333, quantity: 3 });
    const rate = sellingRate(i, 0)!;
    expect(rate).toBe(33.33);
    expect(lineAmount(i, 0)).toBe(99.99);
  });

  it('INV-13 and INV-15: unit aliases compare correctly without over-merging', () => {
    const rate = (unit: string): Rate => ({ unit }) as Rate;
    expect(unitCompatible(item({ unit: 'sq ft' }), rate('sqft'))).toBe(true);
    expect(unitCompatible(item({ unit: 'nos' }), rate('pcs'))).toBe(true);
    expect(unitCompatible(item({ unit: 'sq ft' }), rate('sq m'))).toBe(false);
    expect(unitCompatible(item({ unit: 'm' }), rate('r ft'))).toBe(false);
  });

  it('H-01: a rate with a blank validity must not be permanently expired', () => {
    const blank = { validUntil: '' } as Rate;
    expect(isStale(blank, '2026-09-23')).toBe(false);
  });
});
