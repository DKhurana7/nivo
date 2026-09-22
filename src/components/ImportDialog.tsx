import { useState } from 'react';
import type ExcelJS from 'exceljs';
import { uid, type Project, type WorkbookMapping } from '../lib/types';
import { cellText, loadWorkbook, parseSheet, retainWorkbook } from '../lib/spreadsheet';
import { Field, Icon, Modal, Skeleton } from './ui';
import { remote } from '../lib/api';

export function ImportDialog({
  project,
  onSave,
  onClose,
}: {
  project: Project;
  onSave: (p: Project) => void;
  onClose: () => void;
}) {
  const [book, setBook] = useState<ExcelJS.Workbook>();
  const [bytes, setBytes] = useState<ArrayBuffer>();
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mapping, setMapping] = useState<WorkbookMapping>({
    sheet: '',
    headerRow: 1,
    description: 1,
    quantity: 3,
    unit: 2,
  });
  const [confirmed, setConfirmed] = useState(false);
  const [importCosts, setImportCosts] = useState(false);
  const sheet = book?.getWorksheet(mapping.sheet);
  const columns = Array.from({ length: Math.min(sheet?.columnCount ?? 0, 100) }, (_, i) => ({
    id: i + 1,
    label: `${i + 1}. ${cellText(sheet!.getRow(mapping.headerRow).getCell(i + 1).value).slice(0, 55) || 'Unnamed column'}`,
  }));
  const result = book ? parseSheet(book, mapping, importCosts) : undefined;
  const mapped = [
    mapping.description,
    mapping.quantity,
    mapping.unit,
    mapping.specification,
    mapping.reference,
    mapping.rate,
    mapping.amount,
  ].filter(Boolean);
  const duplicates = new Set(mapped).size !== mapped.length;
  async function read(file?: File) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx'))
        throw new Error(
          'Choose an .xlsx workbook. Convert legacy .xls or macro-enabled files in Excel first.',
        );
      if (file.size > 10 * 1024 * 1024)
        throw new Error(
          'This pilot supports workbooks up to 10 MB. Remove unused sheets or images and try again.',
        );
      const data = await file.arrayBuffer();
      const workbook = await loadWorkbook(data);
      if (!workbook.worksheets.length) throw new Error('This workbook has no worksheets.');
      if (workbook.worksheets.some((s) => s.rowCount > 10000 || s.columnCount > 100))
        throw new Error('Use a workbook with at most 10,000 rows and 100 columns per sheet.');
      setBytes(data);
      setBook(workbook);
      setFilename(file.name);
      setMapping({
        sheet: workbook.worksheets[0].name,
        headerRow: 1,
        description: 1,
        unit: 2,
        quantity: 3,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not read this workbook. Try saving a fresh XLSX copy in Excel.',
      );
    } finally {
      setBusy(false);
    }
  }
  const select = (key: keyof WorkbookMapping, label: string, optional = false) => (
    <Field label={label}>
      <select
        value={mapping[key] ?? ''}
        onChange={(e) =>
          setMapping({ ...mapping, [key]: e.target.value ? Number(e.target.value) : undefined })
        }
      >
        {optional && <option value="">Do not import</option>}
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <Modal
      title="Import a client BOQ"
      subtitle="Map the columns once. Keep each line connected to its source row."
      onClose={onClose}
      wide
    >
      {!book && !busy && (
        <label className="upload-zone">
          <Icon name="upload" size={30} />
          <strong>Choose your Excel workbook</strong>
          <span>
            .xlsx, up to 10 MB.{' '}
            {remote ? 'Saved privately to your studio.' : 'Files stay in this browser.'}
          </span>
          <input
            type="file"
            accept=".xlsx"
            aria-label="Choose Excel workbook"
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
      )}
      {busy && <Skeleton />}
      {book && !busy && (
        <>
          <div className="file-label">
            <Icon name="boq" />
            <span>{filename}</span>
          </div>
          <div className="form-grid">
            <Field label="Worksheet">
              <select
                value={mapping.sheet}
                onChange={(e) => setMapping({ ...mapping, sheet: e.target.value })}
              >
                {book.worksheets.map((s) => (
                  <option key={s.name}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Header row">
              <input
                type="number"
                min="1"
                max={Math.max(1, sheet?.rowCount ?? 1)}
                value={mapping.headerRow}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    headerRow: Math.max(
                      1,
                      Math.min(sheet?.rowCount ?? 1, Number(e.target.value) || 1),
                    ),
                  })
                }
              />
            </Field>
          </div>
          <div className="form-grid thirds">
            {select('description', 'Description')}
            {select('reference', 'Original reference', true)}
            {select('quantity', 'Quantity')}
            {select('unit', 'Unit')}
            {select('specification', 'Specification', true)}
            {select('rate', 'Rate column', true)}
            {select('amount', 'Amount column', true)}
          </div>
          <p className="notice">
            Sections and preceding specification rows are retained as context; check their relevance
            before issuing enquiries. RO lines carry a rate without an amount. Blank quantities
            require resolution. Zero source rates remain unpriced. The rate column identifies where
            selling prices should go on export. Existing prices are ignored unless you explicitly
            import them as purchase costs. Original export does not rewrite the client's totals or
            tax formulas.
          </p>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={importCosts}
              disabled={!mapping.rate}
              onChange={(e) => setImportCosts(e.target.checked)}
            />
            Import existing rate values as purchase costs before GST (only if you have verified
            their basis).
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I have checked the columns and rate basis. This replaces this project's current BOQ.
          </label>
          <h3 className="preview-title">
            Preview <span>{result?.items.length} items</span>
          </h3>
          <div className="table-scroll preview-table">
            <table>
              <thead>
                <tr>
                  <th>Source row</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {result?.items.slice(0, 5).map((i) => (
                  <tr key={i.id}>
                    <td>{i.sourceRow}</td>
                    <td>{i.description}</td>
                    <td>{i.unit}</td>
                    <td>
                      {i.quantityKind === 'rate-only' ? 'RO' : (i.quantity ?? 'Needs quantity')}
                    </td>
                    <td>{i.cost ?? 'Unpriced'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!result?.warnings.length && (
            <details className="notice">
              <summary>{result.warnings.length} import warnings</summary>
              {result.warnings.slice(0, 30).map((w) => (
                <p key={w}>{w}</p>
              ))}
            </details>
          )}
          {duplicates && <p className="error">Each field must use a different column.</p>}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!book || !result?.items.length || !confirmed || duplicates || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const workbookId = await retainWorkbook(bytes!);
              onSave({
                ...project,
                items: result!.items.map((i) => ({ ...i, id: uid() })),
                workbookId,
                mapping,
                generalNotes: book!.worksheets
                  .filter((s) => /notes/i.test(s.name))
                  .map((s) => {
                    const lines: string[] = [];
                    s.eachRow((r) => {
                      const parts: string[] = [];
                      r.eachCell((c) => {
                        if (!c.isMerged || c.master.address === c.address) {
                          const t = cellText(c.value).trim();
                          if (t) parts.push(t);
                        }
                      });
                      if (parts.length) lines.push(parts.join(' '));
                    });
                    return lines.join('\n');
                  })
                  .join('\n\n'),
                stage: 'Draft',
                demo: false,
              });
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : 'The source workbook could not be saved. Check storage availability and try again.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Import {result?.items.length || ''} items
        </button>
      </div>
    </Modal>
  );
}
