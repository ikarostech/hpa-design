# UI/UX Guidelines

HPA Design is a design and analysis workspace for aircraft, airfoils, geometry, analysis cases, and results. The UI should feel like an engineering tool: dense enough for repeated work, calm enough to compare data, and predictable across entities.

## Product Shape

- Treat list pages as dashboards, not marketing pages or wizard pages.
- Put the primary data surface first: charts, tables, metrics, and status summaries.
- Prefer direct comparison and inspection over large explanatory copy.
- Keep navigation persistent on desktop so users can move between airfoils, aircraft geometry, analysis, results, and export without losing context.
- Use Japanese labels consistently in user-facing UI.

## List And Dashboard Pages

List-oriented pages should center on the current operational picture.

- Use charts and tables as the main content, as in the airfoil page.
- Keep summary metrics close to the related table or chart.
- Use table rows for entities and analysis records.
- Use checkboxes for multi-select or batch targets.
- Use radio buttons, selected rows, tabs, or segmented controls for "currently displayed" data.
- Keep row actions compact, usually icon plus short label.
- Avoid card-heavy landing-page composition for data pages.
- Avoid nested cards. A repeated entity can be a card when it is genuinely a repeated item, but a section should usually be an unframed layout or a single panel.

Recommended dashboard pattern:

1. Page title and compact context text.
2. Primary graph/result panel.
3. Main entity table.
4. Related analysis/result list.
5. Detail or edit inspector on desktop.

## Create And Edit Pattern

Use a master-detail pattern for entity-heavy workflows.

- Desktop and tablet: keep the list/dashboard visible and open create/edit/detail in a right-side inspector panel.
- Smartphone: switch from list view to edit/detail view, with a clear back button that returns to the previous list state.
- Preserve selection, filters, scroll position, and unsaved form state when returning from edit/detail.
- Prefer inline lightweight edits only for low-risk scalar fields.
- Use a modal only for short confirmation, destructive actions, or focused pickers. Avoid full editing workflows in modals.

This pattern is common for data-heavy applications. It is usually called master-detail, split view, inspector panel, or side panel editing. Examples include admin consoles, design tools, analytics products, file managers, and IDE-like workspaces. On mobile, the same pattern commonly collapses into a separate detail screen with a back affordance because there is not enough horizontal space for a persistent split view.

## Inspector Panel Behavior

The side panel should be predictable and task-focused.

- Use it for detail, create, and edit states.
- Keep the panel width stable on desktop, usually 360-480 px depending on form density.
- Show the selected entity name and status at the top.
- Keep primary actions in a consistent location.
- Make close/back behavior explicit.
- Warn before discarding unsaved changes.
- Do not hide critical comparison data inside the panel if it belongs in the dashboard.

Suggested inspector states:

- Detail: read-only overview, geometry preview, status, recent results, and actions.
- Create: empty or templated form, with validation and save/cancel actions.
- Edit: editable form for the selected entity, with save/cancel and dirty-state handling.
- Running: disabled form fields where needed, progress/status feedback, and non-blocking result updates.

## Mobile Behavior

Mobile should preserve the same workflow, not shrink every desktop panel into an unusable layout.

- Use a single-column view.
- Show the dashboard/list first.
- Selecting detail or edit replaces the list with a full-screen detail/edit view.
- Provide a visible back button at the top of the detail/edit view.
- Keep bottom or top actions reachable without covering form content.
- Use accordions sparingly for dense secondary sections.
- Tables may become horizontally scrollable when exact columns matter, but key row information should remain readable without excessive zooming.

## Entity And Analysis Relationships

Separate "what is selected for editing" from "what is displayed in charts" and "what is queued for analysis".

- Selected entity: drives detail/edit inspector.
- Batch selection: drives create/run actions for multiple entities.
- Display selection: drives graph/result visibility.
- Analysis list: stores run records and should control which result set is visualized.

This separation prevents confusing states where clicking a row unexpectedly changes analysis targets or graph visibility.

## Forms

- Group fields by domain meaning, not by implementation model.
- Use numeric inputs for Reynolds number, Mach number, angles, spans, chords, and masses.
- Use selects or segmented controls for fixed option sets.
- Use checkboxes/toggles for binary settings.
- Use validation near the field and a compact summary only when multiple errors block saving.
- Do not require users to leave the dashboard to create or edit a normal entity on desktop.

## Visual Style

- Favor restrained colors, clear spacing, and stable dimensions.
- Use charts, previews, and real geometry/result data as the visual interest.
- Keep dominant palettes balanced; avoid making whole pages a single hue theme.
- Use icons from the existing icon library for compact actions.
- Ensure text fits in table cells, buttons, and panels on desktop and mobile.

## When To Deviate

Use a dedicated full page instead of a side inspector when:

- The workflow requires a large canvas or multi-step geometry editor.
- The edit form has many dependent sections that cannot fit comfortably in a panel.
- The task is destructive, rare, or requires careful review before commit.
- The user needs to compare two large editable objects side by side.

Even then, preserve a clear path back to the originating dashboard and keep the entity context visible.
