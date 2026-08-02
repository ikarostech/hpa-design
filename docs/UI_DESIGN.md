# UI Design Guidelines

## Scope and ownership

- `docs/ARCHITECTURE.md` defines source-code architecture and dependency direction.
- This document defines user-interface structure and interaction consistency.
- `AGENTS.md` links to the applicable documents and defines agent workflow; it should not duplicate detailed UI specifications.

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
