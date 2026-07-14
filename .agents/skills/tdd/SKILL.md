---
name: tdd
description: Apply test-driven development in this repository through small Red-Green-Refactor cycles, architecture-aware test placement, focused verification, and final evidence reporting. Use when Codex implements or changes executable behavior, adds a feature, fixes a bug, or performs a behavior-preserving refactor that needs characterization tests. Do not require synthetic Red for documentation, generated artifacts, configuration-only work that does not alter executable behavior, or other non-behavioral changes.
---

# Test-driven development

## Establish the scope

1. Read `AGENTS.md`, `src/ARCHITECTURE.md`, the nearest implementation, and its tests.
2. Translate the request into small, observable acceptance scenarios. Clarify only choices that would materially change the result.
3. Check whether the change needs a new shared interface category. If it does, stop before writing a test or implementation, explain why the contracts in `src/shared/model` are insufficient, and ask the user for confirmation.
4. Select the lowest layer that fully expresses each behavior:
   - Test domain calculations and transformations in `model`.
   - Test use cases and boundary orchestration in `services`.
   - Test logic at the lowest suitable layer. When acceptance criteria include UI wiring, interaction, or accessibility, also add an appropriate component, hook, page, or browser test.
   - Test behavior spanning multiple features at the `pages` or `app` layer.
5. Run the narrowest relevant existing tests and record the green baseline. Distinguish pre-existing failures from failures caused by the task.

## Run Red -> Green -> Refactor

Complete one acceptance scenario before starting the next.

### Red

1. Add or update the smallest test that describes one missing behavior.
2. Run only the relevant test file with `npm test -- <path-to-test>`.
3. Confirm that the failure is caused by the missing behavior or contract. Accept a directly missing new API as Red, but reject unrelated syntax, setup, dependency, type, or environment failures.
4. If the test passes unexpectedly, determine whether the behavior already exists or strengthen a weak test. Do not alter production code merely to create a failure.
5. Do not manufacture Red by reversing an assertion or deliberately breaking working production code.

### Green

1. Make the smallest production change that satisfies the failing scenario.
2. Re-run the focused test until it passes.
3. Avoid unrelated cleanup, speculative generalization, or additional behavior during this step.
4. Do not delete, skip, weaken, or broadly rewrite an existing test to obtain Green. Change an expectation only when the requested behavior intentionally changes.

### Refactor

1. Improve duplication, naming, responsibilities, or structure without changing observable behavior.
2. Re-run the focused tests after each meaningful refactor.
3. Keep architecture boundaries and shared model contracts intact.
4. Continue with the next acceptance scenario only after the current slice is green and clear.

## Design trustworthy tests

- Test public behavior and domain invariants instead of private helpers, React internals, hook call counts, or incidental component structure.
- Map every behavioral acceptance criterion to at least one test. Add success, malformed input, meaningful bounds, async failure, or cancellation cases according to risk rather than by checklist.
- Use meaningful tolerances and invariants for numerical code. Avoid large snapshots of floating-point output.
- Avoid snapshot tests unless the serialized structure itself is the contract.
- Keep tests deterministic. Control clocks, random values, generated IDs, network access, files, timers, and WASM execution at explicit boundaries.
- Prefer real, fast, deterministic collaborators. Use in-memory fakes for repository behavior and small stubs for external or nondeterministic boundaries.
- Use the existing contracts in `src/shared/model` at selection, inspector, form, job, table, repository, result-view, and import/export boundaries. If they cannot represent the boundary, follow the confirmation gate before introducing a new shared interface category. Keep domain-specific doubles, adapters, and fixtures inside the owning feature.
- Use spies only when the call or side effect is itself part of the public contract. Restore mocks, timers, and global changes after each test.
- Keep unit and component tests beside their implementation as `*.test.ts` or `*.test.tsx`. Do not use `src/mocks` as a reusable test-fixture library.

## Handle special cases

- For a bug fix, reproduce the defect in a failing regression test before changing production behavior. Reuse an existing failing test when it already captures the same regression.
- For a behavior-preserving refactor, record a green baseline. Add characterization tests only for important behavior that lacks protection; allow those tests to be green from the start.
- When legacy code lacks a test seam, make a minimal behavior-preserving preparatory refactor, verify the baseline before and after it, and report why it was necessary.
- For documentation, comments, formatting, generated artifacts, static styling, or test-infrastructure-only changes, skip synthetic Red and perform the most relevant available validation.
- When a UI behavior cannot yet be automated, perform an appropriate browser or manual check and report the limitation. Do not describe it as automated coverage.
- When the reported defect cannot be reproduced, do not guess at a fix. Report the attempted conditions, observed result, and information still needed.

## Verify and report

1. Run every impacted focused test after the final refactor.
2. Run `npm test` and `npm run build` before completing a production TypeScript change.
3. Review the diff for weakened assertions, excessive mocks, architecture violations, nondeterminism, uncovered material failure modes, and unrelated changes.
4. Report concise TDD evidence for normal behavior changes:
   - List the acceptance behavior covered.
   - Give the Red command, failing test, and expected failure reason.
   - Give the focused Green/Refactor commands and results.
   - Give the full `npm test` and `npm run build` results.
5. For a justified exception such as a pure refactor or non-behavioral change, state why Red was skipped and which baseline or other validation replaced it.
6. State any untested area, pre-existing failure, or limitation.
7. Never claim that a command passed unless it was actually run.
