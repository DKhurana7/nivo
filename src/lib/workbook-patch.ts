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
export async function patchOriginal(bytes: ArrayBuffer, project: Project) {
  const m = project.mapping;
  if (!m?.rate || project.items.some((i) => !i.sourceRow))
    throw new Error('Original export requires unchanged source rows and a mapped rate column.');
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
    ] as const) {
      if (!col) continue;
      const ref = `${columnName(col)}${item.sourceRow}`;
      if (seen.has(ref)) throw new Error(`Duplicate price anchor ${ref}; review merged rows.`);
      seen.add(ref);
      const re = new RegExp(`<c\\b([^>]*\\br="${ref}"[^>]*)(?:\\/>|>([\\s\\S]*?)<\\/c>)`);
      const match = xml.match(re);
      if (match?.[2]?.includes('<f')) {
        if (col === m.rate)
          throw new Error(
            `Rate cell ${ref} contains a formula. Use the clean export or review the source formula in Excel; no original export was produced.`,
          );
        continue; // preserve client amount formulas
      }
      if (match) {
        const attrs = match[1].replace(/\s+t="[^"]*"/g, '');
        xml = xml.replace(re, `<c${attrs}>${value === null ? '' : `<v>${value}</v>`}</c>`);
      } else {
        const rowRe = new RegExp(
          `(<row\\b[^>]*\\br="${item.sourceRow}"[^>]*>)([\\s\\S]*?)(<\\/row>)`,
        );
        if (!rowRe.test(xml)) throw new Error(`Source row ${item.sourceRow} missing.`);
        const cell = `<c r="${ref}">${value === null ? '' : `<v>${value}</v>`}</c>`;
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
