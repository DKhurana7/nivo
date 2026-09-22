/** Prepare a private, restorable workspace from an explicitly mapped workbook. Never edits the source. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { cellText, loadWorkbook, parseSheet } from '../src/lib/spreadsheet';
import { validateWorkspace } from '../src/lib/validation';
import { categories, type Category, type WorkbookMapping, type Workspace } from '../src/lib/types';

const [input, configuration, output] = process.argv.slice(2);
if (!input || !configuration || !output)
  throw new Error(
    'Usage: node --import tsx scripts/prepare-boq.ts source.xlsx mapping-and-project.json output-directory',
  );
const config = JSON.parse(await readFile(configuration, 'utf8')) as {
  mapping: WorkbookMapping;
  name: string;
  company: string;
  category: Category;
  client?: string;
  location?: string;
  dueDate?: string;
  markup?: number;
  gst?: number;
};
if (!categories.includes(config.category)) throw new Error('Choose a valid category.');
const bytes = await readFile(input);
if (bytes.length > 10 * 1024 * 1024) throw new Error('Workbook exceeds 10 MB.');
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const sourceHash = hash(bytes);
const book = await loadWorkbook(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
if (book.worksheets.some((sheet) => sheet.rowCount > 10000 || sheet.columnCount > 100))
  throw new Error('Workbook exceeds supported dimensions.');
const { items, warnings } = parseSheet(book, config.mapping, false);
if (!items.length) throw new Error('No items found; check the mapping.');
const workbookId = randomUUID();
const notes = book.worksheets
  .filter((s) => /notes/i.test(s.name))
  .map((s) => {
    const rows: string[] = [];
    s.eachRow((row) => {
      const parts: string[] = [];
      row.eachCell((c) => {
        if (!c.isMerged || c.master.address === c.address) {
          const value = cellText(c.value).trim();
          if (value) parts.push(value);
        }
      });
      if (parts.length) rows.push(parts.join(' '));
    });
    return rows.join('\n');
  })
  .join('\n\n');
const workspace: Workspace = {
  version: 1,
  settings: {
    company: config.company,
    city: config.location ?? '',
    defaultMarkup: config.markup ?? 20,
    defaultGst: config.gst ?? 18,
  },
  projects: [
    {
      id: randomUUID(),
      name: config.name,
      client: config.client ?? '',
      location: config.location ?? '',
      kind: 'Residential',
      stage: 'Draft',
      createdAt: new Date().toISOString().slice(0, 10),
      dueDate: config.dueDate ?? '',
      markup: config.markup ?? 20,
      gst: config.gst ?? 18,
      items: items.map((item) => ({ ...item, category: config.category })),
      workbookId,
      mapping: config.mapping,
      generalNotes: notes,
    },
  ],
  vendors: [],
  rates: [],
  enquiries: [],
};
if (!validateWorkspace(workspace)) throw new Error('Project or mapping validation failed.');
const columns = Object.entries(config.mapping)
  .filter(([key]) => !['sheet', 'headerRow'].includes(key))
  .map(([, value]) => value);
if (new Set(columns).size !== columns.length) throw new Error('Mapped columns must be distinct.');
if (hash(await readFile(input)) !== sourceHash)
  throw new Error('Source changed during preparation.');
await mkdir(output, { recursive: true, mode: 0o700 });
const backup = resolve(output, 'workspace.nivo.json');
const report = resolve(output, 'readiness.json');
await writeFile(
  backup,
  JSON.stringify(
    { format: 'nivo-backup-v1', workspace, workbooks: { [workbookId]: bytes.toString('base64') } },
    null,
    2,
  ),
  { mode: 0o600, flag: 'wx' },
);
await writeFile(
  report,
  JSON.stringify(
    {
      source: basename(input),
      sourceHash,
      sourceUnchanged: true,
      mapping: config.mapping,
      items: items.length,
      measured: items.filter((i) => i.quantityKind === 'measured').length,
      rateOnly: items.filter((i) => i.quantityKind === 'rate-only').length,
      unresolved: items
        .filter((i) => i.quantityKind === 'unknown')
        .map((i) => ({ row: i.sourceRow, reference: i.reference, description: i.description })),
      sourceRates: items
        .filter((i) => (i.sourceRate ?? 0) > 0)
        .map((i) => ({ row: i.sourceRow, rate: i.sourceRate })),
      pricedItems: 0,
      warnings,
      review: [
        'Confirm client, location and due date.',
        'Review the default 20% markup and 18% GST before pricing.',
        'Verify inherited specification context and source rate basis.',
        'Add actual vendors and prepare enquiries of up to 20 items.',
      ],
    },
    null,
    2,
  ),
  { mode: 0o600, flag: 'wx' },
);
console.log(JSON.stringify({ backup, report, items: items.length, sourceUnchanged: true }));
