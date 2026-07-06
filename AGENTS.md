# Codex Agent Instructions

- Follow the source dependency direction documented in `src/ARCHITECTURE.md`: `app -> pages -> features -> shared`.
- Use the shared contracts in `src/shared/model` for selection, inspectors, forms, jobs, tables, repositories, result views, and import/export boundaries.
- Before introducing a new shared interface category beyond the existing `src/shared/model` contracts, explain why the existing contracts are insufficient and ask the user for confirmation before implementing it.
- Keep domain-specific fields in feature modules. Shared model interfaces must stay domain-agnostic.
