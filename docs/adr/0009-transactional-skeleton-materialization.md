# ADR-0009: Transactional skeleton materialization

Status: accepted (2026-08-14)

## Context

Plan generation will create and sometimes connect source files in repositories that may already
contain compatible code, conflicting files, or uncommitted work. A partial scaffold could leave the
workspace inconsistent, and overwriting user code is unacceptable.

## Options

1. Preflight the complete mutation set, preserve compatible existing code, apply it as one logical
   transaction, and restore the original state after any failure.
2. Create only missing files, skip conflicts, and report a partial result.
3. Replace previously generated stubs while avoiding files classified as handwritten.

## Decision

Choose option 1. The Transactional Materializer classifies every proposed path before writing,
aborts before mutation on any conflict, stages the coordinated change, and rolls back every applied
creation or modification if materialization or sidecar emission fails. Compatible existing code is
preserved and represented in the manifest rather than overwritten.

Compatibility is claimed only when a bounded built-in syntax strategy verifies it. Unsupported
existing content is preserved as opaque/declarative, never edited or semantically validated, and
is not reported as verified-compatible.

## Consequences

- A successful plan run yields the complete coordinated artifact set; a failed run restores the
  pre-run workspace state.
- The manifest must distinguish created, connected, and preserved paths and retain enough integrity
  data to detect drift without claiming ownership of preserved code.
- Temporary-repository integration tests must exercise preflight conflicts, mid-apply failures,
  rollback, idempotent re-entry, and dirty-worktree preservation.
