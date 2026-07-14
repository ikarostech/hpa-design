# Codex Agent Instructions

## Architecture

- Follow the source dependency direction documented in `src/ARCHITECTURE.md`: `app -> pages -> features -> shared`.
- Use the shared contracts in `src/shared/model` for selection, inspectors, forms, jobs, tables, repositories, result views, and import/export boundaries.
- Before introducing a new shared interface category beyond the existing `src/shared/model` contracts, explain why the existing contracts are insufficient and ask the user for confirmation before implementing it.
- Keep domain-specific fields in feature modules. Shared model interfaces must stay domain-agnostic.

## Test-driven development

- Use the repository `tdd` skill (`$tdd` in `.agents/skills/tdd`) by default for changes that add or correct executable behavior.
- Work in small observable behavior slices using Red -> Green -> Refactor:
  1. Red: add or update the smallest meaningful test and run it.
  2. Green: make the smallest production change that satisfies the test.
  3. Refactor: improve names and structure while keeping tests green.
- Confirm that Red fails because the requested behavior is absent. A missing new API may be a valid Red; an unrelated setup, dependency, syntax, type, or environment failure is not.
- Start every bug fix with a regression test that reproduces the defect.
- If a new test is already green, determine whether the behavior already exists or the test is too weak. Do not change production code merely to manufacture Red.
- For behavior-preserving refactoring, establish a green baseline and add characterization tests only where protection is missing. Do not invent a failing test for a pure refactor.
- Do not delete, skip, or weaken an existing test merely to make a change pass. Update expectations only when the requested behavior intentionally changes.
- Documentation, comments, formatting, generated artifacts, static styling, and test-infrastructure-only changes do not require artificial Red. Report the exception and perform the most relevant available verification.

## Test placement and boundaries

- Co-locate unit and component tests with their implementation as `*.test.ts` or `*.test.tsx`.
- Test observable behavior through public APIs. Prefer real pure collaborators; fake or stub only external or nondeterministic boundaries such as WASM, files, network access, clocks, random values, and generated IDs.
- Tests, fixtures, fakes, and test helpers must follow the same dependency direction as production code: `app -> pages -> features -> shared`.
- Test behavior spanning multiple features at the `pages` or `app` layer instead of adding sibling-feature imports solely for testing.
- Use the contracts exported by `src/shared/model` at selection, inspector, form, job, table, repository, result-view, and import/export boundaries.
- Keep feature-specific fixtures, doubles, and contract extensions inside the owning feature. Tests under `shared` must not import feature code.
- Before adding either a test or production code that assumes a new shared interface category, explain why the existing shared contracts are insufficient and obtain user confirmation.
- Treat `src/mocks` as temporary application data, not as a source of reusable test fixtures.

## Verification and reporting

- During Red/Green cycles, run the narrowest relevant test with `npm test -- <path-to-test>`.
- Before completing a production TypeScript change, run `npm test` and `npm run build`.
- Give UI behavior changes an appropriate user-visible check. If automated DOM or E2E tooling is unavailable, state that limitation and report the manual or browser verification performed.
- For normal behavior changes, report the Red command and expected failure reason, focused Green result, and final full-suite/build results. For a justified TDD exception, report why Red was skipped and which validation replaced it.
- Never report a command as passing unless it was actually run.
