import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { Project } from './types';
import { lineAmount, sellingRate } from './costing';
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  isArray: (name) => ['sheet', 'Relationship'].includes(name),
});
const columnName = (n: number): string =>
  n > 26
    ? columnName(Math.floor((n - 1) / 26)) + String.fromCharCode(65 + ((n - 1) % 26))
    : String.fromCharCode(64 + n);
/** Patch existing OOXML cells only. All unrelated ZIP members retain identical uncompressed bytes. */
export async function patchOriginal(
  bytes: ArrayBuffer,
  project: Project,
  fill: 'amounts' | 'rates' = 'amounts',
) {
  const m = project.mapping;
  if (!m?.rate || project.items.some((i) => !i.sourceRow))
    throw new Error('Original export requires unchanged source rows and a mapped rate column.');
  const mapped = [
    m.description,
    m.unit,
    m.quantity,
    m.rate,
    m.amount,
    m.brand,
    m.model,
    m.specification,
    m.reference,
  ].filter(Boolean);
  if (new Set(mapped).size !== mapped.length)
    throw new Error('Each source field must use a different column.');
  const zip = await JSZip.loadAsync(bytes);
  const workbook = await zip.file('xl/workbook.xml')!.async('string');
  const sheets = parser.parse(workbook).workbook.sheets.sheet;
  const sheet = sheets.find((s: Record<string, string>) => s['@name'] === m.sheet);
  if (!sheet) throw new Error('Mapped sheet not found.');
  const rels = parser.parse(await zip.file('xl/_rels/workbook.xml.rels')!.async('string'))
    .Relationships.Relationship;
  const target: string = rels.find((r: Record<string, string>) => r['@Id'] === sheet['@r:id'])?.[
    '@Target'
  ];
  if (!target) throw new Error('Worksheet relationship is missing.');
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  let xml = await zip.file(path)!.async('string');
  const seen = new Set<string>();
  for (const item of project.items) {
    // Unpriced lines retain source evidence. Only accepted costs produce patched prices.
    if (item.cost === null) continue;
    for (const [col, value] of [
      [m.rate, sellingRate(item, project.markup)],
      [m.amount, lineAmount(item, project.markup)],
      [m.brand, item.brand],
      [m.model, item.model],
    ] as const) {
      if (!col || value === undefined || (col === m.amount && fill === 'rates')) continue;
      const ref = `${columnName(col)}${item.sourceRow}`;
      if (seen.has(ref)) throw new Error(`Duplicate price anchor ${ref}; review merged rows.`);
      seen.add(ref);
      const re = new RegExp(`<c\\b([^>]*\\br="${ref}"[^>]*)(?:\\/>|>([\\s\\S]*?)<\\/c>)`);
      const match = xml.match(re);
      if (match?.[2]?.includes('<f')) {
        if (col !== m.amount)
          throw new Error(
            `${col === m.rate ? 'Rate' : 'Product'} cell ${ref} contains a formula. Use the clean export or review the source formula in Excel; no original export was produced.`,
          );
        continue; // preserve client amount formulas
      }
      const content =
        value === null
          ? ''
          : typeof value === 'string'
            ? `<is><t xml:space="preserve">${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</t></is>`
            : `<v>${value}</v>`;
      const type = typeof value === 'string' ? ' t="inlineStr"' : '';
      if (match) {
        const attrs = match[1].replace(/\s+t="[^"]*"/g, '');
        xml = xml.replace(re, () => `<c${attrs}${type}>${content}</c>`);
      } else {
        const rowRe = new RegExp(
          `(<row\\b[^>]*\\br="${item.sourceRow}"[^>]*>)([\\s\\S]*?)(<\\/row>)`,
        );
        if (!rowRe.test(xml)) throw new Error(`Source row ${item.sourceRow} missing.`);
        const cell = `<c r="${ref}"${type}>${content}</c>`;
        xml = xml.replace(rowRe, (_all, start, cells, end) => {
          const next = [
            ...cells.matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g),
          ].find((x) => [...x[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) > col);
          return (
            start +
            (next ? cells.slice(0, next.index) + cell + cells.slice(next.index) : cells + cell) +
            end
          );
        });
      }
    }
  }
  zip.file(path, xml);
  // Excel must recompute formula caches. Preserve external-link metadata and all other workbook parts.
  const calc = /<calcPr\b[^>]*\/?\s*>/;
  const recalc = '<calcPr calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/>';
  zip.file(
    'xl/workbook.xml',
    calc.test(workbook)
      ? workbook.replace(calc, recalc)
      : workbook.replace('</workbook>', recalc + '</workbook>'),
  );
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
