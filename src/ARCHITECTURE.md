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
- `shared`: UI, layout, and utilities that do not depend on feature code.
- `mocks`: temporary data fixtures used while real persistence/API layers are not ready.

Feature modules should avoid importing from each other directly unless there is a clear domain dependency. Prefer moving reusable pure logic into `shared/lib` or introducing an explicit service boundary.
