import { api, remote } from './api';
import type { Page } from './types';
export type TourOutcome = 'skipped' | 'completed';
export interface TourStep {
  id: string;
  chapter: string;
  page: Page;
  target: string;
  title: string;
  text: string;
}
const steps = (
  chapter: string,
  page: Page,
  entries: [string, string, string, string][],
): TourStep[] =>
  entries.map(([id, target, title, text]) => ({ id, chapter, page, target, title, text }));
export const tourSteps: TourStep[] = [
  ...steps('Getting around', 'overview', [
    [
      'welcome',
      '.topbar',
      'Welcome to Nivo',
      'This walkthrough explains the complete platform, from your first project to a filled client Excel. Next and Back move through features; Jump to feature opens any topic. Skip tour or Escape closes it. It appears automatically only once per studio account.',
    ],
    [
      'navigation',
      '.topbar',
      'Move around your studio',
      'The navigation connects Overview, Projects, BOQ workbench, Rate library, Vendors, Enquiry desk and Settings & data. On a phone, open the menu at the top left. The tour changes pages to show where features live without editing anything.',
    ],
    [
      'search',
      '.global-search',
      'Find a page, project, vendor or rate',
      'Jump to anything searches across workspace pages, project names, vendors and material/brand/model rate descriptions. Open it with this button or Ctrl/⌘ K. Select a result to visit its page.',
    ],
    [
      'overview',
      '.studio-ledger',
      'Read the studio totals',
      'Overview summarises your project register, BOQ lines, quotation coverage and selling value. Missing costs are not zero-cost estimates: partial totals only include priced work. Sample data is labelled and is never a live vendor quotation.',
    ],
    [
      'attention',
      '.attention',
      'See what needs attention',
      'On your desk links to unpriced lines, items awaiting review and expired quotations. The project register opens each BOQ and shows progress and stage. Upcoming deadlines and the voice shortcut help you choose the next task.',
    ],
  ]),
  ...steps('Projects', 'projects', [
    [
      'projects',
      '.page-heading',
      'Create and find projects',
      'New project records project name, client, location, due date and commercial defaults. Search and stage filters narrow the register; select a project to open its BOQ. Each project keeps its own items, notes and pricing.',
    ],
  ]),
  ...steps('BOQ and costing', 'boq', [
    [
      'project-switch',
      '.project-context',
      'Choose the active BOQ',
      'Choose project switches between BOQs. Project details edits name, client, project type, location and target date. Creating or importing data is never required to finish this tour; if your studio is empty, these controls appear after you create a project.',
    ],
    [
      'project-delete',
      '[data-tour="project-details"]',
      'Edit or delete a project',
      'Project details also offers project deletion with confirmation. Deleting removes the project and its enquiries from the workspace. Export a backup first if you need to retain them; this is not an account or stored-call erasure tool.',
    ],
    [
      'pricing',
      '[data-tour="pricing"]',
      'Set markup and GST',
      'Pricing settings controls project markup on cost and GST on the selling subtotal. Markup is not gross margin: ₹100 cost plus 20% markup gives ₹120 before GST. Existing project settings are independent of new-project defaults.',
    ],
    [
      'summary',
      '.boq-summary',
      'Cost, selling value and completeness',
      'Estimated cost is what the work costs you; selling value includes markup. Completeness counts priced lines. Blank cost means unpriced, while an explicitly entered zero is a real zero. Incomplete BOQs show partial totals.',
    ],
    [
      'filters',
      '.filter-row',
      'Find the right line',
      'Search item descriptions/specifications, filter by category and use All, Unpriced or Needs review. Filters help you work through the BOQ; they do not delete items or limit what the workbook export contains.',
    ],
    [
      'items',
      '[data-tour="add-item"]',
      'Add and edit BOQ items',
      'Add item or an item name/edit control opens reference, description, exact specification, category, unit, quantity and unit cost. Brand/make, model and cost vendor identify what you plan to supply. Leave cost blank until a quote or estimate is verified.',
    ],
    [
      'quantities',
      '.workbench',
      'Understand quantities and source context',
      'Measured items need a quantity. Rate-only (RO) lines carry a unit rate without an amount; unknown quantities must be resolved before approval. Imported section headings and preceding specification rows remain available as inherited context in the item editor.',
    ],
    [
      'assembly',
      '[data-tour="add-item"]',
      'Build a cost from components',
      'In the item editor, expand Cost breakdown & item markup. Enable component costing to combine material, labour and other costs with a percentage adjustment. An optional item markup overrides project markup, including an explicit 0%; blank inherits the project setting.',
    ],
    [
      'identity',
      '.workbench',
      'Keep brands and suppliers attached to costs',
      'The same BOQ requirement can have several brand/model/vendor offers. Applying an offer copies its cost and product/supplier identity together. Editing the product, vendor, cost or quantity later detaches the quotation link; the historical offer stays in the library.',
    ],
    [
      'find-rate',
      '.workbench',
      'Compare and apply quotations',
      'Find rate, or the existing cost, opens compatible category/unit offers. Search by brand, model or vendor; inspect specification, source, validity and selling price. Confirm the specification before Apply rate. Expired or incompatible-unit quotations cannot be applied directly.',
    ],
    [
      'manual-rate',
      '.workbench',
      'Record another offer or a manual estimate',
      'The rate comparison can record another quotation with vendor, brand/model, source reference, dates, location and terms. Alternatives remain separate. You can also enter a manual cost or clear a price; a saved quotation alone does not price the BOQ.',
    ],
    [
      'review',
      '.totals',
      'Review lines and approve the BOQ',
      'Mark priced, quantity-resolved lines reviewed after checking scope and evidence. Changes reopen review. Approve reviewed BOQ becomes available only when the required lines are priced and reviewed; totals separate subtotal, GST and final selling value.',
    ],
    [
      'delete-item',
      '.workbench',
      'Remove a line carefully',
      'Each line has a delete control and confirmation. Removing a mapped original row disables original-workbook filling for the entire project, because the source structure no longer matches. Fresh client and internal exports remain available.',
    ],
  ]),
  ...steps('Client Excel import', 'boq', [
    [
      'import-excel',
      '[data-tour="import-boq"]',
      'Import a client BOQ',
      'Import Excel accepts .xlsx up to 10 MB. Choose the worksheet and header row, then map description, quantity and unit, plus optional reference, specification, brand, model, rate and amount columns. Save legacy .xls files as .xlsx first.',
    ],
    [
      'import-preview',
      '[data-tour="import-boq"]',
      'Verify columns and replacement',
      'Inspect the item preview and import warnings. Fields must use different columns. Confirm the rate basis and replacement: importing replaces the active project’s current BOQ. Original bytes are retained for later filling and backup.',
    ],
    [
      'source-costs',
      '[data-tour="import-boq"]',
      'Treat existing prices explicitly',
      'Source rates are ignored as purchase costs by default. Only enable Import existing rate values as purchase costs after verifying their basis. The rate mapping also identifies where selling prices go on original export. Source section context and notes are retained; resolve blank quantities and check RO rows.',
    ],
  ]),
  ...steps('Vendor files and matching', 'boq', [
    [
      'document-upload',
      '[data-tour="import-quote"]',
      'Extract vendor PDF or Excel rates',
      'Import vendor quotation is available here, in Rate library and inside an enquiry. Select the vendor and upload .xlsx or a selectable-text PDF up to 10 MB. Parsing runs on this device without paid AI. Scans/photos need a searchable PDF or Excel copy.',
    ],
    [
      'document-map',
      '[data-tour="import-quote"]',
      'Map the unit rate, not the total',
      'Choose a sheet/page and header, inspect source rows, and map description, quoted unit and unit rate; brand/model/specification are optional. Never confuse quantity, line amount or MRP with the net rate. Open original copy lets you check the actual file and other pages for terms.',
    ],
    [
      'document-match',
      '[data-tour="import-quote"]',
      'Review suggested BOQ matches',
      'Extract quotation rows, choose an offer and explicitly choose its BOQ item. Suggestions compare wording and flag unit, brand/model, size/rating and installation differences. They do not certify equivalent products. Check wrapped PDF descriptions and column alignment against the original.',
    ],
    [
      'document-cost',
      '[data-tour="import-quote"]',
      'Confirm GST, discount and pack conversion',
      'Verify quoted brand/model, specification and unit rate. Select tax basis, included GST, any additional discount and BOQ units per quoted unit. For example, ₹1,180 including 18% GST, less 10% discount, per 90 m coil gives ₹10/m excluding GST. Never deduct a discount twice.',
    ],
    [
      'document-save',
      '[data-tour="import-quote"]',
      'Save reviewed evidence, then apply',
      'Confirm date, current validity, delivery location and commercial terms; acknowledge review and save. Each offer retains its original file, source location and calculation. Duplicate source rows for the same vendor/project/item are blocked. Apply separately through Find rate; alternatives remain separate.',
    ],
  ]),
  ...steps('Excel exports', 'boq', [
    [
      'export-client',
      '[data-tour="export"]',
      'Create a client quotation',
      'Export BOQ opens workbook choices and a preview. Client quotation builds a fresh selling-price Excel with chosen brand/model, excluding your private supplier identities, costs and source sheets. Unpriced rates stay blank; incomplete or unreviewed output is labelled draft.',
    ],
    [
      'export-original',
      '[data-tour="export"]',
      'Fill the original workbook',
      'Fill the original workbook (internal) retains all source sheets, including hidden/private content, and requires an acknowledgement. It fills mapped cells; mapped brand/model columns are needed to include product identity. Original bytes are never overwritten. Review every sheet before forwarding.',
    ],
    [
      'export-internal',
      '[data-tour="export"]',
      'Keep an internal costing copy',
      'Internal costing includes supplier and purchase-cost information for your own comparison. Keep it private. If the original mapping is no longer usable, the fresh client and internal formats still work.',
    ],
    [
      'export-options',
      '[data-tour="export"]',
      'Choose filling and formatting',
      'Choose rates only or rates plus amounts. Fresh exports offer fixed values or recalculating formulas and simple or minimal formatting. General notes are opt-in. Original amount formulas stay intact and must recalculate in Excel; the app does not rewrite the client’s tax/totals logic.',
    ],
    [
      'export-preview',
      '[data-tour="export"]',
      'Preview the exact prepared download',
      'Select sheets and page through preview rows, then Download Excel. The preview shows cell contents rather than a pixel-perfect Excel page. RO/unknown quantities do not gain invented amounts. Check long-text row heights, hidden sheets, formulas and final print layout in Excel before issuing.',
    ],
  ]),
  ...steps('Rate library', 'rates', [
    [
      'rates',
      '.page-heading',
      'Keep reusable quotation evidence',
      'The Rate library holds independent dated offers. Record a quotation or import a vendor file. Vendor quotes require a vendor; past purchases, online references and manual estimates use their own source type and reference. Saving here does not apply a price to any BOQ.',
    ],
    [
      'rates-filter',
      '.filter-row',
      'Search and filter offers',
      'Find items, specifications, brands, models or vendors; narrow by category, search a vendor name and check expiry. Costs are per stated unit before GST. Several offers for one requirement let you compare alternatives without overwriting earlier evidence.',
    ],
    [
      'rate-evidence',
      '.rates-table',
      'Open the source details',
      'Open an offer to inspect supplier, product, specification, price, source, quotation/validity dates, location and notes. Imported offers also expose the original row, tax/discount/conversion and Download original quotation. Downloaded bytes are checked against the recorded fingerprint.',
    ],
  ]),
  ...steps('Vendors', 'vendors', [
    [
      'vendors',
      '.page-heading',
      'Add your supplier directory',
      'Add vendor records company/name, contact person, phone, email, category, location and notes. Use an internal tester without a telephone number for browser voice practice. Sample vendors are illustrative; a real rate must come from verified evidence.',
    ],
    [
      'vendor-details',
      '.vendor-list',
      'Find and maintain vendor details',
      'Search vendors, open a row to view contact information and the number of linked rates, then Edit vendor to update details. Rates and enquiries link to the vendor identity rather than replacing the supplier for every matching item.',
    ],
  ]),
  ...steps('Enquiries and voice', 'enquiries', [
    [
      'enquiry-create',
      '.page-heading',
      'Prepare a vendor enquiry',
      'Prepare enquiry chooses one project, one vendor and the required BOQ items. Unpriced items are suggested; review the selection and notes. Prepare brief saves the enquiry, with complete specifications, product identity, quantities and delivery context.',
    ],
    [
      'enquiry-brief',
      '.enquiry-list',
      'Use the brief and track responses',
      'Open an enquiry to inspect, copy or download its vendor brief. It asks for tax, scope, freight, availability, validity and alternatives. I have contacted the vendor updates the status; it does not send a message. Save notes keeps manual transcript/response notes separately from original voice history.',
    ],
    [
      'enquiry-quotes',
      '.enquiry-list',
      'Record partial and alternative responses',
      'Record a quotation against each requested item, or import the vendor’s PDF/Excel. Enquiry imports lock the project/vendor and requested items. Multiple brands can quote the same item. Partial replies remain Awaiting quote; all requested items need an offer before Quote received.',
    ],
    [
      'voice-ready',
      '.voice-banner',
      'Check actual voice readiness',
      'Inside a saved enquiry, the voice desk checks studio, LiveKit, worker and extraction availability. Read any setup error before calling. Local demo mode cannot call. Configure provider credentials on the server, never in BOQ notes.',
    ],
    [
      'voice-browser',
      '.voice-banner',
      'Test the agent in your browser',
      'Test in browser uses your microphone so you can play the vendor. Allow microphone access and use headphones. The agent discloses automation and requests permission. Keep the Mac/services running for the current local pilot; browser testing does not dial a telephone.',
    ],
    [
      'voice-controls',
      '.voice-banner',
      'Control and end a conversation',
      'During a browser call, mute/unmute the microphone, watch the live transcript and use End call to stop. The app refuses a second active call. Failed setup, ended calls and cancellation are reported; no successful call is simulated when a provider is unavailable.',
    ],
    [
      'voice-phone',
      '.voice-banner',
      'Understand telephone calling',
      'Phone calling is separate from browser tests. It needs an enabled SIP carrier, supported route, verified caller identity, vendor phone details and explicit consent acknowledgement. It is currently disabled for this pilot and is not promised free.',
    ],
    [
      'voice-history',
      '.enquiry-list',
      'Review transcripts and extracted drafts',
      'Select a conversation to view its saved transcript. Extract quotations proposes drafts supported by vendor words. Review and save each draft with tax, units, brand/model and commercial terms before applying it. Unknown tax/unit conversion needs confirmation; model output can be wrong or refused.',
    ],
    [
      'voice-providers',
      '.voice-banner',
      'Know which services handle audio',
      'The current pilot uses Deepgram Nova-3 and Meena Indian English speech with local Ollama. Deepgram consumes your credits; the local model can hang up early and extraction is not consistently accurate. Hindi/Hinglish, public hosting and ordinary vendor telephony are not validated.',
    ],
  ]),
  ...steps('Settings, safety and help', 'settings', [
    [
      'settings',
      '.settings-section',
      'Set defaults for future projects',
      'Studio details stores company name, default location, markup and GST. Save studio details applies these defaults to newly created projects; existing BOQs retain their own settings.',
    ],
    [
      'persistence',
      '.data-counts',
      'Understand where work is saved',
      'Signed-in work is saved to your private studio server; local demo work belongs to this browser/device. Save failures and revision conflicts are surfaced. If another session changed the studio, export pending changes before reloading rather than overwriting newer work.',
    ],
    [
      'backup',
      '[data-tour="backup"]',
      'Export a complete workspace backup',
      'Export full backup includes projects, vendors, rates, enquiries and referenced original BOQ/quotation files. Missing source files stop a complete backup. Treat the JSON as confidential. Account credentials and original server call/audit history need an operator’s server database backup.',
    ],
    [
      'restore',
      '[data-tour="restore"]',
      'Restore or deliberately reset',
      'Restore a backup validates the file and asks before replacing the active workspace; quote fingerprints are checked. JSON restores have a 50 MB limit. Start an empty workspace also asks for confirmation. Reset does not erase retained server calls, audit records or orphan files.',
    ],
    [
      'connections',
      '.integration-section',
      'Connections and signing out',
      'Voice & connected services explains the configured pipeline; open an enquiry for live readiness. Sign out of studio flushes pending saves and ends your login session. Connect to studio server in local mode reloads the app to check the backend.',
    ],
    [
      'privacy',
      '.integration-section',
      'Privacy and responsible use',
      'Privacy and Terms of use are available in the navigation footer. Audio/text may go to configured speech/model providers; no raw call recording is enabled. Nivo adds no analytics or automatic purchasing. You remain responsible for specifications, rates, taxes and issued files.',
    ],
    [
      'finish',
      '[data-tour="help"]',
      'You are ready to explore',
      'Use Help & walkthrough at any time to replay or jump directly to a feature. Completing or skipping is remembered for your account; it will not appear on later logins, including another device. Your BOQ and vendor data have not been changed by this tour.',
    ],
  ]),
];
// StrictMode effects share the same in-flight claim; separate tabs are arbitrated by SQLite.
const claims = new Map<string, Promise<boolean>>();
export function claimFirstTour(): Promise<boolean> {
  if (!remote) return Promise.resolve(false);
  const id = remote.user.id;
  const current = claims.get(id);
  if (current) return current;
  const request = api<{ showTour: boolean }>('/onboarding', {
    method: 'POST',
    body: JSON.stringify({ action: 'start' }),
  })
    .then((r) => r.showTour)
    .finally(() => claims.delete(id));
  claims.set(id, request);
  return request;
}
export async function rememberTour(outcome: TourOutcome) {
  if (remote)
    await api('/onboarding', { method: 'POST', body: JSON.stringify({ action: outcome }) });
}
