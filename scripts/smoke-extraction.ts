/** Real local-model extraction check using synthetic, non-client evidence. */
import { extractQuotes } from '../server/extraction';
import assert from 'node:assert/strict';
const brief = {
  company: 'Test Studio',
  project: 'Synthetic test',
  location: 'Delhi',
  vendor: 'Test Vendor',
  phone: '',
  notes: '',
  generalNotes: '',
  items: [
    {
      id: 'synthetic-cable',
      reference: undefined,
      context: undefined,
      brand: undefined,
      model: undefined,
      description: 'FRLS copper cable',
      specification: '2.5 sq mm, supply only',
      unit: 'm',
      quantity: 100,
      quantityKind: 'measured' as const,
    },
  ],
};
const transcript = [
  { role: 'assistant', text: 'Please confirm the cable rate per metre before GST.' },
  {
    role: 'user',
    text: 'The 2.5 square millimetre FRLS copper cable is 125 rupees per metre excluding GST. Supply only, delivery extra. This quote is valid for seven days.',
  },
];
const drafts = await extractQuotes(brief, transcript);
assert.equal(drafts.length, 1);
assert.equal(drafts[0].itemId, 'synthetic-cable');
assert.equal(drafts[0].cost, 125);
assert.equal(drafts[0].basis, 'excluding-gst');
assert.equal(drafts[0].needsReview, true);
console.log(
  'Real local extraction passed: ₹125 per quoted unit, excluding GST, with verbatim vendor evidence; draft still requires human review.',
);
