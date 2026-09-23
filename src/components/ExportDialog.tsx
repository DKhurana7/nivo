import { useEffect, useState } from 'react';
import type { Project, Vendor } from '../lib/types';
import { totals } from '../lib/costing';
import { downloadBlob, originalBytes } from '../lib/spreadsheet';
import {
  buildBoqExport,
  defaultExportOptions,
  excelColumn,
  previewCell,
  type ExportOptions,
  type PreparedExport,
} from '../lib/boq-export';
import { Field, Modal } from './ui';

export function ExportDialog({
  project,
  vendors,
  onClose,
  notify,
}: {
  project: Project;
  vendors: Vendor[];
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [result, setResult] = useState<{
    project: Project;
    options: ExportOptions;
    artifact?: PreparedExport;
    error?: string;
  }>();
  const [sheetIndex, setSheetIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState(false);
  const ready = result?.project === project && result.options === options;
  const artifact = ready ? result.artifact : undefined;
  const error = ready ? result.error : undefined;
  const original = options.kind === 'original';
  const canOriginal =
    !!project.workbookId && !!project.mapping?.rate && project.items.every((i) => i.sourceRow);
  const t = totals(project);
  useEffect(() => {
    let current = true;
    setChecked(false);
    setPage(0);
    setSheetIndex(0);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const source = options.kind === 'original' ? await originalBytes(project) : undefined;
          const artifact = await buildBoqExport(project, options, source, vendors);
          if (current) {
            setResult({ project, options, artifact });
            if (options.kind === 'original')
              setSheetIndex(
                Math.max(
                  0,
                  artifact.book.worksheets.findIndex((s) => s.name === project.mapping?.sheet),
                ),
              );
          }
        } catch (e) {
          if (current)
            setResult({
              project,
              options,
              error: e instanceof Error ? e.message : 'Could not prepare the workbook.',
            });
        }
      })();
    }, 150);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [project, options, vendors]);
  const sheet = artifact?.book.worksheets[sheetIndex];
  const rowCount = sheet?.rowCount ?? 0;
  const columns = Math.min(100, sheet?.columnCount ?? 0);
  const start = page * 15 + 1;
  function change(update: Partial<ExportOptions>) {
    setOptions((o) => ({ ...o, ...update }));
  }
  return (
    <Modal
      title="Export this BOQ"
      subtitle="Choose a workbook, check the preview, then download Excel."
      wide
      onClose={onClose}
    >
      <div className="export-choices" role="group" aria-label="Workbook type">
        {(
          [
            [
              'client',
              'Client quotation',
              'A new workbook with selling prices. No purchase costs or source sheets.',
            ],
            [
              'original',
              'Fill the original workbook (internal)',
              'Keep the original layout, formulas and all sheets. Inspect before forwarding.',
            ],
            [
              'internal',
              'Internal costing workbook',
              'Purchase costs and selling prices together. For your studio only.',
            ],
          ] as const
        ).map(([kind, title, description]) => (
          <button
            key={kind}
            type="button"
            aria-pressed={options.kind === kind}
            disabled={kind === 'original' && !canOriginal}
            onClick={() => change({ kind })}
          >
            <strong>{title}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>
      {!canOriginal && (
        <p className="muted small-text">
          Original format needs a retained workbook, mapped rate column and unchanged source rows.
          The new client quotation is available.
        </p>
      )}
      <div className="form-grid export-settings">
        <Field label="Fill prices">
          <select
            value={options.fill}
            onChange={(e) => change({ fill: e.target.value as ExportOptions['fill'] })}
          >
            <option value="amounts">Selling rates and amounts</option>
            <option value="rates">Selling rates only</option>
          </select>
        </Field>
        {!original && (
          <>
            <Field label="Excel calculations">
              <select
                disabled={options.fill === 'rates'}
                value={options.calculations}
                onChange={(e) =>
                  change({ calculations: e.target.value as ExportOptions['calculations'] })
                }
              >
                <option value="values">Fixed values, ready to share</option>
                <option value="formulas">Formulas for amounts and totals</option>
              </select>
            </Field>
            <Field label="Workbook formatting">
              <select
                value={options.formatting}
                onChange={(e) =>
                  change({ formatting: e.target.value as ExportOptions['formatting'] })
                }
              >
                <option value="simple">Simple formatted workbook</option>
                <option value="plain">Plain, minimal styling</option>
              </select>
            </Field>
          </>
        )}
      </div>
      {!original && project.generalNotes && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={options.notes}
            onChange={(e) => change({ notes: e.target.checked })}
          />
          Include project general notes (review before sharing)
        </label>
      )}
      <p className="small-text">
        Prices use your saved markup and item overrides. Export includes all {project.items.length}{' '}
        items, regardless of workbench filters. It does not change your BOQ.
      </p>
      {(t.missing > 0 || t.unresolved > 0 || t.reviewed < project.items.length) && (
        <p className="notice">
          {t.missing} unpriced · {t.unresolved} quantities unresolved ·{' '}
          {project.items.length - t.reviewed} items not reviewed.
          {original
            ? ' Unpriced source cells stay unchanged and may contain unconfirmed rates.'
            : ' Unpriced rates stay blank; incomplete amounts are excluded. The workbook is marked draft.'}
        </p>
      )}
      {original && (
        <p className="notice">
          All original sheets, including hidden sheets, links and private information, are retained.
          Only mapped price cells are filled; descriptions and quantities stay as supplied.{' '}
          {options.fill === 'rates'
            ? 'Existing amounts and formulas stay unchanged.'
            : 'Existing amount formulas are preserved.'}{' '}
          Excel must recalculate formulas. This file is not automatically client-safe.
        </p>
      )}
      {original &&
        project.items.some(
          (i) =>
            i.cost !== null &&
            ((i.brand && !project.mapping?.brand) || (i.model && !project.mapping?.model)),
        ) && (
          <p className="notice">
            Chosen brand/model details have no mapped column in this source. They will not be
            written into the original. Use Client quotation to include them, or update the source
            mapping before issuing.
          </p>
        )}
      {original && options.fill === 'amounts' && !project.mapping?.amount && (
        <p className="notice">
          No amount column was mapped. Only rates can be filled in this original workbook.
        </p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!ready && <p role="status">Preparing workbook preview…</p>}
      {artifact && sheet && (
        <section className="export-preview" aria-label="Excel preview">
          <div className="export-preview-heading">
            <h3>Workbook preview</h3>
            <Field label="Preview sheet">
              <select
                value={sheetIndex}
                onChange={(e) => {
                  setSheetIndex(Number(e.target.value));
                  setPage(0);
                }}
              >
                {artifact.book.worksheets.map((s, index) => (
                  <option key={s.id} value={index}>
                    {s.name}
                    {s.state !== 'visible' ? ' (hidden)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="muted small-text">
            Cell contents from the workbook being downloaded. Excel layout, drawings and merged
            cells may look different.{' '}
            {original
              ? 'Formulas are shown instead of potentially outdated cached totals.'
              : 'New workbooks use wrapped text, frozen headings and landscape print settings.'}
          </p>
          <div
            className={`export-grid ${original ? 'original' : 'clean'} ${!original && options.formatting === 'simple' ? 'formatted' : ''}`}
            tabIndex={0}
            role="region"
            aria-label="Scrollable workbook cells"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  {Array.from({ length: columns }, (_, i) => (
                    <th key={i} scope="col">
                      {excelColumn(i + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.min(15, Math.max(0, rowCount - start + 1)) }, (_, i) => {
                  const n = start + i;
                  return (
                    <tr
                      key={n}
                      className={
                        !original && sheet.name === 'BOQ' && n === 4 ? 'export-header-row' : ''
                      }
                    >
                      <th scope="row">{n}</th>
                      {Array.from({ length: columns }, (_, c) => {
                        const cell = sheet.getCell(n, c + 1);
                        if (
                          cell.isMerged &&
                          cell.master.address !== cell.address &&
                          Number(cell.master.row) === n
                        )
                          return null;
                        let span = 1;
                        if (cell.isMerged && cell.master.address === cell.address) {
                          while (
                            c + span < columns &&
                            sheet.getCell(n, c + span + 1).master.address === cell.address
                          )
                            span++;
                        }
                        return (
                          <td key={c} colSpan={span}>
                            {cell.isMerged && Number(cell.master.row) !== n
                              ? ''
                              : previewCell(cell, original)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sheet.columnCount > 100 && (
            <p className="notice">
              Preview shows the first 100 columns; the download retains every column.
            </p>
          )}
          <div className="export-pagination">
            <button
              className="button secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous rows
            </button>
            <span aria-live="polite">
              {rowCount
                ? `${start}–${Math.min(start + 14, rowCount)} of ${rowCount} rows`
                : 'Empty sheet'}
            </span>
            <button
              className="button secondary"
              disabled={start + 14 >= rowCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next rows
            </button>
          </div>
        </section>
      )}
      {original && (
        <label className="check-row">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          I understand this includes every original sheet and will check private information before
          sharing.
        </label>
      )}
      <div className="form-footer export-download">
        <span className="muted small-text">{artifact?.filename}</span>
        <button
          className="button primary"
          disabled={!artifact || (original && !checked)}
          onClick={() => {
            if (!artifact) return;
            downloadBlob(
              artifact.bytes,
              artifact.filename,
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            );
            notify('Excel workbook exported');
            onClose();
          }}
        >
          Download Excel
        </button>
      </div>
    </Modal>
  );
}
