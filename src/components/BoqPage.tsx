import { VendorDocumentDialog } from './VendorDocumentDialog';
import { useState } from 'react';
import { categories, type Item, type Project, type Workspace, type Rate } from '../lib/types';
import {
  applyRate,
  productLabel,
  dateLabel,
  isStale,
  money,
  rateCandidates,
  sellingRate,
  quantityLabel,
  lineAmount,
  totals,
} from '../lib/costing';
import { ExportDialog } from './ExportDialog';
import { Badge, Empty, Field, Icon, Modal, Search } from './ui';
import { ItemForm, ProjectForm, RateForm } from './forms';
import { ImportDialog } from './ImportDialog';

export function BoqPage({
  workspace,
  project,
  onUpdate,
  onDeleteProject,
  onSelect,
  onNew,
  notify,
  onEnquire,
  onAddRate,
}: {
  workspace: Workspace;
  project?: Project;
  onUpdate: (p: Project) => void;
  onDeleteProject: (id: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  notify: (s: string) => void;
  onEnquire: () => void;
  onAddRate: (rate: Rate) => void;
}) {
  const [documentImport, setDocumentImport] = useState(false);
  const [projectDetails, setProjectDetails] = useState(false);
  const [deleteProject, setDeleteProject] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All items');
  const [filter, setFilter] = useState('All');
  const [edit, setEdit] = useState<Item | 'new' | null>(null);
  const [matching, setMatching] = useState<Item | null>(null);
  const [quoting, setQuoting] = useState<Item | null>(null);
  const [offerSearch, setOfferSearch] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [deleting, setDeleting] = useState<Item | null>(null);
  if (!project)
    return (
      <Empty
        title="Your first BOQ starts here"
        text="Create a project, then add items or import a client workbook."
      >
        <button className="button primary" onClick={onNew}>
          <Icon name="plus" />
          New project
        </button>
      </Empty>
    );
  const t = totals(project);
  const updateItem = (item: Item) =>
    onUpdate({
      ...project,
      stage: 'Draft',
      items: project.items.map((i) => (i.id === item.id ? item : i)),
    });
  const toggleReview = (item: Item) => {
    const source = workspace.rates.find((r) => r.id === item.rateId);
    if (!item.reviewed && source && isStale(source)) {
      notify('Refresh the expired source rate before reviewing this item.');
      return;
    }
    updateItem({ ...item, reviewed: !item.reviewed });
  };
  const filtered = project.items.filter(
    (i) =>
      (category === 'All items' || i.category === category) &&
      (filter === 'All' ||
        (filter === 'Unpriced' && i.cost === null) ||
        (filter === 'Needs review' && !i.reviewed)) &&
      `${i.description} ${i.specification} ${i.brand ?? ''} ${i.model ?? ''} ${workspace.vendors.find((v) => v.id === i.vendorId)?.name ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const candidates = matching
    ? rateCandidates(matching, workspace.rates).filter((r) =>
        `${r.description} ${r.specification} ${r.brand ?? ''} ${r.model ?? ''} ${workspace.vendors.find((v) => v.id === r.vendorId)?.name ?? ''}`
          .toLowerCase()
          .includes(offerSearch.toLowerCase()),
      )
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">
            Projects <span>/</span> Bill of quantities
          </div>
          <h1>{project.name}</h1>
          <p>
            {[project.client, project.location].filter(Boolean).join(' / ') ||
              'Add client and location in Project details'}
          </p>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={() => setDocumentImport(true)}>
            Import vendor quotation
          </button>
          <button className="button secondary" onClick={() => setImporting(true)}>
            <Icon name="upload" />
            Import Excel
          </button>
          <button className="button primary" onClick={() => setExporting(true)}>
            <Icon name="download" />
            Export BOQ
          </button>
        </div>
      </div>
      <div className="project-context">
        <label className="project-switch">
          <span>Project</span>
          <select
            aria-label="Choose project"
            value={project.id}
            onChange={(e) => {
              onSelect(e.target.value);
              setSearch('');
              setCategory('All items');
            }}
          >
            {workspace.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Badge tone="blue">{project.stage}</Badge>
        {project.demo && <Badge>Sample project</Badge>}
        <button className="text-button" onClick={() => setProjectDetails(true)}>
          Project details
        </button>
        <span className="context-spacer" />
        <span>
          {t.reviewed} of {project.items.length} reviewed
        </span>
        <button className="text-button" onClick={() => setPricing(true)}>
          Pricing settings <Icon name="settings" size={16} />
        </button>
      </div>
      <div className="boq-summary">
        <div>
          <span>{t.missing ? 'Partial selling value' : 'Selling value'}</span>
          <strong>{money(t.selling)}</strong>
          <small>Before GST</small>
        </div>
        <div>
          <span>Estimated cost</span>
          <strong>{money(t.cost)}</strong>
          <small>{project.markup}% markup on cost</small>
        </div>
        <div className="summary-status">
          <span>Pricing completeness</span>
          <strong>
            {project.items.length
              ? Math.round(((project.items.length - t.missing) / project.items.length) * 100)
              : 0}
            <small>%</small>
          </strong>
          <div className="progress-track">
            <i
              style={{
                width: `${project.items.length ? ((project.items.length - t.missing) / project.items.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>
      <div className="workbench">
        <div className="workbench-toolbar">
          <div className="tabs" aria-label="BOQ status filter">
            {['All', 'Unpriced', 'Needs review'].map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f}
                {f === 'Unpriced' && <span>{t.missing}</span>}
              </button>
            ))}
          </div>
          <button className="button small primary" onClick={() => setEdit('new')}>
            <Icon name="plus" size={16} />
            Add item
          </button>
        </div>
        <div className="filter-row">
          <Search value={search} onChange={setSearch} placeholder="Find an item or specification" />
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {['All items', ...categories].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <span className="table-caption">All rates in INR, before GST</span>
        </div>
        {filtered.length ? (
          <>
            <div className="table-scroll boq-desktop-table">
              <table className="boq-table">
                <thead>
                  <tr>
                    <th className="ref">Ref</th>
                    <th>Item & specification</th>
                    <th>Unit</th>
                    <th className="numeric">Qty</th>
                    <th className="numeric">Unit cost</th>
                    <th className="numeric">Selling rate</th>
                    <th className="numeric">Amount</th>
                    <th>Review</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const rate = sellingRate(item, project.markup);
                    const source = workspace.rates.find((r) => r.id === item.rateId);
                    return (
                      <tr key={item.id}>
                        <td className="ref">
                          {item.reference ||
                            String(project.items.indexOf(item) + 1).padStart(2, '0')}
                        </td>
                        <td className="item-description">
                          <button className="item-title" onClick={() => setEdit(item)}>
                            {item.description}
                          </button>
                          <p>
                            {item.specification ||
                              (item.context?.length
                                ? 'Inherited specification · open item to review'
                                : 'Specification not provided')}
                          </p>
                          <p className="item-meta">
                            {productLabel(item)} /{' '}
                            {workspace.vendors.find((v) => v.id === item.vendorId)?.name ??
                              'No vendor linked'}
                          </p>
                          <span className="item-meta">
                            {item.category}
                            {source
                              ? ` / ${source.source}${isStale(source) ? ' (expired)' : ''}`
                              : item.cost !== null
                                ? ' / Manual estimate'
                                : ''}
                          </span>
                        </td>
                        <td>{item.unit}</td>
                        <td className="numeric">{quantityLabel(item)}</td>
                        <td className="numeric">
                          <button
                            className={`rate-value ${item.cost === null ? 'missing' : ''}`}
                            onClick={() => {
                              setMatching(item);
                              setOfferSearch('');
                              setConfirmed(false);
                            }}
                          >
                            {item.cost === null ? 'Find rate' : money(item.cost, 2)}
                          </button>
                        </td>
                        <td className="numeric muted">
                          {rate === null ? 'Not priced' : money(rate, 2)}
                        </td>
                        <td className="numeric strong">
                          {lineAmount(item, project.markup) === null
                            ? item.quantityKind === 'rate-only'
                              ? 'Rate only'
                              : 'Incomplete'
                            : money(lineAmount(item, project.markup)!, 2)}
                        </td>
                        <td>
                          <button
                            className={`review-button ${item.reviewed ? 'reviewed' : ''}`}
                            disabled={
                              item.cost === null ||
                              (item.quantity === null && item.quantityKind !== 'rate-only')
                            }
                            title={
                              source && isStale(source)
                                ? 'Source has expired; refresh it before reviewing'
                                : 'Toggle review status'
                            }
                            onClick={() => toggleReview(item)}
                          >
                            {item.cost === null
                              ? 'Unpriced'
                              : item.reviewed
                                ? 'Reviewed'
                                : 'Review'}
                          </button>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              onClick={() => setEdit(item)}
                              aria-label={`Edit ${item.description}`}
                            >
                              <Icon name="edit" size={16} />
                            </button>
                            <button
                              className="icon-button"
                              onClick={() => setDeleting(item)}
                              aria-label={`Delete ${item.description}`}
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="boq-mobile-list">
              {filtered.map((item) => (
                <MobileBoqItem
                  key={item.id}
                  item={item}
                  markup={project.markup}
                  source={
                    `${productLabel(item)} / ${workspace.vendors.find((v) => v.id === item.vendorId)?.name ?? 'No vendor linked'} / ` +
                    (workspace.rates.find((r) => r.id === item.rateId)?.source ??
                      (item.cost !== null ? 'Manual estimate' : 'No rate yet'))
                  }
                  onMatch={() => {
                    setMatching(item);
                    setOfferSearch('');
                    setConfirmed(false);
                  }}
                  onEdit={() => setEdit(item)}
                  onDelete={() => setDeleting(item)}
                  onReview={() => toggleReview(item)}
                />
              ))}
            </div>
          </>
        ) : (
          <Empty
            title={project.items.length ? 'No matching items' : 'Give this project its first line'}
            text={
              project.items.length
                ? 'Try another search or category.'
                : 'Add a work item or import the BOQ your client sent.'
            }
          >
            {!project.items.length && (
              <button className="button secondary" onClick={() => setEdit('new')}>
                Add first item
              </button>
            )}
          </Empty>
        )}
        <div className="table-footer">
          <span>
            {filtered.length} of {project.items.length} items
          </span>
          <span>
            {t.missing
              ? `${t.missing} unpriced items excluded from totals`
              : 'Every item has a rate'}
          </span>
        </div>
      </div>
      <div className="boq-bottom">
        <div className="boq-note">
          <Icon name="info" />
          <div>
            <strong>A rate is only as good as its specification.</strong>
            <p>
              Confirm units, inclusions and validity before reviewing a line. Markup is applied to
              cost; it is not a gross-margin percentage.
            </p>
            {t.missing > 0 && (
              <button className="text-button" onClick={onEnquire}>
                Prepare a vendor enquiry <Icon name="arrow" size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="totals">
          <div>
            <span>Subtotal</span>
            <span>{money(t.selling, 2)}</span>
          </div>
          <div>
            <span>GST ({project.gst}%)</span>
            <span>{money(t.tax, 2)}</span>
          </div>
          <div className="grand-total">
            <span>{t.missing ? 'Partial total' : 'Project total'}</span>
            <strong>{money(t.total, 2)}</strong>
          </div>
          <button
            className="button secondary full"
            disabled={
              !project.items.length ||
              t.reviewed !== project.items.length ||
              t.unresolved > 0 ||
              project.items.some((i) => {
                const r = workspace.rates.find((r) => r.id === i.rateId);
                return r && isStale(r);
              })
            }
            onClick={() => {
              onUpdate({ ...project, stage: 'Approved' });
              notify('BOQ approved. Subsequent edits reopen it as a draft.');
            }}
          >
            Approve reviewed BOQ
          </button>
        </div>
      </div>
      {projectDetails && (
        <ProjectForm
          settings={workspace.settings}
          project={project}
          onClose={() => setProjectDetails(false)}
          onSave={(p) => {
            onUpdate(p);
            setProjectDetails(false);
            notify('Project details saved');
          }}
          onDelete={() => {
            setProjectDetails(false);
            setDeleteProject(true);
          }}
        />
      )}
      {deleteProject && (
        <Modal
          title="Delete this project?"
          subtitle={project.name}
          onClose={() => setDeleteProject(false)}
        >
          <p>
            This removes the project's BOQ and its enquiries. Your vendors and saved rate evidence
            are retained. Export a backup first if you need to keep this project.
          </p>
          <div className="form-footer">
            <button className="button secondary" onClick={() => setDeleteProject(false)}>
              Keep project
            </button>
            <button
              className="button danger"
              onClick={() => {
                onDeleteProject(project.id);
                setDeleteProject(false);
                notify('Project deleted');
              }}
            >
              Delete project
            </button>
          </div>
        </Modal>
      )}
      {edit && (
        <ItemForm
          item={edit === 'new' ? undefined : edit}
          vendors={workspace.vendors}
          brands={[
            ...new Set(
              [...workspace.rates, ...workspace.projects.flatMap((p) => p.items)]
                .map((i) => i.brand)
                .filter((b): b is string => !!b),
            ),
          ]}
          onClose={() => setEdit(null)}
          onSave={(i) => {
            const previous = project.items.find((x) => x.id === i.id);
            const structureChanged =
              previous &&
              ['description', 'specification', 'unit', 'quantity'].some(
                (key) => previous[key as keyof Item] !== i[key as keyof Item],
              );
            onUpdate({
              ...project,
              stage: 'Draft',
              workbookId: structureChanged ? undefined : project.workbookId,
              items: previous
                ? project.items.map((x) =>
                    x.id === i.id
                      ? { ...i, sourceRow: structureChanged ? undefined : i.sourceRow }
                      : x,
                  )
                : [...project.items, i],
            });
            setEdit(null);
            notify('BOQ item saved');
          }}
        />
      )}
      {quoting && (
        <RateForm
          item={quoting}
          vendors={workspace.vendors}
          vendorId={quoting.vendorId}
          onClose={() => setQuoting(null)}
          onSave={(rate) => {
            onAddRate(rate);
            setMatching(quoting);
            setOfferSearch('');
            setConfirmed(false);
            setQuoting(null);
            notify('Offer saved. Compare and apply it when ready.');
          }}
        />
      )}
      {importing && (
        <ImportDialog
          project={project}
          onClose={() => setImporting(false)}
          onSave={(p) => {
            onUpdate(p);
            setImporting(false);
            notify(`${p.items.length} BOQ items imported`);
          }}
        />
      )}
      {matching && (
        <Modal
          title="Choose a rate"
          subtitle={matching.description}
          onClose={() => setMatching(null)}
          wide
        >
          <div className="notice">
            Required: {matching.specification || 'Confirm the specification first'} /{' '}
            {matching.unit}. Matches are suggestions based on category and unit, not verified
            equivalents.
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I will verify the selected rate covers this exact specification and location.
          </label>
          <p className="small-text">
            Current choice: {productLabel(matching)}. Choosing an offer replaces this item's brand,
            model, vendor and cost; the other offers remain in the library.
          </p>
          <Search
            value={offerSearch}
            onChange={setOfferSearch}
            placeholder="Compare brands, models or vendors"
          />
          <div className="candidate-list">
            {candidates.length ? (
              candidates.map((r) => (
                <article className="candidate" key={r.id}>
                  <div>
                    <div className="candidate-title">
                      <strong>{r.description}</strong>
                      <Badge tone={isStale(r) ? '' : 'blue'}>
                        {isStale(r) ? 'Expired' : `Valid to ${dateLabel(r.validUntil)}`}
                      </Badge>
                    </div>
                    <p>
                      <strong>{productLabel(r)}</strong>
                    </p>
                    <p>{r.specification}</p>
                    {matching.brand &&
                      matching.brand.toLowerCase() !== (r.brand ?? '').toLowerCase() && (
                        <p className="small-text">
                          Different or unspecified brand. Confirm this substitution meets the client
                          specification.
                        </p>
                      )}
                    <p>
                      {workspace.vendors.find((v) => v.id === r.vendorId)?.name ??
                        'Internal source'}{' '}
                      / {r.location}
                    </p>
                    <small>
                      {r.sourceRef} / {r.notes}
                    </small>
                    {r.document && (
                      <details>
                        <summary>Imported source evidence</summary>
                        <p>
                          {r.document.filename} · {r.document.location}
                        </p>
                        <p>{r.document.excerpt}</p>
                        <p>
                          Quoted {r.document.quotedRate} / {r.document.quotedUnit};{' '}
                          {r.document.taxBasis}; discount {r.document.discount}%;{' '}
                          {r.document.unitsPerQuote} BOQ units per quoted unit.
                        </p>
                      </details>
                    )}
                    {r.demo && (
                      <div>
                        <Badge>Illustrative rate</Badge>
                      </div>
                    )}
                  </div>
                  <div className="candidate-price">
                    <strong>{money(r.cost, 2)}</strong>
                    <span>per {r.unit}, excluding GST</span>
                    <small>
                      Selling:{' '}
                      {money(sellingRate({ ...matching, cost: r.cost }, project.markup)!, 2)} /{' '}
                      {r.unit}
                    </small>
                    <button
                      className="button secondary small"
                      disabled={!confirmed || isStale(r)}
                      onClick={() => {
                        try {
                          updateItem(applyRate(matching, r));
                          setMatching(null);
                          notify('Rate applied. Review the item before approving.');
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      Apply rate
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <Empty
                title="No compatible rates yet"
                text="Record a vendor quotation in the rate library, or enter a manual estimate."
              />
            )}
          </div>
          <div className="form-footer">
            <button
              className="button secondary"
              onClick={() => {
                setQuoting(matching);
                setMatching(null);
              }}
            >
              Record another offer
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setEdit(matching);
                setMatching(null);
              }}
            >
              Enter cost manually
            </button>
            <button
              className="button primary"
              onClick={() => {
                setMatching(null);
                onEnquire();
              }}
            >
              Prepare enquiry
            </button>
          </div>
        </Modal>
      )}
      {pricing && (
        <Modal
          title="Project pricing"
          subtitle="These settings apply to every line in this BOQ."
          onClose={() => setPricing(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              onUpdate({
                ...project,
                markup: Number(d.get('markup')),
                gst: Number(d.get('gst')),
                stage: 'Draft',
                items: project.items.map((i) => ({ ...i, reviewed: false })),
              });
              setPricing(false);
              notify('Pricing updated. Review the revised selling rates.');
            }}
          >
            <div className="form-grid">
              <Field label="Markup on cost (%)">
                <input
                  name="markup"
                  type="number"
                  min="0"
                  max="500"
                  step="0.1"
                  defaultValue={project.markup}
                  required
                />
              </Field>
              <Field label="GST on selling subtotal (%)">
                <input
                  name="gst"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={project.gst}
                  required
                />
              </Field>
            </div>
            <p className="notice">
              V1 uses one project-wide tax rate. Mixed tax rates and input-tax treatment need
              separate accounting review.
            </p>
            <div className="form-footer">
              <button className="button primary">Save pricing</button>
            </div>
          </form>
        </Modal>
      )}
      {documentImport && (
        <VendorDocumentDialog
          workspace={workspace}
          projectId={project.id}
          onSave={onAddRate}
          onClose={() => setDocumentImport(false)}
        />
      )}
      {exporting && (
        <ExportDialog
          project={project}
          vendors={workspace.vendors}
          onClose={() => setExporting(false)}
          notify={notify}
        />
      )}
      {deleting && (
        <Modal
          title="Remove this item?"
          subtitle={deleting.description}
          onClose={() => setDeleting(null)}
        >
          <p>This removes the item from this project's BOQ. The rate library is retained.</p>
          {project.workbookId && (
            <p className="notice">
              Removing this item disables filling the original workbook for the entire project. You
              can still export a new client quotation or internal costing workbook.
            </p>
          )}
          <div className="form-footer">
            <button className="button secondary" onClick={() => setDeleting(null)}>
              Keep item
            </button>
            <button
              className="button danger"
              onClick={() => {
                onUpdate({
                  ...project,
                  stage: 'Draft',
                  workbookId: undefined,
                  items: project.items.filter((i) => i.id !== deleting.id),
                });
                setDeleting(null);
                notify('Item removed');
              }}
            >
              Remove item
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function MobileBoqItem({
  item,
  markup,
  source,
  onMatch,
  onEdit,
  onDelete,
  onReview,
}: {
  item: Item;
  markup: number;
  source: string;
  onMatch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReview: () => void;
}) {
  const rate = sellingRate(item, markup);
  return (
    <article className="mobile-boq-item">
      <div className="mobile-item-heading">
        <button className="item-title" onClick={onEdit}>
          {item.description}
        </button>
        <button className="icon-button" aria-label={`Edit ${item.description}`} onClick={onEdit}>
          <Icon name="edit" size={16} />
        </button>
      </div>
      <p>
        {item.specification ||
          (item.context?.length
            ? 'Inherited specification · edit item to review'
            : 'Specification not provided')}
      </p>
      <div className="mobile-item-values">
        <div>
          <small>Quantity</small>
          <strong>
            {quantityLabel(item)} <span>{item.unit}</span>
          </strong>
        </div>
        <div>
          <small>Unit cost</small>
          <button className={`rate-value ${item.cost === null ? 'missing' : ''}`} onClick={onMatch}>
            {item.cost === null ? 'Find rate' : money(item.cost, 2)}
          </button>
        </div>
        <div>
          <small>Selling amount</small>
          <strong>
            {lineAmount(item, markup) === null
              ? item.quantityKind === 'rate-only'
                ? 'Rate only'
                : 'Incomplete'
              : money(lineAmount(item, markup)!, 2)}
          </strong>
        </div>
      </div>
      <div className="mobile-item-footer">
        <span>
          {item.category} / {source}
        </span>
        <button
          className={`review-button ${item.reviewed ? 'reviewed' : ''}`}
          disabled={
            item.cost === null || (item.quantity === null && item.quantityKind !== 'rate-only')
          }
          onClick={onReview}
        >
          {item.cost === null ? 'Unpriced' : item.reviewed ? 'Reviewed' : 'Review'}
        </button>
        <button
          className="icon-button"
          aria-label={`Delete ${item.description}`}
          onClick={onDelete}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>
    </article>
  );
}
