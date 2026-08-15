# Plan-generated code skeleton and dependency graph - design spec

Date: 2026-08-14  
Status: Approved  
Author: Ideas interview

## Problem

The current implementation plan describes owned files, interfaces, criteria, and task ordering,
but executors still begin by creating the shared code structure and reconstructing how tasks,
files, and contracts connect. For a large plan, that delays independent work and invites different
executors to infer different architecture. Plan creation must materialize the whole structural
skeleton and a machine-readable graph before any execution mode begins. (ledger 1, 2, 12)

## Existing system

Ideas is a brownfield, dual-client Claude Code and Codex plugin whose procedures are defined by
Markdown skills. The plan skill reads an approved spec and emits one canonical Markdown plan with
a flat task list, stable task IDs, owned files, interfaces, full EARS criteria, verification,
non-goals, constraints, and blocked-by edges. Task 1 is a walking skeleton, but the plan stage does
not create source code; executors create all code later. Plan-runner, inline execution, subagent
execution, and the tickets projection consume self-contained task contracts from the plan. No
skeleton manifest or machine-readable architecture graph exists today. ADR-0001 keeps the plan
canonical, while ADR-0005 currently prohibits plan-stage code bodies. (ledger 3, 5, 6)

## Goals

- Materialize the planned file and export skeleton while creating a new implementation plan.
  (ledger 1, 3, 8)
- Give independent executors their ownership and dependency context before implementation begins.
  (ledger 9, 12, 15)
- Emit a typed, machine-readable graph and skeleton manifest that stay consistent with the
  canonical plan. (ledger 4, 9, 11, 17)
- Protect existing repositories with complete preflight, conflict refusal, and rollback.
  (ledger 10, 14, 17)
- Preserve plan-only compatibility across every existing execution and tickets backend.
  (ledger 5, 14, 15)

## Non-goals

- Producing a Mermaid or other visual graph; the selected output is machine-readable only.
  (ledger 4)
- Guaranteeing that the generated skeleton builds or type-checks before task implementation.
  (ledger 8)
- Requiring a repository-specific generator or adapter supplied by the target project. Bounded
  built-in strategies remain allowed. (ledger 13, 17, 19)
- Retrofitting graph and manifest sidecars onto previously generated plans. Older plans remain
  valid without them. (ledger 14)
- Replacing the Markdown plan as the canonical downstream contract. (ledger 11, 15, 17)

Constraint-conflict check: richer language-specific generation could improve compile fidelity,
but it conflicts with offline, cross-language, host-neutral operation. Portability wins; the
skeleton guarantees planned structure and export connections, not compilation. (ledger 8, 13, 17)

## Users / consumers

- Plan authors using either `/ideas:plan` in Claude Code or `$ideas:plan` in Codex.
- Plan-runner, inline executors, and subagent executors starting implementation tasks.
- `/ideas:tickets` and `$ideas:tickets`, which project self-contained task contracts to GitHub.
- Repository tools that choose to read the complete graph JSON directly. (ledger 5, 13, 15, 18)

## Requirements

1. **MODIFIED - Plan generation materializes structure.** When a new plan is generated, the plan
   stage creates the planned source/configuration file skeleton and export connections before it
   presents the completion gate. (ledger 1, 3, 8)
2. **ADDED - Single plan model.** The stage derives tasks, planned files/modules, public contracts,
   stub contents, ownership, and dependency relationships as one plan-native model before emitting
   artifacts. (ledger 9, 17)
3. **ADDED - Structural completeness with assurance.** Every file represented as planned work is
   present. Connections handled by a built-in strategy are syntactically verified; unsupported
   connections are represented as declarative/unverified rather than claimed as verified. Build or
   type-check success is not a generation requirement. (ledger 8, 10, 19; assumption A3)
4. **ADDED - Companion artifacts.** Beside `<plan-stem>.plan.md`, generation writes
   `<plan-stem>.skeleton.json` and `<plan-stem>.graph.json`, both with `schemaVersion: 1`, and the
   canonical plan references both. (ledger 11; assumptions A1, A2, A4)
5. **ADDED - Typed graph.** The graph represents task, file/module, and public-contract nodes plus
   ownership, dependency, import/export, and produces/consumes edges. (ledger 9)
6. **ADDED - Skeleton inventory.** The skeleton manifest inventories every planned path and whether
   the materializer created it or preserved an already-compatible path. (ledger 1, 8, 10, 11)
7. **MODIFIED - Self-contained task contracts.** Each task contains a `Graph context:` slice with
   its owned, consumed, and produced nodes and their relevant dependency edges. (ledger 9, 15;
   assumption A4)
8. **MODIFIED - Plan-only consumers.** Plan-runner, inline execution, subagent execution, and
   tickets continue to receive all required task context from the Markdown plan and do not need to
    load either sidecar; other tools may read the full graph. (ledger 5, 15)
9. **ADDED - Built-in strategy matrix.** A bounded, documented matrix identifies the language/file
   combinations whose stub, import/export, and compatibility rules are syntactically verified.
   Each supported combination has repository fixtures. (ledger 19)
10. **ADDED - Opaque fallback.** For unsupported language/file combinations, the materializer may
    create only safe missing placeholders; it never edits or semantically validates existing
    content and records reduced assurance in the manifest and graph. (ledger 19)
11. **ADDED - Complete preflight.** Before skeleton or sidecar mutation, the materializer classifies
   every proposed path as missing, verified-compatible, opaque-preserved, or conflicting.
   (ledger 10, 17, 19; assumption A3)
12. **ADDED - Conservative preservation.** Verified-compatible existing code is preserved without content
    replacement and represented in the manifest; any path that cannot satisfy the planned node and
    connections without replacement is either opaque-preserved under the fallback or a conflict.
    (ledger 10, 19; assumption A3)
13. **ADDED - Conflict refusal.** A preflight conflict aborts skeleton and sidecar materialization
    before any of those mutations are applied and reports all detected conflicting paths.
    (ledger 10; assumption A7)
14. **ADDED - Transaction rollback.** If an apply or emission step fails after mutation begins, the
    materializer restores every applied source modification and removes every newly created
    skeleton or sidecar file. (ledger 14, 17)
15. **MODIFIED - Default and compatibility.** Skeleton and graph generation is the default for new
    plans; existing plans without sidecars remain valid input for every current backend. (ledger 14)

### Non-functional requirements

16. **Portability.** The procedure behaves consistently in Claude Code and Codex on Windows,
    macOS, and Linux and remains repository-language-neutral. (ledger 13, 18)
17. **Offline operation.** Planning, skeleton materialization, and graph emission require no network
    calls and no project-specific generator. (ledger 13)
18. **Artifact consistency.** The plan, manifest, graph, skeleton, and task graph slices are emitted
    from the same model rather than inferred from one another after writing. (ledger 17)
19. **Release verification.** Release requires schema/unit coverage, atomic-write and conflict
    integration coverage in temporary repositories, cross-client contract coverage, and a manual
    smoke run. (ledger 16)
20. **Dual-client release contract.** Skill frontmatter and procedure wording remain Codex-compatible
    and host-neutral; both plugin manifests, `package.json`, the changelog, and the contract-test
    version pin move together, and the repository-mandated tests and validators pass. (ledger 18;
    assumption A12)

## Chosen approach

Use a plan-native artifact bundle, recorded in
[ADR-0008](../adr/0008-plan-native-skeleton-bundle.md), with transactional materialization recorded
in [ADR-0009](../adr/0009-transactional-skeleton-materialization.md). Filesystem-first introspection
lost because cross-language parsing would undermine portable behavior. A language-adapter framework
as the primary architecture lost because unbounded adapter maintenance and fallback variance
conflict with the selected no-project-generator constraint; bounded built-in syntax strategies are
used only where verification is claimed. (ledger 13, 17, 19)

## Architecture & components

- **Plan Model Builder** - consumes the approved spec and repository context; produces tasks, files,
  contracts, stub contents, and typed relationships as one normalized model.
- **Syntax Strategy Matrix** - identifies the bounded language/file combinations for which stub,
  import/export, and compatibility behavior can be syntactically verified; otherwise routes to the
  opaque fallback.
- **Bundle Emitter** - consumes the normalized model; produces the canonical plan and the adjacent
  versioned skeleton-manifest and graph JSON files.
- **Transactional Materializer** - consumes proposed skeleton mutations; preflights repository paths,
  preserves verified-compatible or opaque existing code, applies safe mutations, and restores prior
  state after failure.
- **Graph Projector** - consumes the complete typed graph; validates it and emits each task's
  self-contained `Graph context:` slice into the plan model before rendering.
- **Compatibility and Verification Harness** - exercises legacy-plan compatibility, all downstream
  backends, schemas, conflicts, rollback, supported/mixed/unsupported language fixtures,
  cross-client behavior, and release smoke coverage.

Data flow: `approved spec + repository -> Plan Model Builder -> Syntax Strategy Matrix or opaque
fallback -> Graph Projector -> Bundle Emitter + Transactional Materializer -> canonical plan +
manifest + graph + source skeleton -> plan-only execution and tickets consumers`. (ledger 17, 19)

## Data & interfaces

- Canonical plan: `<root>/plans/<plan-stem>.plan.md`; its header includes `Skeleton manifest:` and
  `Dependency graph:` sibling references. (ledger 11; assumptions A4, A5)
- Skeleton manifest: adjacent `<plan-stem>.skeleton.json`, JSON object with integer
  `schemaVersion`, the related plan identity, and an inventory of planned paths classified as
  created, verified-compatible, or opaque-preserved with their assurance level. (ledger 10, 11,
  19; assumptions A1, A2, A6)
- Full graph: adjacent `<plan-stem>.graph.json`, JSON object with integer `schemaVersion`, typed node
  records, and directed typed edge records. Node kinds are task, file/module, and public contract;
  edge kinds are owns, depends-on, imports, exports, produces, and consumes; connection records
  distinguish syntactically verified from declarative/unverified assurance. (ledger 9, 11, 19;
  assumptions A1, A2)
- Task contract: the existing task section gains `Graph context:`, containing the relevant subset
  of graph nodes and edges while remaining understandable without either sidecar. (ledger 15;
  assumption A4)
- Skeleton: repository-native source/configuration paths and export connections described by the
  plan model; supported strategies may create verified connections, while the opaque fallback only
  creates safe missing placeholders. Placeholders are not required to compile. (ledger 8, 13, 19)
- No new network interface is introduced. (ledger 13; assumption A9)

## Edge cases & error handling

- Existing verified-compatible path: preserve its content, record its verified assurance, and
  connect it to the plan/graph without claiming creation. (ledger 10, 19; assumption A3)
- Existing unsupported path: preserve it without editing or semantic validation and record it as
  opaque/declarative rather than compatible. (ledger 19; assumption A3)
- Existing incompatible path: report the path and abort before skeleton/sidecar mutation. (ledger 10;
  assumption A7)
- Multiple conflicts: complete preflight and report all detected conflicting paths in one failure.
  (ledger 10, 17; assumption A7)
- Failure after apply begins: restore prior source content and remove created skeleton/sidecar files.
  (ledger 14, 17)
- Re-entry against an existing generated plan: the current resume/regenerate gate remains in force;
  an old plan without sidecars remains valid. (ledger 14; assumption A8)
- Unknown repository language or mixed-language repository: apply a built-in strategy only to
  supported combinations and route every other path through the opaque fallback; compilation may
  remain pending. (ledger 8, 13, 19)
- Offline or air-gapped repository: emit the complete bundle without network access. (ledger 13)

## Acceptance criteria (EARS)

1. WHEN a new implementation plan is generated THEN THE SYSTEM SHALL create the canonical plan,
   the planned file/export skeleton, the skeleton manifest, and the typed graph before presenting
   the completion gate.
2. WHEN the skeleton is materialized THE SYSTEM SHALL ensure every planned path is created,
   verified-compatible, or opaque-preserved, and SHALL mark each connection as syntactically
   verified or declarative/unverified.
3. WHEN generated placeholders do not yet build or type-check THEN THE SYSTEM SHALL allow plan
   generation to succeed if the structural contract is otherwise satisfied.
4. WHEN companion artifacts are emitted THEN THE SYSTEM SHALL write adjacent version-1 JSON
   manifest and graph files and reference them from the canonical plan header.
5. WHEN the full graph is validated THEN THE SYSTEM SHALL contain task, file/module, and
   public-contract nodes; ownership, dependency, import/export, and produces/consumes edges; and an
   assurance distinction between syntactically verified and declarative/unverified connections.
6. WHEN a task contract is rendered THEN THE SYSTEM SHALL include a self-contained graph slice for
   its owned, consumed, and produced nodes and their relevant dependency edges.
7. WHEN plan-runner, inline execution, subagent execution, or tickets consumes a new plan THEN THE
   SYSTEM SHALL provide all required task context from the Markdown plan without requiring sidecar
   access.
8. WHEN preflight finds one or more conflicting paths THEN THE SYSTEM SHALL report all detected
   conflicting paths and SHALL NOT apply any skeleton or sidecar mutation.
9. WHEN preflight finds existing code THEN THE SYSTEM SHALL preserve verified-compatible content,
   SHALL preserve unsupported content without editing or semantic validation, and SHALL record the
   resulting assurance classification in the manifest.
10. IF materialization or sidecar emission fails after mutation begins THEN THE SYSTEM SHALL restore
    every applied source modification and remove every skeleton or sidecar file created by the run.
11. WHEN an existing plan without graph or manifest sidecars is consumed THEN THE SYSTEM SHALL retain
    the pre-feature behavior without requiring migration.
12. WHILE running in Claude Code or Codex on Windows, macOS, or Linux THE SYSTEM SHALL apply the same
    plan, materialization, graph, and compatibility contracts.
13. WHILE the repository is offline or contains supported, mixed, or unsupported language/file
    combinations THE SYSTEM SHALL use the bounded built-in strategy matrix where applicable and the
    opaque fallback elsewhere, without network access or a project-specific generator.
14. WHEN artifacts are emitted THE SYSTEM SHALL derive the plan, manifest, graph, skeleton, and task
    slices from one plan model.
15. WHEN release verification runs THEN THE SYSTEM SHALL pass schema/unit tests,
    temporary-repository conflict and rollback integration tests, supported/mixed/unsupported
    language fixtures, cross-client contract tests, and the manual smoke run.
16. WHEN the plugin version changes for release THEN THE SYSTEM SHALL keep all repository-mandated
    version pins synchronized and pass both plugin validators, the Codex skill validator, and the
    complete Node test suite. (assumption A12)

## Verification strategy

- **Unit:** criteria 4-6 and 14; validate both versioned JSON schemas, graph node/edge integrity,
  manifest classifications, plan-header references, and per-task graph projection using fixed plan
  model fixtures. (assumption A10)
- **Integration:** criteria 1-3 and 7-13; use temporary repositories covering missing paths,
  compatible paths, multiple conflicts, injected mid-apply failures, rollback, old plans, mixed
  languages, offline operation, and all four plan-only consumers. (assumption A10)
- **Cross-client contract:** criteria 7, 12, 13, and 16; assert equivalent host-neutral skill
  wording and artifact contracts for Claude Code and Codex. (assumption A10)
- **Manual:** criteria 1, 7, 12, and 15; run the release smoke protocol from plan creation through
  skeleton inspection, graph validation, completion-gate routing, and one downstream execution path.
  (ledger 16, 18; assumption A10)

## Assumptions (unconfirmed)

- **Binding default A1:** use `<plan-stem>.skeleton.json` and `<plan-stem>.graph.json` as adjacent
  sidecar names. This is low-cost and reversible and is tested by acceptance criterion 4.
- **Binding default A2:** initialize both JSON formats at integer `schemaVersion: 1`. This is
  low-cost and reversible and is tested by acceptance criterion 4.
- **Binding default A3:** call a supported existing path compatible only when a built-in strategy
  verifies the planned node and connections without replacement; preserve unsupported existing
  content as opaque/declarative without editing or semantic validation. This conservative default
  is tested by acceptance criteria 2, 8, and 9.
- **Binding default A4:** use `Skeleton manifest:` and `Dependency graph:` in the plan header and
  `Graph context:` in each task. These labels are low-cost and reversible and are tested by
  acceptance criteria 4 and 6.
- **Binding default A5:** retain `<root>/plans/` as the canonical-plan directory. This preserves the
  existing layout and is exercised by acceptance criterion 1.
- **Binding default A6:** include the related plan identity in the skeleton manifest. This supports
  cross-artifact validation and is exercised by acceptance criterion 4.
- **Binding default A7:** report every conflict found by complete preflight in one failure. This is
  exercised by acceptance criterion 8.
- **Binding default A8:** retain the existing resume/regenerate gate on plan re-entry. This is
  exercised by acceptance criterion 11.
- **Binding default A9:** introduce no network interface. This sharpens the offline decision and is
  exercised by acceptance criterion 13.
- **Binding default A10:** allocate criteria 4-6 and 14 to fixed-fixture unit tests; criteria 1-3 and
  7-13 plus all consumers to integration fixtures; criteria 7, 12, 13, and 16 to cross-client
  contracts; and criteria 1, 7, 12, and 15 to the manual smoke ending in one execution path.
- **Binding default A11:** preserve behavior outside the plan-generation delta and update README,
  changelog, plan-format/reference documentation, release smoke protocol, and ADR links.
- **Binding default A12:** release runs the complete Node suite, both plugin validators, and the
  Codex skill validator, with the synchronized semantic version ready for an immutable tag.

## Open questions

None.

## Definition of done

- Tests are written and passing, including every verification group above.
- Existing behavior is preserved outside the described plan-generation delta. (assumption A11)
- Claude Code/Codex and Windows/macOS/Linux parity is demonstrated.
- Planning and artifact emission introduce no network calls. (assumption A9)
- README, changelog, plan format/reference documentation, release smoke protocol, and ADR links are
  updated for the new user-visible behavior. (assumption A11)
- Both plugin manifests validate, the Codex skill validator passes, and the synchronized semantic
  version is immutable-tag ready. (assumption A12)
- Every acceptance criterion above passes.
