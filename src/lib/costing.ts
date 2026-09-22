import type { Item, Project, Rate } from './types';
import { today } from './types';
export const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const money = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n);
export const compactMoney = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : money(n);
export const sellingRate = (item: Item, markup: number) =>
  item.cost === null ? null : round(item.cost * (1 + (item.markupOverride ?? markup) / 100));
export function totals(project: Project) {
  const cost = round(
    project.items.reduce((sum, i) => sum + round((i.quantity ?? 0) * (i.cost ?? 0)), 0),
  );
  const selling = round(
    project.items.reduce(
      (sum, i) => sum + round((i.quantity ?? 0) * (sellingRate(i, project.markup) ?? 0)),
      0,
    ),
  );
  const tax = round((selling * project.gst) / 100);
  return {
    cost,
    selling,
    tax,
    total: round(selling + tax),
    profit: round(selling - cost),
    unresolved: project.items.filter((i) => i.quantity === null && i.quantityKind !== 'rate-only')
      .length,
    missing: project.items.filter((i) => i.cost === null).length,
    reviewed: project.items.filter((i) => i.reviewed && i.cost !== null).length,
  };
}
export function normalUnit(value: string) {
  const v = value.toLowerCase().replace(/[.\s²]/g, '');
  return (
    (
      {
        sqft: 'sqft',
        sf: 'sqft',
        ft2: 'sqft',
        sqm: 'sqm',
        m2: 'sqm',
        nos: 'nos',
        no: 'nos',
        pcs: 'nos',
        piece: 'nos',
        pieces: 'nos',
        rft: 'rft',
        rm: 'm',
        mtr: 'm',
        mtrs: 'm',
        meter: 'm',
        metre: 'm',
        pts: 'point',
        pt: 'point',
        points: 'point',
      } as Record<string, string>
    )[v] ?? v
  );
}
export const isStale = (r: Rate, date = today()) => r.validUntil < date;
export const unitCompatible = (item: Item, rate: Rate) =>
  normalUnit(item.unit) === normalUnit(rate.unit);
export function rateCandidates(item: Item, rates: Rate[]) {
  const words = new Set(
    `${item.description} ${item.specification}`
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2),
  );
  return rates
    .filter((r) => r.category === item.category && unitCompatible(item, r))
    .map((rate) => ({
      rate,
      score: `${rate.description} ${rate.specification}`
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => words.has(w)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.rate);
}
export function applyRate(item: Item, rate: Rate): Item {
  if (!unitCompatible(item, rate))
    throw new Error('Units do not match. Convert and verify the quotation before applying it.');
  if (isStale(rate))
    throw new Error('This rate has expired. Obtain a fresh quotation before applying it.');
  return { ...item, cost: rate.cost, assembly: undefined, rateId: rate.id, reviewed: false };
}
export const dateLabel = (s: string) =>
  s
    ? new Date(`${s}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : 'No date';

export const quantityLabel = (i: Item) =>
  i.quantityKind === 'rate-only'
    ? 'RO'
    : i.quantity === null
      ? 'Quantity needed'
      : i.quantity.toLocaleString('en-IN');
export const lineAmount = (i: Item, markup: number) =>
  i.quantity === null || sellingRate(i, markup) === null
    ? null
    : round(i.quantity * sellingRate(i, markup)!);
export const assemblyCost = (a: NonNullable<Item['assembly']>) =>
  round((a.material + a.labour + a.other) * (1 + a.adjustment / 100));
