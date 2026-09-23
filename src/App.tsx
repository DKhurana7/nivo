import { remote } from './lib/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { withOfferIdentity } from './lib/costing';
import { useWorkspace } from './lib/storage';
import type { Page, Project } from './lib/types';
import { Icon, Modal } from './components/ui';
import { ProjectForm } from './components/forms';
import { Overview, ProjectsPage, RatesPage, VendorsPage } from './components/WorkspacePages';
import { BoqPage } from './components/BoqPage';
import { EnquiriesPage } from './components/EnquiriesPage';
import { SettingsPage } from './components/SettingsPage';

const navigation: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'Projects' },
  { id: 'boq', label: 'BOQ workbench' },
  { id: 'rates', label: 'Rate library' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'enquiries', label: 'Enquiry desk' },
];
function route(): Page {
  const hash = window.location.hash.slice(1);
  return [...navigation.map((n) => n.id), 'settings'].includes(hash) ? (hash as Page) : 'overview';
}
export default function App() {
  const { workspace: storedWorkspace, setWorkspace, error, allowSave } = useWorkspace();
  const workspace = useMemo(
    () => ({
      ...storedWorkspace,
      projects: storedWorkspace.projects.map((p) => ({
        ...p,
        items: p.items.map((i) => withOfferIdentity(i, storedWorkspace.rates)),
      })),
    }),
    [storedWorkspace],
  );
  const [page, setPage] = useState<Page>(route);
  const [selectedProject, setSelectedProject] = useState(workspace.projects[0]?.id ?? '');
  const [newProject, setNewProject] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState('');
  const [policy, setPolicy] = useState<'privacy' | 'terms' | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [smallScreen, setSmallScreen] = useState(() => matchMedia('(max-width: 760px)').matches);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia('(max-width: 760px)');
    const change = () => {
      setSmallScreen(media.matches);
      if (!media.matches) setMobile(false);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!mobile || !smallScreen) return;
    const previous = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => [
      ...(navRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []),
    ];
    controls()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [mobile, smallScreen]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = (message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 6000);
  };
  useEffect(() => {
    const handler = () => {
      setPage(route());
      setMobile(false);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
      if (e.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const navigate = (next: Page) => {
    window.location.hash = next;
    setPage(next);
    setMobile(false);
    window.scrollTo({ top: 0 });
  };
  const openProject = (id: string) => {
    setSelectedProject(id);
    navigate('boq');
  };
  const updateProject = (project: Project) =>
    setWorkspace((w) => ({
      ...w,
      projects: w.projects.map((p) => (p.id === project.id ? project : p)),
    }));
  const project = workspace.projects.find((p) => p.id === selectedProject) ?? workspace.projects[0];
  const demo =
    workspace.projects.some((p) => p.demo) ||
    workspace.vendors.some((v) => v.demo) ||
    workspace.rates.some((r) => r.demo);
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={navRef}
        className={`sidebar ${mobile ? 'is-open' : ''}`}
        inert={smallScreen && !mobile ? true : undefined}
        role={smallScreen && mobile ? 'dialog' : undefined}
        aria-modal={smallScreen && mobile ? true : undefined}
        aria-label="Main navigation"
      >
        <button className="brand" onClick={() => navigate('overview')} aria-label="Nivo overview">
          <img src="/nivo-mark.svg" alt="" />
          <span>
            nivo<span className="brand-period">.</span>
          </span>
        </button>
        <div className="studio-selector">
          <span className="studio-monogram">TS</span>
          <div>
            <strong>{workspace.settings.company}</strong>
            <small>Studio workspace</small>
          </div>
        </div>
        <nav>
          {navigation.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? 'nav-item active' : 'nav-item'}
              aria-current={page === n.id ? 'page' : undefined}
              onClick={() => navigate(n.id)}
            >
              <Icon name={n.id} />
              <span>{n.label}</span>
              {n.id === 'projects' && (
                <span className="nav-count">{workspace.projects.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-mode">
            <span className="local-square" />
            <div>
              <strong>{remote ? 'Private studio' : 'Local workspace'}</strong>
              <small>{remote ? 'Studio server connected' : 'Saved on this device'}</small>
            </div>
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Icon name="settings" />
            <span>Settings & data</span>
          </button>
          <div className="profile">
            <span>TS</span>
            <div>
              <strong>Your studio</strong>
              <small>Nivo v0.1</small>
            </div>
            <Icon name="link" size={16} />
          </div>
          <div className="policy-links">
            <button
              onClick={() => {
                setMobile(false);
                setPolicy('privacy');
              }}
            >
              Privacy
            </button>
            <button
              onClick={() => {
                setMobile(false);
                setPolicy('terms');
              }}
            >
              Terms of use
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Icon name="menu" />
            </button>
            <span className="topbar-section">
              {navigation.find((n) => n.id === page)?.label ?? 'Settings & data'}
            </span>
            <span className="topbar-divider" />
            <span className="topbar-studio">{workspace.settings.company}</span>
          </div>
          <button className="global-search" onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={17} />
            <span>Jump to anything</span>
            <kbd>⌘ K</kbd>
          </button>
        </header>
        {error && (
          <div className="storage-error" role="alert">
            {error}
            <button onClick={() => navigate('settings')}>Open settings</button>
          </div>
        )}
        {demo && (
          <div className="demo-banner">
            <span>Sample workspace</span>
            <p>
              Projects, vendors and rates are illustrative. Add your own data or start fresh in
              Settings.
            </p>
            <button onClick={() => navigate('settings')}>
              Manage data <Icon name="chevron" size={13} />
            </button>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          <motion.div
            key={page}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {page === 'overview' && (
              <Overview
                workspace={workspace}
                openProject={openProject}
                onNew={() => setNewProject(true)}
                onRates={() => navigate('rates')}
                onEnquiries={() => navigate('enquiries')}
              />
            )}
            {page === 'projects' && (
              <ProjectsPage
                workspace={workspace}
                openProject={openProject}
                onNew={() => setNewProject(true)}
              />
            )}
            {page === 'boq' && (
              <BoqPage
                workspace={workspace}
                project={project}
                onUpdate={updateProject}
                onDeleteProject={(id) => {
                  setWorkspace((w) => ({
                    ...w,
                    projects: w.projects.filter((p) => p.id !== id),
                    enquiries: w.enquiries.filter((e) => e.projectId !== id),
                  }));
                  navigate('projects');
                }}
                onSelect={setSelectedProject}
                onNew={() => setNewProject(true)}
                notify={notify}
                onEnquire={() => navigate('enquiries')}
                onAddRate={(rate) => setWorkspace((w) => ({ ...w, rates: [rate, ...w.rates] }))}
              />
            )}
            {page === 'rates' && (
              <RatesPage
                workspace={workspace}
                onAdd={(rate) => setWorkspace((w) => ({ ...w, rates: [rate, ...w.rates] }))}
                notify={notify}
              />
            )}
            {page === 'vendors' && (
              <VendorsPage
                workspace={workspace}
                onSave={(vendor) =>
                  setWorkspace((w) => ({
                    ...w,
                    vendors: w.vendors.some((v) => v.id === vendor.id)
                      ? w.vendors.map((v) => (v.id === vendor.id ? vendor : v))
                      : [...w.vendors, vendor],
                  }))
                }
                notify={notify}
              />
            )}
            {page === 'enquiries' && (
              <EnquiriesPage
                workspace={workspace}
                selectedProject={project?.id ?? ''}
                onSave={(enquiry) =>
                  setWorkspace((w) => ({
                    ...w,
                    enquiries: w.enquiries.some((e) => e.id === enquiry.id)
                      ? w.enquiries.map((e) => (e.id === enquiry.id ? enquiry : e))
                      : [enquiry, ...w.enquiries],
                  }))
                }
                onRate={(rate, enquiry) =>
                  setWorkspace((w) => ({
                    ...w,
                    rates: [rate, ...w.rates],
                    enquiries: w.enquiries.map((e) => (e.id === enquiry.id ? enquiry : e)),
                  }))
                }
                notify={notify}
              />
            )}
            {page === 'settings' && (
              <SettingsPage
                workspace={workspace}
                onSave={(w, recover) => {
                  if (recover) allowSave();
                  setWorkspace(w);
                }}
                notify={notify}
              />
            )}
          </motion.div>
        </main>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Icon name="info" size={18} />
            <span>{toast}</span>
            <button aria-label="Dismiss notification" onClick={() => setToast('')}>
              <Icon name="close" size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {newProject && (
        <ProjectForm
          settings={workspace.settings}
          onClose={() => setNewProject(false)}
          onSave={(p) => {
            setWorkspace((w) => ({ ...w, projects: [p, ...w.projects] }));
            setNewProject(false);
            openProject(p.id);
            notify('Project created');
          }}
        />
      )}
      {searchOpen && (
        <Modal
          title="Find your next step"
          subtitle="Search projects, vendors, materials or a workspace page."
          onClose={() => {
            setSearchOpen(false);
            setQuery('');
          }}
        >
          <label className="search command-search">
            <Icon name="search" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search workspace"
              placeholder="Type a name, material or page…"
            />
          </label>
          <div className="command-results">
            {navigation
              .filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    navigate(n.id);
                    setSearchOpen(false);
                    setQuery('');
                  }}
                >
                  <Icon name={n.id} />
                  <span>{n.label}</span>
                  <small>Page</small>
                </button>
              ))}
            {workspace.projects
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    openProject(p.id);
                    setSearchOpen(false);
                    setQuery('');
                  }}
                >
                  <Icon name="projects" />
                  <span>{p.name}</span>
                  <small>Project</small>
                </button>
              ))}
            {query &&
              workspace.rates
                .filter((r) =>
                  `${r.description} ${r.brand ?? ''} ${r.model ?? ''} ${workspace.vendors.find((v) => v.id === r.vendorId)?.name ?? ''}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .slice(0, 5)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      navigate('rates');
                      setSearchOpen(false);
                      setQuery('');
                    }}
                  >
                    <Icon name="rates" />
                    <span>{r.description}</span>
                    <small>Rate library</small>
                  </button>
                ))}
            {query &&
              workspace.vendors
                .filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 5)
                .map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      navigate('vendors');
                      setSearchOpen(false);
                      setQuery('');
                    }}
                  >
                    <Icon name="vendors" />
                    <span>{v.name}</span>
                    <small>Vendor</small>
                  </button>
                ))}
          </div>
        </Modal>
      )}
      {policy && (
        <Modal
          title={policy === 'privacy' ? 'Privacy in Nivo' : 'Terms of use for this pilot'}
          onClose={() => setPolicy(null)}
        >
          <div className="policy-copy">
            {policy === 'privacy' ? (
              <>
                <p>
                  Local demo mode stores projects, prices, vendor details and notes in this browser.
                  Signed-in studio mode saves them on your configured server, with an account
                  session cookie. Original workbooks are private to your studio account.
                </p>
                <p>
                  Voice sessions transmit audio through your configured LiveKit server and
                  speech/model providers. The local model profile processes speech on your own
                  hardware. Hosted providers receive audio or text according to the chosen
                  configuration. Transcripts and quotation drafts are stored on the studio server;
                  raw call recordings are not enabled.
                </p>
                <p>
                  Fonts are bundled locally and the app adds no analytics. An automated assistant
                  identifies itself and requests permission before collecting quotation details.
                  Review your deployment and provider arrangements before inviting real vendors.
                </p>
                <p>
                  Backups contain confidential business data. Resetting workspace records does not
                  remove retained workbook files, call transcripts or server audit records. The
                  server operator manages deletion and retention; do not use the reset button as an
                  account-erasure request.
                </p>
              </>
            ) : (
              <>
                <p>
                  This is a private beta built for Technosmart. Each studio account has a separate
                  workspace. The working name and brand are provisional.
                </p>
                <p>
                  You remain responsible for verifying specifications, quotation validity,
                  calculations, taxes and exported files before issuing a BOQ or making a purchase.
                  Sample rates are illustrations and must not be treated as live market prices.
                </p>
                <p>
                  Use only documents and supplier information you are authorised to handle. Browser
                  voice tests and enabled SIP calls can transmit audio to your configured services.
                  Nivo does not place purchase orders.
                </p>
                <p>
                  Commercial subscription terms, support commitments and a production privacy policy
                  will be defined before external customers are onboarded.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
