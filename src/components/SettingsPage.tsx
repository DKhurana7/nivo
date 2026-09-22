import { api, remote, flushWorkspace } from '../lib/api';
import { useState } from 'react';
import type { Workspace } from '../lib/types';
import { exportBackup, readBackup, restoreWorkbooks } from '../lib/backup';
import { Badge, Field, Icon, Modal } from './ui';

export function SettingsPage({
  workspace,
  onSave,
  notify,
}: {
  workspace: Workspace;
  onSave: (w: Workspace, recover?: boolean) => void;
  notify: (s: string) => void;
}) {
  const [reset, setReset] = useState(false);
  const [restore, setRestore] = useState<Awaited<ReturnType<typeof readBackup>> | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Make room for your workflow.</h1>
          <p>Studio defaults, workspace data and a clear view of what is connected.</p>
        </div>
      </div>
      <div className="brief-actions">
        {remote ? (
          <button
            className="button secondary"
            onClick={async () => {
              await flushWorkspace();
              await api('/logout', { method: 'POST' });
              location.reload();
            }}
          >
            Sign out of studio
          </button>
        ) : (
          <button className="button secondary" onClick={() => location.reload()}>
            Connect to studio server
          </button>
        )}
      </div>
      <div className="settings-layout">
        <section className="settings-section">
          <h2>Studio details</h2>
          <p>Defaults apply to new projects. Existing BOQs keep their own pricing settings.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              onSave({
                ...workspace,
                settings: {
                  company: String(d.get('company')).trim(),
                  city: String(d.get('city')).trim(),
                  defaultMarkup: Number(d.get('markup')),
                  defaultGst: Number(d.get('gst')),
                },
              });
              notify('Studio settings saved');
            }}
          >
            <Field label="Studio name">
              <input name="company" required defaultValue={workspace.settings.company} />
            </Field>
            <Field label="Default location">
              <input name="city" required defaultValue={workspace.settings.city} />
            </Field>
            <div className="form-grid">
              <Field label="Default markup on cost (%)">
                <input
                  name="markup"
                  type="number"
                  required
                  min="0"
                  max="500"
                  step="0.1"
                  defaultValue={workspace.settings.defaultMarkup}
                />
              </Field>
              <Field label="Default GST (%)">
                <input
                  name="gst"
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={workspace.settings.defaultGst}
                />
              </Field>
            </div>
            <button className="button primary">Save studio details</button>
          </form>
        </section>
        <section className="settings-section">
          <h2>Your workspace data</h2>
          <p>
            {remote
              ? `Signed in as ${remote.user.email}. Saved to your studio server. Export regular backups.`
              : 'Saved on this browser and device. Export backups before clearing browser data or switching devices.'}
          </p>
          <div className="data-counts">
            <span>
              <strong>{workspace.projects.length}</strong> projects
            </span>
            <span>
              <strong>{workspace.rates.length}</strong> rates
            </span>
            <span>
              <strong>{workspace.vendors.length}</strong> vendors
            </span>
          </div>
          <button
            className="button secondary full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await exportBackup(workspace);
                notify('Workspace backup exported');
              } catch {
                notify('Backup failed. Check browser storage access and try again.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="download" />
            Export full backup
          </button>
          <label className="button secondary full file-button">
            <Icon name="upload" />
            Restore a backup
            <input
              type="file"
              accept=".json"
              aria-label="Restore a backup"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  setRestore(await readBackup(file));
                } catch (err) {
                  notify(err instanceof Error ? err.message : 'Could not read backup');
                } finally {
                  setBusy(false);
                  e.target.value = '';
                }
              }}
            />
          </label>
          <button className="text-button reset-button" onClick={() => setReset(true)}>
            Start an empty workspace
          </button>
          <p className="small-text muted">
            Backups include available original Excel workbooks. Treat backup files as confidential
            business information.
          </p>
        </section>
      </div>
      <section className="settings-section integration-section">
        <div>
          <h2>Voice & connected services</h2>
          <p>
            {remote
              ? 'Studio server connected. Open an enquiry to test the voice pipeline.'
              : 'Sign in to a configured studio server to use voice calling.'}
          </p>
        </div>
        <Badge>{remote ? 'Studio connected' : 'Local mode'}</Badge>
        <div className="integration-copy">
          <Icon name="phone" size={26} />
          <p>
            Browser voice tests use the configured self-hosted LiveKit worker. Phone calling also
            requires a SIP trunk and enabled outbound calls. Transcripts and extracted drafts remain
            subject to human review. Configure provider credentials on the server; never paste them
            into notes.
          </p>
        </div>
      </section>
      {reset && (
        <Modal
          title="Start an empty workspace?"
          subtitle="Export a backup first if you want to keep the current data."
          onClose={() => setReset(false)}
        >
          <p>
            This removes projects, rates, vendors and enquiries from the active workspace. Your
            studio settings are kept.
          </p>
          <div className="form-footer">
            <button className="button secondary" onClick={() => setReset(false)}>
              Keep my workspace
            </button>
            <button
              className="button danger"
              onClick={() => {
                onSave(
                  {
                    version: 1,
                    settings: workspace.settings,
                    projects: [],
                    vendors: [],
                    rates: [],
                    enquiries: [],
                  },
                  true,
                );
                setReset(false);
                notify('Empty workspace ready');
              }}
            >
              Start empty
            </button>
          </div>
        </Modal>
      )}
      {restore && (
        <Modal
          title="Restore this backup?"
          subtitle="This replaces the active workspace. Original workbooks will be restored alongside it."
          onClose={() => setRestore(null)}
        >
          <p>
            The backup contains {restore.workspace.projects.length} projects,{' '}
            {restore.workspace.vendors.length} vendors and {restore.workspace.rates.length} rates.
          </p>
          <div className="form-footer">
            <button className="button secondary" disabled={busy} onClick={() => setRestore(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await restoreWorkbooks(restore.decoded);
                  onSave(restore.workspace, true);
                  setRestore(null);
                  notify('Workspace restored');
                } catch {
                  notify(
                    'Restore failed. Check available browser storage. Your active workspace was not replaced.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Restore workspace
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
