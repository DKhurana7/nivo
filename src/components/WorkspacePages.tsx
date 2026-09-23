import { useState } from 'react';
import type { Project, Rate, Vendor, Workspace } from '../lib/types';
import { categories } from '../lib/types';
import { compactMoney, dateLabel, isStale, money, totals } from '../lib/costing';
import { Badge, Empty, Icon, Modal, PlanDrawing, Search } from './ui';
import { RateForm, VendorForm } from './forms';

export function Overview({
  workspace,
  openProject,
  onNew,
  onRates,
  onEnquiries,
}: {
  workspace: Workspace;
  openProject: (id: string) => void;
  onNew: () => void;
  onRates: () => void;
  onEnquiries: () => void;
}) {
  const [query, setQuery] = useState('');
  const projects = workspace.projects.filter((p) =>
    `${p.name} ${p.client} ${p.location}`.toLowerCase().includes(query.toLowerCase()),
  );
  const missing = workspace.projects.reduce((sum, p) => sum + totals(p).missing, 0);
  const review = workspace.projects.reduce(
    (sum, p) => sum + p.items.filter((i) => i.cost !== null && !i.reviewed).length,
    0,
  );
  const stale = workspace.rates.filter((r) => isStale(r)).length;
  const value = workspace.projects.reduce((sum, p) => sum + totals(p).selling, 0);
  const urgent = workspace.projects
    .filter((p) => p.stage !== 'Approved' && p.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="date-line">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
          <h1>Your studio, in focus.</h1>
          <p>From the first specification to the final number.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Icon name="plus" size={18} />
          New project
        </button>
      </div>
      <section className="studio-ledger" aria-label="Workspace overview">
        <div>
          <span>Projects in progress</span>
          <strong>
            {workspace.projects
              .filter((p) => p.stage !== 'Approved')
              .length.toString()
              .padStart(2, '0')}
          </strong>
          <small>{workspace.projects.length} total projects</small>
        </div>
        <div>
          <span>Estimated selling value</span>
          <strong>{compactMoney(value)}</strong>
          <small>Priced lines, before GST</small>
        </div>
        <div>
          <span>Items to price</span>
          <strong>{missing.toString().padStart(2, '0')}</strong>
          <small>Across your BOQs</small>
        </div>
        <div>
          <span>Vendor relationships</span>
          <strong>{workspace.vendors.length.toString().padStart(2, '0')}</strong>
          <small>{workspace.rates.length} saved rate references</small>
        </div>
      </section>
      <div className="overview-layout">
        <section className="project-register">
          <div className="section-heading">
            <div>
              <h2>Project register</h2>
              <p>The work taking shape in your studio.</p>
            </div>
            <span className="count-label">{workspace.projects.length} projects</span>
          </div>
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Find a project, client or location"
          />
          <div className="project-list">
            {projects.length ? (
              projects.map((p, index) => (
                <ProjectRow key={p.id} project={p} index={index} onOpen={() => openProject(p.id)} />
              ))
            ) : (
              <Empty
                title={query ? 'No projects found' : 'A clear desk. A new beginning.'}
                text={
                  query
                    ? 'Try searching a different name or location.'
                    : 'Create your first project to start building a BOQ.'
                }
              >
                {!query && (
                  <button className="button secondary" onClick={onNew}>
                    Create a project
                  </button>
                )}
              </Empty>
            )}
          </div>
        </section>
        <aside className="studio-aside">
          <section className="attention">
            <div className="section-heading">
              <h2>On your desk</h2>
              <span className="attention-number">{missing + review + stale}</span>
            </div>
            <p className="aside-intro">Small decisions that move things forward.</p>
            <button
              className="attention-row"
              onClick={() => {
                const p = workspace.projects.find((p) => totals(p).missing);
                if (p) openProject(p.id);
                else onNew();
              }}
            >
              <span className="attention-symbol">
                <Icon name="rates" />
              </span>
              <span>
                <strong>{missing} items need a rate</strong>
                <small>Match a source or request a quote</small>
              </span>
              <Icon name="chevron" size={15} />
            </button>
            <button
              className="attention-row"
              onClick={() => {
                const p = workspace.projects.find((p) =>
                  p.items.some((i) => i.cost !== null && !i.reviewed),
                );
                if (p) openProject(p.id);
                else onRates();
              }}
            >
              <span className="attention-symbol">
                <Icon name="boq" />
              </span>
              <span>
                <strong>{review} prices to review</strong>
                <small>Check specifications and inclusions</small>
              </span>
              <Icon name="chevron" size={15} />
            </button>
            <button className="attention-row" onClick={onRates}>
              <span className="attention-symbol">
                <Icon name="clock" />
              </span>
              <span>
                <strong>{stale} expired rate references</strong>
                <small>Refresh before using again</small>
              </span>
              <Icon name="chevron" size={15} />
            </button>
          </section>
          <section className="voice-note">
            <div className="voice-note-symbol">
              <Icon name="phone" size={25} />
            </div>
            <Badge>Vendor enquiries</Badge>
            <h3>The next quote starts with a clear brief.</h3>
            <p>
              Bring your specifications together. Keep vendor replies connected to the right BOQ.
            </p>
            <button className="text-button" onClick={onEnquiries}>
              Open enquiry desk <Icon name="arrow" size={16} />
            </button>
            <div className="voice-availability">Check voice readiness in the enquiry desk</div>
          </section>
          {urgent && (
            <section className="deadline-note">
              <Icon name="clock" />
              <div>
                <small>Next target date</small>
                <strong>{dateLabel(urgent.dueDate)}</strong>
                <button onClick={() => openProject(urgent.id)}>{urgent.name}</button>
              </div>
            </section>
          )}
        </aside>
      </div>
      <div className="workspace-footnote">
        <span>Built around the way your studio works.</span>
        <span>INR / {workspace.settings.city}</span>
      </div>
    </>
  );
}
export function ProjectRow({
  project: p,
  index,
  onOpen,
}: {
  project: Project;
  index: number;
  onOpen: () => void;
}) {
  const t = totals(p);
  const complete = p.items.length ? Math.round((t.reviewed / p.items.length) * 100) : 0;
  return (
    <button className="project-row" onClick={onOpen}>
      <div className="project-art">
        <PlanDrawing variant={index} />
        <span>{p.kind}</span>
      </div>
      <div className="project-details">
        <div className="project-title-row">
          <h3>{p.name}</h3>
          <Icon name="arrow" size={18} />
        </div>
        <p>{p.location}</p>
        <div className="project-meta">
          <Badge tone={p.stage === 'Approved' ? 'blue' : ''}>{p.stage}</Badge>
          <span>{p.items.length} items</span>
          <span>{p.dueDate ? `Due ${dateLabel(p.dueDate)}` : 'Due date not set'}</span>
        </div>
        <div className="project-row-bottom">
          <div>
            <strong>{compactMoney(t.selling)}</strong>
            <small>{t.missing ? 'Partial estimate' : 'Before GST'}</small>
          </div>
          <div className="project-progress">
            <span>{complete}% reviewed</span>
            <div className="progress-track">
              <i style={{ width: `${complete}%` }} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
export function ProjectsPage({
  workspace,
  openProject,
  onNew,
}: {
  workspace: Workspace;
  openProject: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('All projects');
  const projects = workspace.projects.filter(
    (p) =>
      `${p.name} ${p.client} ${p.location}`.toLowerCase().includes(query.toLowerCase()) &&
      (stage === 'All projects' || p.stage === stage),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Projects</h1>
          <p>A working record of every space you bring to life.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Icon name="plus" />
          New project
        </button>
      </div>
      <div className="filter-row standalone">
        <Search value={query} onChange={setQuery} placeholder="Search projects" />
        <select
          aria-label="Filter project stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          {['All projects', 'Draft', 'In review', 'Approved'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="projects-wide">
        {projects.map((p, i) => (
          <ProjectRow key={p.id} project={p} index={i} onOpen={() => openProject(p.id)} />
        ))}
        {!projects.length && (
          <Empty
            title="No projects here yet"
            text="Create a project or change your search filters."
          >
            <button className="button secondary" onClick={onNew}>
              New project
            </button>
          </Empty>
        )}
      </div>
    </>
  );
}
export function RatesPage({
  workspace,
  onAdd,
  notify,
}: {
  workspace: Workspace;
  onAdd: (r: Rate) => void;
  notify: (s: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Rate | null>(null);
  const rates = workspace.rates.filter(
    (r) =>
      `${r.description} ${r.specification} ${r.sourceRef}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === 'All categories' || r.category === category),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Rate library</h1>
          <p>Your own pricing knowledge, with the evidence attached.</p>
        </div>
        <button className="button primary" onClick={() => setAdding(true)}>
          <Icon name="plus" />
          Record quotation
        </button>
      </div>
      <div className="library-intro">
        <div>
          <span className="large-number">{workspace.rates.length.toString().padStart(2, '0')}</span>
          <span>rate references</span>
        </div>
        <p>
          Every rate has a context. Check the specification, source, date and delivery location
          before using it in a BOQ.
        </p>
        <Badge>{workspace.rates.filter((r) => isStale(r)).length} need refreshing</Badge>
      </div>
      <div className="workbench">
        <div className="filter-row">
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Search materials, specifications or sources"
          />
          <select
            aria-label="Filter rate category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {['All categories', ...categories].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table className="rates-table">
            <thead>
              <tr>
                <th>Material or work item</th>
                <th>Source</th>
                <th>Location</th>
                <th>Validity</th>
                <th className="numeric">Unit cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button className="item-title" onClick={() => setDetail(r)}>
                      {r.description}
                    </button>
                    <p className="cell-subtitle">{r.specification}</p>
                    <span className="item-meta">
                      {r.category}
                      {r.demo ? ' / Illustrative rate' : ''}
                    </span>
                  </td>
                  <td>
                    <span>
                      {workspace.vendors.find((v) => v.id === r.vendorId)?.name ??
                        'Internal reference'}
                    </span>
                    <p className="cell-subtitle">{r.source}</p>
                  </td>
                  <td>{r.location}</td>
                  <td>
                    <Badge tone={isStale(r) ? '' : 'blue'}>
                      {isStale(r) ? 'Expired' : `Until ${dateLabel(r.validUntil)}`}
                    </Badge>
                  </td>
                  <td className="numeric">
                    <strong>{money(r.cost, 2)}</strong>
                    <p className="cell-subtitle">per {r.unit}</p>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => setDetail(r)}
                      aria-label={`View ${r.description}`}
                    >
                      <Icon name="chevron" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rates.length && (
          <Empty
            title="No rate references found"
            text="Record a quotation to make your next BOQ easier to price."
          />
        )}
        <div className="table-footer">
          <span>{rates.length} references</span>
          <span>Purchase costs, before GST</span>
        </div>
      </div>
      {adding && (
        <RateForm
          vendors={workspace.vendors}
          onClose={() => setAdding(false)}
          onSave={(r) => {
            onAdd(r);
            setAdding(false);
            notify('Quotation saved to your rate library');
          }}
        />
      )}{' '}
      {detail && (
        <Modal title={detail.description} subtitle="Rate evidence" onClose={() => setDetail(null)}>
          <div className="rate-detail-price">
            {money(detail.cost, 2)}
            <small> / {detail.unit}, before GST</small>
          </div>
          <dl className="detail-list">
            <dt>Specification</dt>
            <dd>{detail.specification}</dd>
            <dt>Source</dt>
            <dd>
              {detail.source} / {detail.sourceRef}
            </dd>
            <dt>Vendor</dt>
            <dd>
              {workspace.vendors.find((v) => v.id === detail.vendorId)?.name ??
                'Internal reference'}
            </dd>
            <dt>Location</dt>
            <dd>{detail.location}</dd>
            <dt>Quoted</dt>
            <dd>{dateLabel(detail.quotedAt)}</dd>
            <dt>Valid until</dt>
            <dd>
              {dateLabel(detail.validUntil)} {isStale(detail) && '(expired)'}
            </dd>
            <dt>Terms</dt>
            <dd>{detail.notes}</dd>
          </dl>
          {detail.demo && (
            <p className="notice">
              This is illustrative sample data, not a current market quotation.
            </p>
          )}
          <p className="muted">
            Apply this rate from the relevant BOQ line so you can compare its specification first.
          </p>
        </Modal>
      )}
    </>
  );
}
export function VendorsPage({
  workspace,
  onSave,
  notify,
}: {
  workspace: Workspace;
  onSave: (v: Vendor) => void;
  notify: (s: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Vendor | 'new' | null>(null);
  const [detail, setDetail] = useState<Vendor | null>(null);
  const vendors = workspace.vendors.filter((v) =>
    `${v.name} ${v.contact} ${v.category} ${v.location}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your people, your vendors.</h1>
          <p>Keep the relationships behind your projects within reach.</p>
        </div>
        <button className="button primary" onClick={() => setEditing('new')}>
          <Icon name="plus" />
          Add vendor
        </button>
      </div>
      <div className="filter-row standalone">
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Search vendors, trades or locations"
        />
        <span className="count-label">{vendors.length} vendors</span>
      </div>
      <div className="vendor-list">
        {vendors.map((v) => (
          <button key={v.id} className="vendor-row" onClick={() => setDetail(v)}>
            <span className="vendor-monogram">
              {v.name
                .split(' ')
                .filter((s) => s !== '&')
                .slice(0, 2)
                .map((s) => s[0])
                .join('')}
            </span>
            <div className="vendor-name">
              <h3>{v.name}</h3>
              <p>
                {v.contact || 'No contact added'} / {v.location || 'Location not added'}
              </p>
            </div>
            <Badge>{v.category}</Badge>
            <div className="vendor-rate-count">
              <strong>{workspace.rates.filter((r) => r.vendorId === v.id).length}</strong>
              <span>rate references</span>
            </div>
            <Icon name="chevron" size={18} />
          </button>
        ))}
      </div>
      {!vendors.length && (
        <Empty
          title="Build your supplier directory"
          text="Add the vendors you already trust. Their quotations will stay connected to their profiles."
        >
          <button className="button secondary" onClick={() => setEditing('new')}>
            Add a vendor
          </button>
        </Empty>
      )}
      {editing && (
        <VendorForm
          vendor={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            onSave(v);
            setEditing(null);
            notify('Vendor saved');
          }}
        />
      )}{' '}
      {detail && (
        <Modal title={detail.name} subtitle={detail.category} onClose={() => setDetail(null)}>
          <dl className="detail-list">
            <dt>Contact</dt>
            <dd>{detail.contact || 'Not added'}</dd>
            <dt>Phone</dt>
            <dd>{detail.phone || 'Not added'}</dd>
            <dt>Email</dt>
            <dd>{detail.email || 'Not added'}</dd>
            <dt>Location</dt>
            <dd>{detail.location || 'Not added'}</dd>
            <dt>Notes</dt>
            <dd>{detail.notes || 'No notes yet'}</dd>
          </dl>
          {detail.demo && (
            <p className="notice">
              Sample vendor. Add your real supplier details before preparing an enquiry.
            </p>
          )}
          <div className="form-footer">
            <button
              className="button primary"
              onClick={() => {
                setEditing(detail);
                setDetail(null);
              }}
            >
              Edit vendor
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
