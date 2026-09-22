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
| CTL-09 | `App.tsx:239-243` "Jump to anything" global-search button | Opens the command-search modal, equivalent to pressing ⌘K/Ctrl-K | | |
| CTL-10 | `App.tsx:245-250` storage-error "Open settings" button (rendered only when `error` is set) | Navigates to `#settings` | | |
| CTL-11 | `App.tsx:251-262` demo-banner "Manage data" button (rendered only when the workspace still contains demo/sample records) | Navigates to `#settings` | | |
| CTL-12 | `App.tsx:372-374` toast dismiss button (rendered only while a toast is visible) | Clears the toast immediately, pre-empting its 6-second auto-dismiss timer | | |
| CTL-13 | `App.tsx:399-408` command-search input | Typing filters the navigation/project/rate/vendor result lists below by substring, case-insensitively; autofocused when the modal opens | | |
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
| CTL-23 | `BoqPage.tsx:151-153` "Pricing settings" text button | Opens the project-wide pricing modal (markup % and GST % applied to every line of this project); this dialog is distinct from DLG-07, which is the per-item assembly breakdown inside the item form | | |
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
| CTL-55 | `EnquiriesPage.tsx:314-316` "Enquiry notes" textarea | Free text saved to the enquiry's `notes` field on submit | | |
| CTL-56 | `EnquiriesPage.tsx:317-327` "Transcript or conversation notes" textarea | Free text saved to the enquiry's `transcript` field on submit; distinct from any voice-call transcript captured by `VoiceDesk` | | |
| CTL-57 | `EnquiriesPage.tsx:329-340` "I have contacted the vendor" button, rendered only while `detail.status === 'Prepared'` | Sets the enquiry status to `Awaiting quote` immediately, independent of the notes form's own submit | | |
| CTL-58 | `EnquiriesPage.tsx:341` "Save notes" submit button | Saves the notes/transcript textareas (CTL-55, CTL-56) to the enquiry | | |

### `components/forms.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-59 | `forms.tsx:29-105` `ProjectForm`: name, client, project type, location, target-date fields; "Cancel"; "Delete project" (shown only when editing an existing project); Save/Create submit | see DLG-01 for the edit variant; the same component, without an existing `project`, is the "new project" creation form opened from CTL-18/89/91/98/101; "Delete project" hands off to DLG-02 | | |
| CTL-60 | `forms.tsx:107-285` `ItemForm` main fields (description, specification, category, unit, quantity basis, quantity, unit cost) plus Cancel/Save | see DLG-03 | | |
| CTL-61 | `forms.tsx:218-254` `ItemForm` assembly breakdown: "Calculate unit cost from the components below" checkbox, material/labour/other/adjustment inputs, item-markup override | see DLG-07 | | |
| CTL-62 | `forms.tsx:286-355` `VendorForm`: company name, contact, category, phone, email, location, notes fields plus Cancel/Save | Not covered by any `DLG-*` row. Save persists the vendor (create when opened without a `vendor`, update in place when opened with one) and closes; Cancel discards the edit | | |
| CTL-63 | `forms.tsx:356-514` `RateForm`: description, specification, category, unit, cost, vendor, source type, source reference, quoted date, valid-until date, delivery location, commercial-terms fields plus Cancel/Save | see DLG-09 (this is the "quotation" dialog opened, nested, from Rates page, Enquiries capture and VoiceDesk draft review); submit is blocked client-side with an inline error when `validUntil` is earlier than `quotedAt` | | |

### `components/ImportDialog.tsx`

| Id | Control | Correct behaviour | Local | Studio |
| --- | --- | --- | --- | --- |
| CTL-64 | `ImportDialog.tsx:110-123` `.xlsx` file picker | see DLG-05; rejects non-`.xlsx` files, files over 10 MB, workbooks with no worksheets, and any sheet exceeding 10,000 rows or 100 columns, each with an inline error message | | |
| CTL-65 | `ImportDialog.tsx:133-169` worksheet select, header-row number input, and the 7 column-mapping selects (description, original reference, quantity, unit, specification, rate column, amount column) | see DLG-05; an inline error appears if the same column is mapped to more than one field | | |
| CTL-66 | `ImportDialog.tsx:178-187` "Import existing rate values as purchase costs" checkbox | Disabled unless a rate column is mapped; see DLG-05 | | |
| CTL-67 | `ImportDialog.tsx:188-195` "I have checked the columns and rate basis…" confirmation checkbox | see DLG-05 | | |
| CTL-68 | `ImportDialog.tsx:242-244` "Cancel" button | Closes the dialog, discarding the loaded workbook and any mapping made so far | | |
| CTL-69 | `ImportDialog.tsx:245-289` "Import N items" submit button | see DLG-05; disabled unless a workbook is loaded, at least one item resulted from parsing, the confirmation checkbox (CTL-67) is checked, and no two mapped fields share a column | | |

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
| CTL-84 | `VoiceDesk.tsx:246-249` phone-consent checkbox ("I have verified this vendor and number…") | Must be checked before "Call vendor" (CTL-85) becomes enabled | | |
| CTL-85 | `VoiceDesk.tsx:250-264` "Call vendor" phone button | Disabled unless consent (CTL-84) is checked, the enquiry has ≤20 items, the voice worker is reachable/verified, and outbound calling is enabled on the server; starts a `phone`-mode call | | |
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
