# Shared Model Interfaces

This directory contains app-wide contracts for UI state, async work, persistence, and import/export boundaries.

Keep these interfaces domain-agnostic. Feature modules should extend them with domain IDs, settings, and results instead of adding feature-specific fields here.

## Current Contracts

- `selection.ts`: single and multi selection models.
- `inspector.ts`: detail/create/edit inspector state.
- `form.ts`: form value, validation, dirty, and submit state.
- `job.ts`: queued/running/completed work such as analysis, import, export, and optimization.
- `table.ts`: sorting, filtering, and pagination state.
- `repository.ts`: entity persistence boundary.
- `resultView.ts`: displayed and primary result selection for charts, previews, and comparison views.
- `transfer.ts`: importer/exporter and validation results.
