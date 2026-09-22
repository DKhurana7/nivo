import { api, remote, registerWorkspaceFlush } from './api';
import { useEffect, useRef, useState } from 'react';
import { seedWorkspace } from './seed';
import type { Workspace } from './types';
import { validateWorkspace } from './validation';
export { validateWorkspace } from './validation';
export const STORAGE_KEY = 'nivo.workspace.v1';
export function useWorkspace() {
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    if (remote) return remote.workspace;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedWorkspace();
      const parsed: unknown = JSON.parse(raw);
      if (!validateWorkspace(parsed)) throw new Error();
      return parsed;
    } catch {
      return {
        version: 1,
        settings: {
          company: 'Technosmart Interiors',
          city: 'Delhi NCR',
          defaultMarkup: 20,
          defaultGst: 18,
        },
        projects: [],
        rates: [],
        vendors: [],
        enquiries: [],
      };
    }
  });
  const [canSave, setCanSave] = useState(() => {
    if (remote) return true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return !raw || validateWorkspace(JSON.parse(raw));
    } catch {
      return false;
    }
  });
  const revision = useRef(remote?.revision ?? 0);
  const chain = useRef(Promise.resolve());
  const frozen = useRef(false);
  const lastSaved = useRef(remote ? JSON.stringify(remote.workspace) : '');
  useEffect(() => {
    if (remote) {
      const data = JSON.stringify(workspace);
      if (data === lastSaved.current) return;
      const save = () => {
        const task = chain.current.then(async () => {
          if (frozen.current)
            throw new Error(
              'Workspace sync is paused. Export pending changes and reload before calling.',
            );
          if (data === lastSaved.current) return;
          try {
            const r = await api<{ revision: number }>('/workspace', {
              method: 'PUT',
              body: JSON.stringify({ workspace, revision: revision.current }),
            });
            revision.current = r.revision;
            lastSaved.current = data;
            if (remote) {
              remote.revision = r.revision;
              remote.workspace = workspace;
            }
            setError('');
          } catch (e) {
            frozen.current = true;
            setError(
              `${(e as Error).message} Your pending changes remain on this screen. Export a backup before reloading.`,
            );
            throw e;
          }
        });
        chain.current = task.catch(() => {});
        return task;
      };
      const timer = setTimeout(() => void save().catch(() => {}), 400);
      registerWorkspaceFlush(() => {
        clearTimeout(timer);
        return save();
      });
      const unload = (event: BeforeUnloadEvent) => {
        if (data !== lastSaved.current) {
          event.preventDefault();
          event.returnValue = '';
        }
      };
      window.addEventListener('beforeunload', unload);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeunload', unload);
      };
    }
    if (!canSave) {
      setError(
        'Saved workspace could not be read. It has not been overwritten. Restore a backup in Settings or explicitly start a new workspace.',
      );
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      setError('');
    } catch {
      setError(
        'Your changes could not be saved in this browser. Export a backup now from Settings.',
      );
    }
  }, [workspace, canSave]);
  return { workspace, setWorkspace, error, allowSave: () => setCanSave(true) };
}
