# Source Layout

This app uses a feature-first layout with a small shared foundation.

## Dependency Direction

Keep imports flowing in this direction:

```txt
app -> pages -> features -> shared
```

- `app`: routing and application-level composition.
- `pages`: route-level screens that compose features and shared UI.
- `features`: domain areas such as airfoils, aircraft, analysis, and projects.
- `shared`: UI, layout, utilities, and domain-agnostic contracts that do not depend on feature code.
- `mocks`: temporary data fixtures used while real persistence/API layers are not ready.

Feature modules should avoid importing from each other directly unless there is a clear domain dependency. Prefer moving reusable pure logic into `shared/lib` or introducing an explicit service boundary.

## Shared Model Contracts

Use `shared/model` for cross-feature contracts that would otherwise be redefined inside pages or components:

- Selection state.
- Inspector and drawer state.
- Form state.
- Job and run state.
- Table state.
- Entity repository boundaries.
- Result view state.
- Import and export boundaries.

Keep these contracts domain-agnostic. Add feature-specific fields in feature modules by composing or extending the shared interfaces.
