import { remote, fetchWorkbook, uploadWorkbook } from './api';
import { get, set } from 'idb-keyval';
import type { Workspace } from './types';
import { validateWorkspace } from './storage';
import { downloadBlob, workbookKey } from './spreadsheet';
export async function exportBackup(workspace: Workspace) {
  const workbooks: Record<string, string> = {};
  for (const p of workspace.projects) {
    if (!p.workbookId) continue;
    const bytes = remote
      ? await fetchWorkbook(p.workbookId)
      : await get<ArrayBuffer>(workbookKey(p.workbookId));
    if (!bytes) continue;
    let binary = '';
    for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
    workbooks[p.workbookId] = btoa(binary);
  }
  downloadBlob(
    JSON.stringify({ format: 'nivo-backup-v1', workspace, workbooks }, null, 2),
    `Nivo-backup-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json',
  );
}
export async function readBackup(file: File) {
  if (file.size > 50 * 1024 * 1024) throw new Error('Backup is larger than the 50 MB pilot limit.');
  const data = JSON.parse(await file.text());
  if (
    data.format !== 'nivo-backup-v1' ||
    !validateWorkspace(data.workspace) ||
    !data.workbooks ||
    typeof data.workbooks !== 'object'
  )
    throw new Error('This is not a valid Nivo v1 backup.');
  const decoded: { key: string; bytes: ArrayBuffer }[] = [];
  for (const p of (data.workspace as Workspace).projects) {
    if (!p.workbookId || !data.workbooks[p.workbookId]) continue;
    if (typeof data.workbooks[p.workbookId] !== 'string')
      throw new Error('Invalid source workbook in backup.');
    const binary = atob(data.workbooks[p.workbookId]);
    decoded.push({
      key: workbookKey(p.workbookId),
      bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer,
    });
  }
  return { workspace: data.workspace as Workspace, decoded };
}
export async function restoreWorkbooks(decoded: { key: string; bytes: ArrayBuffer }[]) {
  for (const entry of decoded) {
    if (remote) await uploadWorkbook(entry.key.replace('nivo.workbook.', ''), entry.bytes);
    else await set(entry.key, entry.bytes);
  }
}
