# Nivo behaviour inventory

Derived from source at commit `21496bf`.
Result values: PASS, FAIL (with finding id), N/A (with reason), BLOCKED (with reason).

Local = local-demo mode (`remote` is falsy, data kept in the browser). Studio = signed-in
studio-server mode (`remote` is set, data persisted server-side). Both operating modes get their
own result column below because they use different persistence code (`src/lib/api.ts`,
`src/lib/storage.ts`).

## Screens and routes

| Id | Route | Component | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- | --- |
| SCR-01 | `#overview` | `WorkspacePages.tsx` | Renders; next-deadline panel excludes undated projects | | |
| SCR-02 | `#projects` | `WorkspacePages.tsx` | Lists all projects; selecting one navigates to BOQ | | |
| SCR-03 | `#boq` | `BoqPage.tsx` | Renders selected project; falls back to first project after reload | | |
| SCR-04 | `#rates` | `WorkspacePages.tsx` | Lists rate evidence; expired rates visibly marked | | |
| SCR-05 | `#vendors` | `WorkspacePages.tsx` | Lists vendors; supports create and edit | | |
| SCR-06 | `#enquiries` | `EnquiriesPage.tsx` | Item selection, vendor brief, voice desk | | |
| SCR-07 | `#settings` | `SettingsPage.tsx` | Defaults, backup, restore, reset, signout | | |
| SCR-08 | unknown hash | `App.tsx:23` | Any unrecognised hash falls back to overview | | |

## Filters, search and sort

| Id | Location | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| FLT-01 | `BoqPage.tsx:41` category select | Filtering by a category shows only that category; "All items" shows all | | |
| FLT-02 | `BoqPage.tsx:42` status tab "All" | Shows every item | | |
| FLT-03 | status tab "Unpriced" | Shows exactly items where `cost === null`; a zero cost is NOT unpriced | | |
| FLT-04 | status tab "Needs review" | Shows exactly items where `reviewed === false` | | |
| FLT-05 | `BoqPage.tsx:40` search | Matches description and specification; case-insensitive | | |
| FLT-06 | combined | Category + status + search compose with AND, not OR | | |
| FLT-07 | `BoqPage.tsx:366` count | "N of M items" reflects the filtered and total counts accurately | | |
| FLT-08 | `BoqPage.tsx:130` project select | Switching project resets or correctly re-applies filters without showing stale rows | | |

## Dialogs

| Id | Trigger | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| DLG-01 | Project details | Opens, traps focus, Escape closes, focus returns to trigger | | |
| DLG-02 | Delete project | Requires explicit confirmation; cancel makes no change | | |
| DLG-03 | Edit item / new item | Saves changes; cancel discards | | |
| DLG-04 | Rate matching | Lists candidates by `rateCandidates`; applying requires confirmation | | |
| DLG-05 | Import workbook | Full mapping flow; see WBK rows | | |
| DLG-06 | Export | Offers the three exports; see EXP rows | | |
| DLG-07 | Pricing / assembly | Accepts material, labour, other, adjustment | | |
| DLG-08 | Delete item | Requires confirmation; removes exactly one item | | |
| DLG-09 | nested quotation dialogs | Distinct accessible names, per `CODEBASE_REFERENCE.md` | | |
| DLG-10 | Project pricing settings (markup / GST) | Opens, traps focus, Escape closes, focus returns to trigger; cancelling leaves markup, GST, every item's reviewed flag and the project stage unchanged | | |

DLG-01 through DLG-09 above are verbatim from the Task 2 brief and are frozen; DLG-10 was
appended after Task 2 review (2026-09-23) to cover the project pricing modal's own dialog
mechanics (`ui.tsx:148-172`'s focus trap, `onCancel`, backdrop close and `returnFocus`), which
DLG-07 does not reach — DLG-07 is the per-item assembly breakdown inside `ItemForm`
(`forms.tsx:218-254`), a different dialog. See CTL-23/CTL-39/CTL-40 for this dialog's functional
(markup/GST) payload.

## Interactive controls

Grouped by component file, in the order the components appear under `src/` (`App.tsx` first, then
`src/components/*.tsx` alphabetically). A control already described by a `FLT-*` or `DLG-*` row is
cross-referenced rather than re-described. Where a control is the same control repeated once per
list item (a delete button per table row, a result button per search match), one row describes the
repeated control and says so explicitly. No control below was found to be unreachable from any
trigger; none is marked `UNREACHABLE`.

### `App.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-01 | `App.tsx:125-134` "Skip to content" link | Moves keyboard focus to `#main-content`; the first focusable element for a keyboard/screen-reader user before the sidebar | | |
| CTL-02 | `App.tsx:136-140` mobile-nav backdrop button (rendered only while `mobile` is true) | Clicking closes the mobile navigation drawer | | |
| CTL-03 | `App.tsx:150-155` "nivo." brand button | Navigates to `#overview` and closes the mobile drawer | | |
| CTL-04 | `App.tsx:164-177` primary nav buttons, repeated once per `navigation` entry (Overview, Projects, BOQ workbench, Rate library, Vendors, Enquiry desk) | Clicking navigates to that page's hash, marks the active one `aria-current="page"`, and closes the mobile drawer; the Projects entry additionally shows a live project-count badge | | |
| CTL-05 | `App.tsx:187-193` "Settings & data" nav button | Navigates to `#settings` | | |
| CTL-06 | `App.tsx:203-210` "Privacy" footer link | Opens the Privacy policy modal | | |
| CTL-07 | `App.tsx:211-218` "Terms of use" footer link | Opens the Terms of use modal | | |
| CTL-08 | `App.tsx:225-232` mobile-menu toggle button (topbar) | Opens/closes the mobile navigation drawer; `aria-expanded` reflects the `mobile` state | | |
| CTL-119 | `App.tsx:46-54` mobile nav drawer initial focus, on open (small screen only) | Opening the drawer moves keyboard focus to the first non-disabled `<button>` inside the sidebar (`App.tsx:51-54`); while open on a small screen the sidebar also gets `role="dialog"` and `aria-modal="true"` (`App.tsx:146-147`), and is `inert` while closed on a small screen (`App.tsx:145`) | | |
| CTL-120 | `App.tsx:55-67` mobile nav drawer Tab focus trap (small screen, drawer open) | Tab from the last focusable button in the drawer wraps to the first; Shift+Tab from the first wraps to the last; keyboard focus cannot leave the drawer's buttons while it is open | | |
| CTL-121 | `App.tsx:68-73` mobile nav drawer close cleanup (fires whenever `mobile` becomes false while it was open on a small screen) | Restores `document.body.style.overflow` to its value from before the drawer opened, removes the Tab-trap keydown listener, and returns focus to whichever element had focus immediately before the drawer opened (typically the mobile-menu toggle, CTL-08) | | |
| CTL-122 | `App.tsx:89-96` Escape key, global `keydown` listener | Pressing Escape anywhere in the document sets `mobile` to false, closing the drawer if it was open; the listener is not scoped to the drawer and fires regardless of which element currently has focus | | |
| CTL-123 | `App.tsx:46-51` mobile nav drawer scroll lock (small screen, drawer open) | While the drawer is open on a small screen, `document.body.style.overflow` is set to `'hidden'`, preventing the page behind the drawer from scrolling; released on close per CTL-121 | | |
| CTL-09 | `App.tsx:239-243` "Jump to anything" global-search button | Opens the command-search modal, equivalent to pressing ⌘K/Ctrl-K | | |
| CTL-10 | `App.tsx:245-250` storage-error "Open settings" button (rendered only when `error` is set) | Navigates to `#settings` | | |
| CTL-11 | `App.tsx:251-262` demo-banner "Manage data" button (rendered only when the workspace still contains demo/sample records) | Navigates to `#settings` | | |
| CTL-12 | `App.tsx:372-374` toast dismiss button (rendered only while a toast is visible) | Clears the toast immediately, pre-empting its 6-second auto-dismiss timer | | |
| CTL-13 | `App.tsx:399-408` command-search input | Typing filters the result lists below by substring, case-insensitively, autofocused when the modal opens. Per-list matched fields differ: navigation matches on the page `label` only (`App.tsx:411`); projects match on `name` only (`App.tsx:427`); rates match on `description` only (`App.tsx:444`) — NOT `specification` or `sourceRef`; vendors match on `name` only (`App.tsx:463`) — NOT `contact`, `category` or `location`. This differs from FLT-05 and CTL-90/CTL-99/CTL-103/CTL-107, each of which matches multiple fields on their own page | | |
| CTL-14 | `App.tsx:410-425` command-search navigation-result buttons, repeated once per matching page | Clicking navigates to that page and closes the search modal, clearing the query | | |
| CTL-15 | `App.tsx:426-441` command-search project-result buttons, repeated once per matching project | Clicking opens that project's BOQ and closes the search modal | | |
| CTL-16 | `App.tsx:442-459` command-search rate-result buttons, repeated once per matching rate (shown only once a query is typed; capped at 5 results) | Clicking navigates to `#rates` and closes the search modal — it does NOT open that specific rate's own detail view | | |
| CTL-17 | `App.tsx:460-477` command-search vendor-result buttons, repeated once per matching vendor (shown only once a query is typed; capped at 5 results) | Clicking navigates to `#vendors` and closes the search modal — it does NOT open that specific vendor's own detail view | | |

### `components/BoqPage.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-18 | `BoqPage.tsx:51-61` "New project" button, shown only when no project exists at all | Opens the same new-project form as elsewhere (`ProjectForm`); see CTL-59 | | |
| CTL-19 | `BoqPage.tsx:113-116` "Import Excel" button | see DLG-05 | | |
| CTL-20 | `BoqPage.tsx:117-120` "Export BOQ" button | see DLG-06 | | |
| CTL-21 | `BoqPage.tsx:124-141` project switcher select | see FLT-08 | | |
| CTL-22 | `BoqPage.tsx:144-146` "Project details" text button | see DLG-01 | | |
| CTL-23 | `BoqPage.tsx:151-153` "Pricing settings" text button | Opens the project-wide pricing modal (markup % and GST % applied to every line of this project); this dialog is distinct from DLG-07, which is the per-item assembly breakdown inside the item form. See DLG-10 for this dialog's own focus/Escape/dismissal mechanics | | |
| CTL-24 | `BoqPage.tsx:186-192` status filter tabs (All / Unpriced / Needs review) | see FLT-02, FLT-03, FLT-04; the Unpriced tab additionally shows a live count badge | | |
| CTL-25 | `BoqPage.tsx:193-196` "Add item" toolbar button | see DLG-03 | | |
| CTL-26 | `BoqPage.tsx:199` item search input | see FLT-05 | | |
| CTL-27 | `BoqPage.tsx:200-208` category filter select | see FLT-01 | | |
| CTL-28 | `BoqPage.tsx:241,307,769,772` item-edit triggers: description text button and row edit-icon button, in both the desktop table and the mobile card list (repeated once per BOQ row; each row exposes two triggers to the same dialog) | see DLG-03 | | |
| CTL-29 | `BoqPage.tsx:262-270,791` "Find rate" / unit-cost value buttons, desktop and mobile (repeated once per BOQ row) | see DLG-04 | | |
| CTL-30 | `BoqPage.tsx:283-301,810-818` review-toggle buttons, desktop and mobile — the same logical control rendered in both responsive layouts (repeated once per BOQ row) | Toggles `item.reviewed`; disabled while `item.cost` is null or, for a measured quantity kind, while `item.quantity` is null; refuses to mark reviewed and shows a notification instead if the item's linked source rate has expired | | |
| CTL-31 | `BoqPage.tsx:312-318,819-825` delete-item icon buttons, desktop and mobile (repeated once per BOQ row) | see DLG-08 | | |
| CTL-32 | `BoqPage.tsx:357-361` "Add first item" empty-state button | see DLG-03 | | |
| CTL-33 | `BoqPage.tsx:384-388` "Prepare a vendor enquiry" text button, rendered only while `t.missing > 0` | Navigates to `#enquiries` | | |
| CTL-34 | `BoqPage.tsx:404-421` "Approve reviewed BOQ" button | Disabled unless the project has at least one item, every item is reviewed, no line has an unresolved quantity, and no linked source rate has expired; clicking sets `project.stage` to `Approved` and shows a confirmation toast noting further edits reopen it as a draft | | |
| CTL-35 | `BoqPage.tsx:450-464` delete-project modal buttons ("Keep project" / "Delete project") | see DLG-02 | | |
| CTL-36 | `BoqPage.tsx:518-525` rate-matching "I will verify the selected rate…" confirmation checkbox | see DLG-04 | | |
| CTL-37 | `BoqPage.tsx:527-572` rate-matching "Apply rate" buttons, repeated once per candidate | see DLG-04; each button is additionally disabled while its own candidate rate is expired, independent of the shared confirmation checkbox | | |
| CTL-38 | `BoqPage.tsx:580-599` rate-matching "Enter cost manually" and "Prepare enquiry" buttons | see DLG-04 | | |
| CTL-39 | `BoqPage.tsx:623-645` pricing-settings markup and GST number inputs | Markup accepts 0–500 (step 0.1); GST accepts 0–100 (step 0.1); both required | | |
| CTL-40 | `BoqPage.tsx:651-655` pricing-settings "Save pricing" submit button | Saves `project.markup`/`project.gst`, resets every item's `reviewed` flag to false, sets `project.stage` to Draft, and shows a "review the revised selling rates" notification | | |
| CTL-41 | `BoqPage.tsx:674-707` export-modal option buttons (Client quotation / Fill the original workbook — internal / Internal costing workbook) | see DLG-06; per-export correctness is covered by Task 3's `EXP-*` rows. The second option is additionally disabled unless the project has a `workbookId` and a mapped rate column | | |
| CTL-42 | `BoqPage.tsx:722-741` delete-item modal buttons ("Keep item" / "Remove item") | see DLG-08 | | |

### `components/EnquiriesPage.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-43 | `EnquiriesPage.tsx:53-66` "Prepare enquiry" header button | Disabled when the workspace has no projects or no vendors; opens the create-enquiry form, pre-selecting the current project's unpriced items | | |
| CTL-44 | `EnquiriesPage.tsx:96-114` enquiry-list row buttons, repeated once per enquiry | Clicking opens that enquiry's detail modal | | |
| CTL-45 | `EnquiriesPage.tsx:123-133` "Prepare first enquiry" empty-state button | Same create-enquiry flow as CTL-43 | | |
| CTL-46 | `EnquiriesPage.tsx:165-179` create-enquiry "Project" select | Changing project resets the selected-items list to empty | | |
| CTL-47 | `EnquiriesPage.tsx:180-188` create-enquiry "Vendor" select | Selects which vendor the brief targets | | |
| CTL-48 | `EnquiriesPage.tsx:200-224` per-item selection checkboxes, repeated once per project item | Checking/unchecking adds/removes the item id from the enquiry's `itemIds`; once more than 20 items are selected a notice explains voice calls need a smaller batch | | |
| CTL-49 | `EnquiriesPage.tsx:225-231` "Additional instructions" textarea | Free text carried into the saved enquiry's `notes` field | | |
| CTL-50 | `EnquiriesPage.tsx:233-235` create-enquiry "Cancel" button | Closes the create-enquiry modal, discarding the draft | | |
| CTL-51 | `EnquiriesPage.tsx:236-238` create-enquiry "Prepare brief" submit button | Disabled unless at least one item and a vendor are selected; saves a new enquiry with status `Prepared` and opens its detail | | |
| CTL-52 | `EnquiriesPage.tsx:250-260` "Download brief" button (enquiry detail) | Downloads the generated plain-text brief as `Nivo-vendor-enquiry.txt` | | |
| CTL-53 | `EnquiriesPage.tsx:261-274` "Copy brief" button (enquiry detail) | Copies the generated brief text to the clipboard; shows a fallback notification if the Clipboard API throws | | |
| CTL-54 | `EnquiriesPage.tsx:285-301` "Record quotation" / "Update quotation" buttons, repeated once per selected item on the enquiry | Opens `RateForm` pre-scoped to that item and the enquiry's vendor; the label reads "Update quotation" once a quote already exists for the item | | |
| CTL-114 | `EnquiriesPage.tsx:276-279` "Read the complete enquiry brief" `<details>/<summary>` disclosure, collapsed by default (enquiry detail modal) | Expanding it reveals the full generated brief text (`brief(detail)`, the same text CTL-52 downloads and CTL-53 copies), read-only | | |
| CTL-55 | `EnquiriesPage.tsx:314-316` "Enquiry notes" textarea | Free text saved to the enquiry's `notes` field on submit | | |
| CTL-56 | `EnquiriesPage.tsx:317-327` "Transcript or conversation notes" textarea | Free text saved to the enquiry's `transcript` field on submit; distinct from any voice-call transcript captured by `VoiceDesk` | | |
| CTL-57 | `EnquiriesPage.tsx:329-340` "I have contacted the vendor" button, rendered only while `detail.status === 'Prepared'` | Sets the enquiry status to `Awaiting quote` immediately, independent of the notes form's own submit | | |
| CTL-58 | `EnquiriesPage.tsx:341` "Save notes" submit button | Saves the notes/transcript textareas (CTL-55, CTL-56) to the enquiry | | |

### `components/forms.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-59 | `forms.tsx:29-105` `ProjectForm`: name, client, project type, location, target-date fields; "Cancel"; "Delete project" (shown only when editing an existing project); Save/Create submit | see DLG-01 for the dialog mechanics. Saving persists all five fields (name, client, project type, location, target date) to the project; name, client and location are required (`required` attribute) and block submission if blank, while target date may be left blank; Cancel discards all field edits and makes no change; "Delete project" hands off to DLG-02 without itself saving anything. Additionally, every `ProjectForm` save unconditionally sets `stage: 'Draft'` and maps every item in the project to `{ ...item, reviewed: false }` (`forms.tsx:47,51`), regardless of whether name, client, type, location or target date actually changed. This is a neutral observation of current behaviour, not a defect determination; it is exactly parallel to the `ItemForm` save-time side effects at CTL-111/CTL-112/CTL-113 | | |
| CTL-60 | `forms.tsx:107-285` `ItemForm` main fields (description, specification, category, unit, quantity basis, quantity, unit cost) plus Cancel/Save | see DLG-03 for the dialog mechanics. Saving persists description, specification, category, unit, quantity basis, quantity and unit cost to the item (description is required); Cancel discards all field edits and makes no change. See CTL-111/CTL-112/CTL-113 for three additional save-time side effects (`rateId` reset, quantity-basis rewrite, assembly cost override) not otherwise visible from these fields alone | | |
| CTL-61 | `forms.tsx:218-254` `ItemForm` assembly breakdown, inside the "Cost breakdown & item markup" disclosure (see CTL-115): "Calculate unit cost from the components below" checkbox, material/labour/other/adjustment inputs, item-markup override | see DLG-07 for the dialog mechanics. Material, labour and other are ₹-per-unit amounts (each min 0); adjustment is a percentage applied on top of the base cost, not a ₹ amount; item markup accepts 0–500 (%) and overrides the project markup for this item alone when non-blank. See CTL-113 for the checkbox's effect on the Unit cost field in CTL-60 | | |
| CTL-111 | `forms.tsx:138` `ItemForm` save behaviour: `rateId: undefined` is set unconditionally on every save (`const next = { ...item, rateId: undefined, ... }`) | Saving an item from `ItemForm` — via any of CTL-28/CTL-32/CTL-60's triggers — always clears the item's link to its source rate (`item.rateId`), regardless of whether the description, specification, unit or quantity actually changed. This is a neutral observation of current behaviour, not a defect determination; it directly affects what CTL-30 (review-toggle's stale-source check) and CTL-34 (Approve reviewed BOQ's stale-source check) can find via `i.rateId` after any edit-and-save of an item that came from a matched rate | | |
| CTL-112 | `forms.tsx:145-146` `ItemForm` save behaviour: `quantityKind: kind === 'measured' && d.get('quantity') === '' ? 'unknown' : kind` | Choosing "Measured quantity" as the quantity basis and leaving the Quantity field blank on save silently rewrites the saved `quantityKind` to `unknown`, rather than keeping it as `measured` with a null quantity. Neutral observation of current behaviour, not a defect determination | | |
| CTL-113 | `forms.tsx:149` `ItemForm` save behaviour: `cost: assembly ? assemblyCost(assembly) : raw === '' ? null : Number(raw)` | When the "Calculate unit cost from the components below" checkbox (CTL-61/CTL-115) is checked, the saved unit cost is always computed from material/labour/other/adjustment via `assemblyCost()`, overriding whatever value is currently typed into the Unit cost field (CTL-60) — the typed Unit cost value is discarded, not merely hidden. Neutral observation of current behaviour, not a defect determination | | |
| CTL-115 | `forms.tsx:218-219` "Cost breakdown & item markup" `<details>/<summary>` disclosure, collapsed by default | Expanding it reveals the assembly-breakdown controls (CTL-61); the checkbox, inputs and item-markup override are not visible or reachable until this disclosure is expanded | | |
| CTL-117 | `forms.tsx:255-264` "Inherited specification · {item.section \|\| 'Source context'}" `<details>/<summary>` disclosure, rendered only when `item.context?.length` is truthy (i.e. only for items carrying imported source context, typically from a workbook import) | Expanding it lists each inherited context row (`Row {c.row}`, `{c.text}`) read-only; not rendered at all for an item with no `context` entries | | |
| CTL-62 | `forms.tsx:286-355` `VendorForm`: company name, contact, category, phone, email, location, notes fields plus Cancel/Save | Not covered by any `DLG-*` row. Save persists the vendor (create when opened without a `vendor`, update in place when opened with one) and closes; Cancel discards the edit | | |
| CTL-63 | `forms.tsx:356-514` `RateForm`: description, specification, category, unit, cost, vendor, source type, source reference, quoted date, valid-until date, delivery location, commercial-terms fields plus Cancel/Save | see DLG-09 for the dialog-naming concern (this is the "quotation" dialog opened, nested, from Rates page, Enquiries capture and VoiceDesk draft review). Saving persists all listed fields as a new `Rate` and closes; Cancel discards the draft and makes no change; submit is blocked client-side with an inline error ("Validity must be on or after the quotation date") when `validUntil` is earlier than `quotedAt`, and the rate is not saved in that case | | |

### `components/ImportDialog.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-64 | `ImportDialog.tsx:110-123` `.xlsx` file picker | see DLG-05; rejects non-`.xlsx` files, files over 10 MB, workbooks with no worksheets, and any sheet exceeding 10,000 rows or 100 columns, each with an inline error message | | |
| CTL-65 | `ImportDialog.tsx:133-169` worksheet select, header-row number input, and the 7 column-mapping selects (description, original reference, quantity, unit, specification, rate column, amount column) | see DLG-05; an inline error appears if the same column is mapped to more than one field | | |
| CTL-66 | `ImportDialog.tsx:178-187` "Import existing rate values as purchase costs" checkbox | Disabled unless a rate column is mapped; see DLG-05 | | |
| CTL-67 | `ImportDialog.tsx:188-195` "I have checked the columns and rate basis…" confirmation checkbox | see DLG-05 | | |
| CTL-68 | `ImportDialog.tsx:242-244` "Cancel" button | Closes the dialog, discarding the loaded workbook and any mapping made so far | | |
| CTL-69 | `ImportDialog.tsx:245-289` "Import N items" submit button | see DLG-05; disabled unless a workbook is loaded, at least one item resulted from parsing, the confirmation checkbox (CTL-67) is checked, and no two mapped fields share a column | | |
| CTL-118 | `ImportDialog.tsx:225-231` "{n} import warnings" `<details>/<summary>` disclosure, rendered only when `result.warnings.length` is non-zero | Expanding it lists up to the first 30 parse warnings, read-only; this is the ONLY surface in the app that exposes import warnings — there is no other row, badge or notification that shows them, so a verifier must expand this disclosure to check warning content at all | | |

### `components/SettingsPage.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-70 | `SettingsPage.tsx:28-43` "Sign out of studio" (rendered in Studio mode) / "Connect to studio server" (rendered in Local mode) — mutually exclusive by `remote` | Studio mode: flushes pending workspace writes, calls `POST /logout`, then reloads the page. Local mode: reloads the page to re-attempt a studio connection | | |
| CTL-71 | `SettingsPage.tsx:49-96` studio-details form (studio name, default location, default markup %, default GST %) and "Save studio details" submit | Saves the four fields into `workspace.settings` and shows a confirmation toast | | |
| CTL-72 | `SettingsPage.tsx:116-133` "Export full backup" button | Downloads a full workspace backup file, including available original workbooks; shows a failure notification if the export throws | | |
| CTL-73 | `SettingsPage.tsx:134-156` "Restore a backup" file input (`.json`) | Reads and parses the chosen file into a pending restore preview (`readBackup`); shows an error notification if the file cannot be read; does not itself modify the active workspace | | |
| CTL-74 | `SettingsPage.tsx:157-159` "Start an empty workspace" text button | Opens the reset-confirmation modal (CTL-75) | | |
| CTL-75 | `SettingsPage.tsx:186-221` reset-confirmation modal ("Keep my workspace" / "Start empty") | "Start empty" replaces the workspace with empty projects/vendors/rates/enquiries while keeping studio settings, and re-enables saving via `onSave(..., true)`; "Keep my workspace" makes no change | | |
| CTL-76 | `SettingsPage.tsx:223-259` restore-confirmation modal ("Cancel" / "Restore workspace") | "Restore workspace" restores any backed-up workbook files, then replaces the active workspace with the backup's contents and re-enables saving; "Cancel" discards the pending restore without changing the workspace | | |

### `components/StudioAccess.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-77 | `StudioAccess.tsx:59-93` sign-in form (email, password) and "Sign in" submit button | Submits credentials to `POST /login`; on success establishes the remote session and renders `<App/>` in Studio mode; on failure shows the server's error message inline; the submit button is disabled and reads "Opening studio…" while the request is in flight | | |
| CTL-78 | `StudioAccess.tsx:94-102` "Explore the local demo" button | Clears any remote session (`setRemote(null)`) and renders `<App/>` in Local mode without authenticating | | |

### `components/ui.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-79 | `ui.tsx:180-188` shared `Modal` close button (×), present in every dialog built on `Modal` | Clicking calls the dialog's own `onClose`; the same component's native `<dialog>` `onCancel` (Escape) and backdrop-click handlers (`ui.tsx:161-172`) should produce the same result | | |
| CTL-80 | `ui.tsx:211-230` shared `Search` component (label + input), used directly by BoqPage (see FLT-05) and by Overview/ProjectsPage/RatesPage/VendorsPage (see CTL-90, CTL-99, CTL-103, CTL-107) | The input's value is controlled by the caller; typing calls the caller's `onChange` on every keystroke with no internal debouncing | | |

### `components/VoiceDesk.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-81 | `VoiceDesk.tsx:191-205` "Test in browser" button. `VoiceDesk` is not rendered at all in Local mode — it returns an explanatory notice instead (`VoiceDesk.tsx:153-159`); expect `N/A` for the Local column on CTL-81 through CTL-88 | Disabled while busy, when the enquiry has more than 20 items, when the voice worker isn't reachable/verified, or while a call is already starting/active; requests microphone permission, flushes pending workspace writes, creates a call via `POST /calls`, then connects a LiveKit room and starts local audio | | |
| CTL-82 | `VoiceDesk.tsx:206-216` "Mute microphone" / "Unmute microphone" toggle, rendered only while `connected` | Toggles the LiveKit local participant's microphone-enabled state and flips the button label | | |
| CTL-83 | `VoiceDesk.tsx:217-237` "End call" button, rendered only while the current call is starting/active/connected | Ends the call via `POST /calls/:id/end`, disconnects the LiveKit room, clears `connected`, and refreshes the call list | | |
| CTL-116 | `VoiceDesk.tsx:239-240` "Call {vendor?.name \|\| 'the vendor'} by phone" `<details>/<summary>` disclosure, collapsed by default | Expanding it reveals the vendor's phone number (or a prompt to add one), the phone-charges/consent notice, and — critically — the phone-consent checkbox (CTL-84) and "Call vendor" button (CTL-85), which are otherwise not visible or reachable | | |
| CTL-84 | `VoiceDesk.tsx:246-249` phone-consent checkbox ("I have verified this vendor and number…") | Must be checked before "Call vendor" (CTL-85) becomes enabled. Gated: this checkbox is rendered only inside the collapsed `<details>` disclosure at CTL-116 ("Call {vendor} by phone") — it is not visible or reachable until that disclosure is expanded | | |
| CTL-85 | `VoiceDesk.tsx:250-264` "Call vendor" phone button | Disabled unless consent (CTL-84) is checked, the enquiry has ≤20 items, the voice worker is reachable/verified, and outbound calling is enabled on the server; starts a `phone`-mode call. Gated: this button is rendered only inside the same collapsed `<details>` disclosure as CTL-84 (CTL-116) — a verifier must expand "Call {vendor} by phone" first or this control will not be found | | |
| CTL-86 | `VoiceDesk.tsx:279-287` conversation/call picker select, rendered only once at least one call exists | Switches which call's transcript/drafts are displayed below; each option shows created time, mode and status | | |
| CTL-87 | `VoiceDesk.tsx:305-322` "Extract quotation drafts" button | Disabled while busy, when extraction isn't configured on the server, or when the active call has no transcript; calls `POST /calls/:id/extract` then refreshes the call list | | |
| CTL-88 | `VoiceDesk.tsx:338-343` "Review & record quotation" buttons, repeated once per extracted draft | Opens `RateForm` pre-filled from the draft; the draft's cost is carried over only when its tax basis is `excluding-gst` and its unit matches the item's unit, otherwise the cost field is left blank; see DLG-09 for the nested-dialog naming concern | | |

### `components/WorkspacePages.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-89 | `WorkspacePages.tsx:49-52` Overview "New project" header button | Opens `ProjectForm` with no existing project; see CTL-59 | | |
| CTL-90 | `WorkspacePages.tsx:90-94` Overview project search input | Filters the project register by name, client or location, case-insensitively | | |
| CTL-91 | `WorkspacePages.tsx:109-113` Overview "Create a project" empty-state button, rendered only when there is no active search query | Same as CTL-89 | | |
| CTL-92 | `WorkspacePages.tsx:118-141` "On your desk" attention row — items needing a rate | Opens the first project with an unpriced item, or triggers the new-project flow (CTL-89) if none exists | | |
| CTL-93 | `WorkspacePages.tsx:142-160` "On your desk" attention row — prices to review | Opens the first project containing a priced-but-unreviewed item, or navigates to `#rates` if none exists | | |
| CTL-94 | `WorkspacePages.tsx:161-170` "On your desk" attention row — expired rate references | Navigates to `#rates`; it does not filter that page to only expired rates | | |
| CTL-95 | `WorkspacePages.tsx:181-183` "Open enquiry desk" text button | Navigates to `#enquiries` | | |
| CTL-96 | `WorkspacePages.tsx:186-195` "Next target date" project-name button, rendered only when an unapproved project has a due date | Opens the soonest-due project's BOQ | | |
| CTL-97 | `WorkspacePages.tsx:205-248` `ProjectRow` button, shared by the Overview register and the Projects page grid (repeated once per project) | Opens that project's BOQ page | | |
| CTL-98 | `WorkspacePages.tsx:272-275` Projects page "New project" header button | Same as CTL-89 | | |
| CTL-99 | `WorkspacePages.tsx:278` Projects page search input | Filters by name, client or location, case-insensitively | | |
| CTL-100 | `WorkspacePages.tsx:279-287` Projects page stage filter select (All projects / Draft / In review / Approved) | Filters the project list to the selected stage; composes with the search text (CTL-99) as AND | | |
| CTL-101 | `WorkspacePages.tsx:293-301` Projects page "New project" empty-state button, rendered only when the filtered list is empty | Same as CTL-89 | | |
| CTL-102 | `WorkspacePages.tsx:334-337` Rates page "Record quotation" header button | Opens `RateForm` with no pre-filled item or vendor; see CTL-63 / DLG-09 | | |
| CTL-103 | `WorkspacePages.tsx:352-356` Rates page search input | Filters by description, specification or sourceRef, case-insensitively | | |
| CTL-104 | `WorkspacePages.tsx:357-365` Rates page category filter select | Filters the rate list to the selected category; composes with the search text (CTL-103) as AND | | |
| CTL-105 | `WorkspacePages.tsx:382-416` rate-row "view" triggers: description text button and chevron icon button, two triggers per row (repeated once per rate) | Opens that rate's read-only evidence detail modal | | |
| CTL-106 | `WorkspacePages.tsx:511-514` Vendors page "Add vendor" header button | Opens `VendorForm` with no pre-filled vendor; see CTL-62 | | |
| CTL-107 | `WorkspacePages.tsx:517-521` Vendors page search input | Filters by name, contact, category or location, case-insensitively | | |
| CTL-108 | `WorkspacePages.tsx:525-548` vendor-row button, repeated once per vendor | Opens that vendor's detail modal | | |
| CTL-109 | `WorkspacePages.tsx:550-558` Vendors page "Add a vendor" empty-state button, rendered only when the filtered list is empty | Same as CTL-106 | | |
| CTL-110 | `WorkspacePages.tsx:590-600` vendor-detail "Edit vendor" button | Closes the detail modal and reopens `VendorForm` pre-filled with that vendor; see CTL-62 | | |

## API endpoints

| Id | Endpoint | Correct behaviour | Result |
| --- | --- | --- | --- |
| API-01 | `GET /api/health` | 200 without authentication | |
| API-02 | `GET /api/session` | Returns session when authenticated; unauthenticated shape is safe | |
| API-03 | `POST /api/login` | Valid credentials set an HttpOnly SameSite=Strict cookie | |
| API-04 | `POST /api/login` wrong password | Rejected; no cookie; rate limited on repeat | |
| API-05 | `POST /api/logout` | Invalidates the session; subsequent calls unauthorised | |
| API-06 | `GET /api/workspace` | Returns only the authenticated account's workspace | |
| API-07 | `PUT /api/workspace` | Saves with a matching revision | |
| API-08 | `PUT /api/workspace` stale revision | Returns 409 and does NOT overwrite | |
| API-09 | `PUT /api/workspace` invalid body | Rejected by shared validation, not persisted | |
| API-10 | `PUT /api/files/:id` | Stores workbook bytes; enforces the 10 MB body limit | |
| API-11 | `GET /api/files/:id` | Returns bytes byte-identical to what was stored | |
| API-12 | `GET /api/voice/status` | Reports provider availability without leaking any secret | |
| API-13 | `GET /api/calls` | Lists only the authenticated account's calls | |
| API-14 | `GET /api/calls/:id` | Own call returns 200; another account's returns 404 or 403, never content | |
| API-15 | `POST /api/calls` | Creates a call; a repeated request id is idempotent | |
| API-16 | `POST /api/calls` phone mode | Refused while `ENABLE_OUTBOUND_CALLS=false` | |
| API-17 | `POST /api/calls/:id/end` | Ends the call; ending an already-ended call is harmless | |
| API-18 | `GET /api/agent/calls/:id` | Requires a valid HMAC; returns the brief without internal prices | |
| API-19 | `POST /api/agent/events` | Valid signature accepted | |
| API-20 | `POST /api/agent/events` bad signature | Rejected 401 | |
| API-21 | `POST /api/agent/events` replayed event id | Rejected, does not duplicate the transcript | |
| API-22 | `POST /api/agent/events` expired timestamp | Rejected outside the five-minute window | |
| API-23 | `POST /api/agent/events` late event on terminal call | Does NOT reopen the call | |
| API-24 | `POST /api/agent/events` null payload | Returns 400, not 500 | |
| API-25 | `POST /api/calls/:id/extract` | Produces a validated draft or a clear error | |
| API-26 | any mutation without the same-origin header | Rejected | |
| API-27 | any authenticated route without a cookie | 401, never partial data | |

## Exports, backup and workbook

| Id | Behaviour | Correct behaviour | Result |
| --- | --- | --- | --- |
| EXP-01 | Client quotation export | Opens in Excel; contains selling rates; contains NO purchase cost and no original private sheet | |
| EXP-02 | Internal costing export | Opens in Excel; contains costs and selling prices | |
| EXP-03 | Original workbook export | Opens in Excel; unrelated sheets and formulas intact; recalculation requested | |
| EXP-04 | Original export after structural edit | Refused, per the documented rule that structural edits disable mapping | |
| EXP-05 | Original export with a formula in a mapped rate cell | Refused, naming the exact cell address | |
| EXP-06 | Unpriced line in original export | Retains its original source cell rather than being blanked | |
| BAK-01 | JSON backup, local mode | Downloads; contains the workspace and base64 workbook | |
| BAK-02 | JSON restore, local mode | Restores to an identical workspace | |
| BAK-03 | JSON backup and restore, studio mode | Round-trips through the API | |
| BAK-04 | Studio reset | Clears the workspace; documented to leave calls and audit intact | |
| WBK-01 | Import a valid XLSX | Mapping, preview, warnings, then items created | |
| WBK-02 | Import over the 10 MB limit | Rejected with a clear message | |
| WBK-03 | Import over 10,000 rows or 100 columns | Rejected with a clear message | |
| WBK-04 | Merged quantity continuation rows | Attach to the anchor item, no duplicate line | |
| WBK-05 | Zero source rate on import | Treated as a placeholder, not as a real zero cost | |
| WBK-06 | Manually entered zero cost | Remains an intentional zero, distinct from unpriced | |
| WBK-07 | Round trip | Imported bytes retrieved from storage hash-match the original file | |

## Voice (browser WebRTC only; no telephone call)

| Id | Behaviour | Correct behaviour | Result |
| --- | --- | --- | --- |
| VOI-01 | Voice status panel | Reports readiness accurately when the worker is up and when it is down | |
| VOI-02 | Start browser test call | Connects; disclosure is spoken and transcribed | |
| VOI-03 | Mute and unmute | Both take effect | |
| VOI-04 | End call | Ends; the room is deleted | |
| VOI-05 | Close the desk mid-setup | Setup cancels; no orphan room is left | |
| VOI-06 | Enquiry above 20 items | The voice limit is shown | |
| VOI-07 | Phone call button | Gated and refused while outbound calls are disabled | |
| VOI-08 | Second concurrent call | Refused; one active call per studio | |
| VOI-09 | Worker down | Call creation refused rather than hanging | |
| VOI-10 | Extraction draft review | Draft never changes a price automatically; evidence survives save | |

## Domain invariants

| Id | Invariant | Result |
| --- | --- | --- |
| INV-01 | Null cost is unpriced and distinct from zero cost | |
| INV-02 | Null quantity never silently becomes zero | |
| INV-03 | Rate-only keeps a selling rate and has no line amount | |
| INV-04 | Unknown quantity has no amount and blocks approval | |
| INV-05 | `assemblyCost` rounds `(material+labour+other) × (1+adjustment/100)` | |
| INV-06 | `sellingRate` rounds `cost × (1+markup/100)`, markup on cost | |
| INV-07 | `markupOverride` takes precedence over project markup | |
| INV-08 | Line amount rounds `quantity × rounded selling rate` | |
| INV-09 | GST applies to the subtotal | |
| INV-10 | Applying a quote clears review state and assembly | |
| INV-11 | Editing cost, spec, quantity or pricing reopens Draft | |
| INV-12 | Approval requires priced lines, resolved quantities, unexpired evidence | |
| INV-13 | `applyRate` refuses mismatched units | |
| INV-14 | `applyRate` refuses expired evidence | |
| INV-15 | `normalUnit` aliases resolve correctly and do not over-merge | |
