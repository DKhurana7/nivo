import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDrafts } from '../extraction';
import { callBrief } from '../voice';
import { seedWorkspace } from '../../src/lib/seed';

test('multiple explicit brand offers survive extraction without accepting duplicate drafts', () => {
  const brief = { items: [{ id: 'i1' }] } as any;
  const text =
    'Brand A model A1 is 100 per metre plus GST. Brand B model B1 is 120 per metre plus GST.';
  const a = {
    itemId: 'i1',
    unit: 'm',
    cost: 100,
    basis: 'excluding-gst',
    brand: 'Brand A',
    model: 'A1',
    terms: '',
    evidence: 'Brand A model A1 is 100 per metre plus GST.',
  };
  const b = {
    ...a,
    cost: 120,
    brand: 'Brand B',
    model: 'B1',
    evidence: 'Brand B model B1 is 120 per metre plus GST.',
  };
  const drafts = validateDrafts([a, b], brief, [{ role: 'user', text }]);
  assert.equal(drafts.length, 2);
  assert.equal(drafts[1].model, 'B1');
  assert.ok(drafts.every((d) => d.needsReview));
  assert.throws(() => validateDrafts([a, a], brief, [{ role: 'user', text }]));
});

test('voice brief includes requested product identity and excludes sourcing cost and supplier ids', () => {
  const w = seedWorkspace(),
    p = w.projects[0],
    item = p.items[0];
  Object.assign(item, { brand: 'Brand A', model: 'A1', vendorId: 'private-supplier', cost: 123 });
  w.enquiries = [
    {
      id: 'e',
      projectId: p.id,
      vendorId: w.vendors[0].id,
      itemIds: [item.id],
      status: 'Prepared',
      createdAt: '2026-09-23',
      notes: '',
      transcript: '',
    },
  ];
  const brief = callBrief(w, 'e');
  assert.equal(brief.items[0].brand, 'Brand A');
  assert.equal(brief.items[0].model, 'A1');
  assert.equal('cost' in brief.items[0], false);
  assert.equal('vendorId' in brief.items[0], false);
});
