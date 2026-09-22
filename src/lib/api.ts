import type { Workspace } from './types';
export let remote: {
  user: { id: string; email: string; company: string };
  workspace: Workspace;
  revision: number;
} | null = null;
export function setRemote(value: typeof remote) {
  remote = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'X-Nivo-Request': '1',
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = 'The server could not complete this request.';
    try {
      message = (await response.json()).error || message;
    } catch {}
    throw new ApiError(message, response.status);
  }
  return response.json();
}
export async function uploadWorkbook(id: string, bytes: ArrayBuffer) {
  const r = await fetch(`/api/files/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Nivo-Request': '1' },
    body: bytes,
  });
  if (!r.ok) throw new Error('The original workbook could not be saved to your studio.');
}
export async function fetchWorkbook(id: string) {
  const r = await fetch(`/api/files/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error('The original workbook could not be retrieved.');
  return r.arrayBuffer();
}
let workspaceFlush: () => Promise<void> = async () => {};
export function registerWorkspaceFlush(fn: () => Promise<void>) {
  workspaceFlush = fn;
}
export function flushWorkspace() {
  return workspaceFlush();
}
