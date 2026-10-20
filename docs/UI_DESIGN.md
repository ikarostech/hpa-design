# UI Design Guidelines

## Scope and ownership

- `docs/ARCHITECTURE.md` defines source-code architecture and dependency direction.
- This document defines user-interface structure and interaction consistency.
- `AGENTS.md` links to the applicable documents and defines agent workflow; it should not duplicate detailed UI specifications.

## Page and inspector templates

- Compose every route-level screen with `PageTemplate` from `src/shared/ui/layout`. Put the page title, description, header actions, tabs, and page-level notices in its named slots; keep domain grids, cards, tables, and state in the owning page or feature.
- Render right-side detail, edit, creation, and run panels with `InspectorDrawer` from `src/shared/ui/inspector`. Keep domain fields, validation, persistence, and job controls in the owning feature.
- Use the standard 440 px drawer for ordinary detail and forms. Use the wide 520 px drawer for dense engineering properties and tables.
- Supply specific close and back labels. The shared drawer owns dialog semantics, backdrop behavior, scrolling, header layout, and the optional fixed footer.
- Keep centered confirmation and short-form modal workflows as dialogs; do not force them into the inspector template when they are not associated with a selected row or page-side context.

## Pages and tabs

- Use a page for an independent design domain that appears in application navigation. Use tabs only for related working surfaces owned by that domain.
- Keep aerodynamic design as one page with `翼型`, `主翼設計`, and `主翼解析` tabs, in that order. Wing analysis owns wing-only LLT/VLM cases. Standalone stability design at `/stability` owns aircraft VLM cases; redirect the old `/aerodynamics/stability` URL to it without migrating or dropping cases and results. Existing cases without a scope remain wing-only. Stability design owns `尾翼設計` and `安定性解析` tabs at `/stability/tails` and `/stability`. Redirect the old `/aerodynamics/tails` route to the tail tab without dropping saved geometry. `尾翼設計` owns horizontal-tail and vertical-tail geometry independently from the main wing. Each added tail surface renders its properties and ordered section table inline, automatically applying valid edits to the design. Keep invalid edits in the draft until corrected. Omit page-level cancel, save, and proceed-to-analysis buttons; use the stability analysis tab for navigation. Model each surface with the XFLR5 `ELEVATOR` or `FIN` section fields: span position, chord, X offset, dihedral, twist, left/right foil, and chordwise/spanwise panel settings. Elevators and rudders use an all-moving tail model rotating about the span axis through the root spar position, assumed to coincide with the aerodynamic center; use incidence to evaluate the angle without a separate hinge-position editor. Whole-aircraft results focus on Cm versus angle of attack, trim angle, static margin, and longitudinal/lateral/directional static derivatives, with derivative plots and comparisons. Keep CL/CD/L-D performance plots on the main-wing analysis surface, and omit trim CL and raw lift/drag columns from the stability workspace; CL remains an internal input to static-margin calculations. Whole-aircraft results show longitudinal, lateral, and directional static derivatives; identify the coefficient axes, evaluation angle, and uncomputed dynamic stability. These tabs produce the rigid-aircraft aerodynamic definition used by downstream analysis.
- Keep structural design as a peer page with `構造案`, `基準荷重`, and `単独解析` tabs. Start structural sizing from an assumed elliptical load distribution, while allowing aerodynamic and manual load cases for comparison.
- Use the FSI page for coupled evaluation of an aerodynamic design and a structural design. It owns coupled conditions, convergence, deformed-shape results, rigid-versus-coupled comparisons, and post-FSI frozen-shape static stability evaluation. New frozen-shape cases inherit the displayed converged/current FSI result matching the aircraft geometry without a separate source selector. Keep saved frozen-shape cases accessible even when their original coupled result is unavailable.
- Keep stability design as a peer page before FSI in navigation. Place vertically stacked main-wing, structural-result, and tail-design selectors inside the initial stability case creation/edit drawer, rather than at the top of the analysis tab. Selecting a completed standalone structural result copies its deflection/twist into the draft immediately. Preserve saved geometry and deformation when editing even if source results are unavailable or the current design has changed. Keep introductory FSI explanation cards out of the analysis tab. Freeze the selected geometry and deformation in each case so reruns retain the selected combination. The current project has one main-wing design and one tail set; the tail selector also permits no tails. It owns initial rigid and manually specified symmetric deflection/twist evaluation, which must work without a structural design or FSI result. Also allow copying completed standalone structural-analysis deflection/twist distributions into the initial stability case, using the current main-wing spar position as the twist axis and the current main-wing/tail design for evaluation. Offer only current results whose finite, ordered distribution covers the main-wing half-span. Show the source design, load case, load factor, safety factor, and result date when selecting a result. Store the copied distribution as editable case input; later structural reruns must not replace it. Apply it symmetrically as a fixed shape without aerodynamic load feedback. Use the same analysis workspace and solver for initial and post-FSI evaluation. On the FSI page, allow comparison with saved initial stability results and show source shape, conditions and static derivatives together. Save shape inputs with the case and result snapshot; FSI shapes keep their source flight speed and do not change when FSI is rerun. Distinguish frozen-shape derivatives from additional deformation and dynamic stability, which are not included.
- Show domain-specific uncoupled results inside their owning aerodynamic or structural page. Do not add a top-level generic results page unless it has a distinct cross-domain task that is not FSI.

## Entity-management tables

Use the table as the primary management surface when users maintain a collection of entities.

- Complete the CRUD flow within the table area: Create in the header; Read, Update, and Delete from the corresponding row.
- Put create actions in the table header, not above unrelated charts or visualizations.
- Open read-only detail views and edit forms from the row, using an associated drawer or inspector when the content does not fit the row.
- Allow small, unambiguous edits to be made inline only when saving is immediate and the editable field is clearly identified; use an edit drawer for other changes.
- Ask for confirmation before deletion, explaining any reference, retention, or irreversible effect.
- Give the action column a stable location at the right side of the table, and right-align its header and action controls.
- Keep row actions available without relying on row selection. Selection, filtering, sorting, and comparison controls manage table state; they are not CRUD controls.
- Use empty states to explain how to create the first item.

## Row action controls

Use icon-only buttons for compact row actions. Every icon button must have an accessible `aria-label` containing both the entity name and the action, and a `title` tooltip.

| Order | Icon | Meaning | Availability |
| --- | --- | --- | --- |
| 1 | `Info` | Open details in an associated drawer or inspector | All managed entities |
| 2 | `Pencil` | Edit mutable entity data | Entities with editable data |
| 3 | `RotateCcw` | Rerun or retry the current entity | When an operation can be run again |
| 4 | `Download` + downward chevron | Choose an export format | When multiple export formats are available |
| 5 | domain-specific | Other contextual action | Only when applicable |
| last | `Trash2` | Delete the entity | Deletable entities; always confirm |

- Keep `Trash2` visually destructive in every table and show the same confirmation pattern, including reference or retention effects when relevant.
- Do not use row selection controls as a substitute for the `Info` detail action. Selection is a separate state and remains at the left of the row.
- When one action supports multiple mutually exclusive output formats, use one icon button and a menu to choose the format rather than placing one icon per format. Pair the icon with a downward chevron so the menu is discoverable, and render the menu outside scroll containers so it can be used without scrolling the table.
- Keep actions that are not applicable out of the row, or render them disabled with a reason when their presence is necessary for layout consistency.
- Apply this order to new tables and migrate existing tables when they are next changed.

## Ordered entity tables

- Use `OrderedEntityTable` from `src/shared/ui/table` when insertion is relative to a selected row.
- Keep the collection's authoritative ordering and insertion calculations in the owning page or feature; the shared component only renders the current item order and dispatches the selected entity key.
- Put the paired “add before” and “add after” creation actions in the table header. Disable them when no row is selected, with a reason when a domain rule prevents one direction.
- Preserve row selection independently from row actions, and keep contextual actions in the stable right-aligned action column.

## Airfoils

- On `/airfoils`, NACA generation and DAT import are creation actions in the airfoil table header.
- Airfoil and analysis Run rows both use the common `Info` detail action and icon-only action controls.
- Analysis-specific controls such as graph visibility, primary Run selection, export, and retry remain domain-specific.
