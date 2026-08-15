# ADR-0008: Plan-native skeleton and graph bundle

Status: accepted (2026-08-14)

## Context

The plan stage currently emits a canonical Markdown contract and deliberately leaves code creation
to executors. The new requirement makes plan generation state-changing: every new plan also creates
the planned code skeleton, a versioned skeleton manifest, and a typed machine-readable graph. These
artifacts must agree across Claude Code and Codex, all supported operating systems, offline use, and
repositories in arbitrary languages.

ADR-0001's canonical single plan and ADR-0005's contracts-not-code boundary therefore need different
treatment: the Markdown plan remains canonical for downstream consumers, while the prohibition on
creating code during planning is superseded.

## Options

1. Derive one plan-native internal model and emit the plan, manifest, graph, and skeleton from it.
2. Write skeleton files first, then infer the graph and revise the plan from filesystem inspection.
3. Delegate skeleton and graph generation to language-specific adapters with a generic fallback.

## Decision

Choose option 1. A Plan Model Builder derives tasks, files, public contracts, stub contents, and
typed relationships. A Bundle Emitter renders the canonical Markdown plan plus adjacent versioned
JSON manifest and graph files. A Graph Projector places each task's relevant graph slice into its
self-contained plan contract, so plan-runner, inline execution, subagents, and GitHub tickets remain
plan-only consumers. Tools may separately consume the complete graph JSON.

The Markdown plan remains the canonical downstream contract. ADR-0001 remains in force. ADR-0005 is
superseded only where it prohibits code creation by the plan stage; its self-contained task format
and plan-only tickets boundary remain in force.

A bounded built-in strategy matrix declares the language/file combinations for which syntax,
imports/exports, and compatibility can be verified. Unsupported combinations use an opaque
fallback that creates only safe missing placeholders, never edits or semantically validates
existing content, and marks graph connections and manifest entries as declarative/unverified.

## Consequences

- Plan, skeleton, manifest, full graph, and task graph slices derive from one model, limiting drift.
- The plan procedure gains repository inspection, model construction, multi-artifact emission, and
  materialization responsibilities.
- Language neutrality comes from contract-driven planning plus bounded built-in strategies and an
  explicit reduced-assurance fallback; generated structure and exports need not compile before task
  implementation.
- The manifest and graph require explicit schemas and versioning, while legacy plans without either
  sidecar remain valid.
