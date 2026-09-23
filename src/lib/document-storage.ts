import { get, set } from 'idb-keyval';
import { remote, uploadWorkbook, fetchWorkbook } from './api';
import { downloadBlob, workbookKey } from './spreadsheet';
import { hashDocument, type VendorDocument } from './vendor-document';
import type { Rate } from './types';

export async function retainVendorDocument(document: VendorDocument) {
  const id = `quote-${document.hash}`;
  if (remote) await uploadWorkbook(id, document.bytes);
  else await set(workbookKey(id), document.bytes);
  return id;
}
export async function downloadRateDocument(rate: Rate) {
  const d = rate.document;
  if (!d) throw new Error('No document attached.');
  const bytes = remote
    ? await fetchWorkbook(d.fileId)
    : await get<ArrayBuffer>(workbookKey(d.fileId));
  if (!bytes)
    throw new Error(
      'Original quotation file is missing. Restore a full backup containing the document.',
    );
  if ((await hashDocument(bytes)) !== d.sha256)
    throw new Error('The stored quotation no longer matches its recorded fingerprint.');
  downloadBlob(
    bytes,
    d.filename,
    /\.pdf$/i.test(d.filename)
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
