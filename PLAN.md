# Nivo v1 — implementation plan

Written before implementation, 22 September 2026.

## Product

Nivo (nee-vo) is Technosmart's estimating and vendor-enquiry workspace. It supports preparing our own BOQs and pricing client BOQs using dated vendor quotations and project history. The long-term product adds assisted supplier calling; v1 makes the underlying workflow useful and testable first. The working name has not undergone trademark/domain clearance.

## Delivery boundary

Build an independent app in `TSInteriors/nivo`; the existing website and other sibling projects stay intact. Deliver a working local-first React/TypeScript web application, not just screens. Data persists in this browser. Clearly label illustrative starter data and disconnected voice services. No real calls, messages, invented live prices or hidden provider integrations.

## Design plan

- Theme: an architectural studio's precision desk. Dense where comparison matters, generous where decisions matter.
- Palette: blueprint ink #183247, porcelain #edf0f2, drafting paper #f6f7f5, cobalt #315bdb, mineral #718493. No pure-white backgrounds, gradients, neon or multicolour status decoration.
- Typography: self-hosted Manrope; tabular numerals for money, restrained headline sizes, sentence-case labels.
- Identity: original vector N built from folded architectural planes. SVG assets stay sharp at favicon and wordmark sizes.
- Layout: permanent ink navigation rail; quiet top context bar; left-aligned working canvas. Dashboard combines a project register, original plan illustrations and an actionable review queue. BOQ is a spreadsheet-like workbench. Detail panels retain context.
- Motion: short view changes and user-triggered drawer/modal transitions; no looping decorative animation. Honour reduced-motion preferences.
- Accessibility: labelled controls, clear focus, dialogs with focus management, keyboard operation, responsive layouts, actionable empty/error states.
- Critique: avoid generic gradient heroes, repeated identical metric cards, faux AI chat, gratuitous glass effects, and decorative charts. The signature is architectural imagery plus exceptionally readable estimating tables.
- Design guidance: apply Anthropic's frontend-design SKILL.md, read from its official repository. Instagram reel DdfSs0bqR1w could not be retrieved; do not claim its content was reviewed.
- User supplied a reel screenshot after scaffolding: prohibit all listed default treatments, including Lucide icons, drop shadows, soft corners, feature-card trios, bento grids, glass, emojis, dots, sparkles, decorative hover/arrow animations, terminal motifs and fake social proof. Use original symbols, crisp corners and meaningful skeletons during workbook loading. Add truthful local-use and privacy information. Items 9–12 are obscured; clarification requested. Conservatively avoid em dashes, Inter, stock colour decoration and fabricated claims. The screenshot supersedes the original softer identity direction.

## Build sequence

1. Scaffold Vite + React + TypeScript, theme, logo, shell and reusable UI primitives.
2. Define typed projects, BOQ items, vendors, dated rate evidence, enquiries and workspace settings. Add illustrative seeds and versioned local persistence.
3. Implement dashboard, project creation, searchable BOQ editing, totals, review states, rate selection and manual rate entry.
4. Implement Excel import with explicit sheet/header/column mapping and preview. Export a fresh BOQ or fill mapped cells of the retained source workbook. Retain source data locally in IndexedDB; document supported-workbook limits.
5. Implement vendor directory, quote library, enquiry preparation and structured quotation capture. Voice screen describes connection status honestly and produces a real call brief.
6. Implement local workspace settings, backup export/import and empty-workspace reset with confirmation.
7. Test money/unit matching and spreadsheet round trips; run build/type checks and browser flows at desktop/mobile widths. Inspect screenshots and correct defects.
8. Finish CODEBASE_REFERENCE.md with architecture, every source file's purpose, business invariants, commands, limitations and next milestones.

## Acceptance criteria

- A user can create a project, add/edit/delete lines, attach a rate source and export a priced BOQ.
- A mapped XLSX can be imported; source rows remain traceable and priced cells can be exported into a copy.
- Costs and selling prices are distinct; unpriced lines never masquerade as complete totals; taxes, markup and stale evidence are visible.
- Vendors and enquiries can be created; captured quotes can enter the library and be applied explicitly.
- Changes survive reload. Storage failures are surfaced. Backups are available.
- No dead-end primary controls or pretend calling. Demo evidence is labelled.
- Production build and meaningful automated checks pass, with remaining limits documented.

## Subsequent production milestones

Authenticated multi-user backend, tenant isolation, file storage, audit events and revisions; real quote-document extraction with evaluation; Indian voice provider integration with verified caller identity, vendor consent preferences and review controls; secure deployment and operational monitoring. These require business decisions and provider accounts beyond this local v1.

## Delivery status

Completed the scoped local v1: identity/theme, responsive shell, editable project register, BOQ costing and review, rate evidence, vendor directory, enquiry briefs/manual quote capture, mapped Excel import and both export modes, local persistence, backup/restore, settings, use/privacy notices, codebase reference and automated validation. Phone BOQs use an item layout with visible prices/actions. Real calling and multi-user SaaS remain explicitly outside the delivered local-pilot scope.
