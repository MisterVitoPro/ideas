# Plan-generated code skeleton and dependency graph - implementation plan

Goal: Make every newly generated implementation plan materialize a safe structural code skeleton and a typed machine-readable dependency graph while preserving plan-only downstream compatibility.
Source spec: docs/specs/2026-08-14-plan-skeleton-and-graph.md
Skeleton manifest: docs/plans/2026-08-14-plan-skeleton-and-graph.skeleton.json
Dependency graph: docs/plans/2026-08-14-plan-skeleton-and-graph.graph.json
Flagged constraints (unconfirmed):
- A1: Sidecars use `<plan-stem>.skeleton.json` and `<plan-stem>.graph.json` beside the canonical plan.
- A2: Both JSON formats begin at integer `schemaVersion: 1`.
- A3: A supported existing path is compatible only when a built-in strategy verifies the planned node and connections without replacing content; unsupported existing content is opaque/declarative, untouched, and never claimed as verified.
- A4: Plan headers use `Skeleton manifest:` and `Dependency graph:`; task sections use `Graph context:`.
- A5: Canonical plans remain under `<root>/plans/`.
- A6: The skeleton manifest records the related plan identity.
- A7: Complete preflight reports every detected conflict in one failure.
- A8: Plan re-entry retains the existing resume/regenerate gate.
- A9: Offline behavior introduces no network interface.
- A10: Unit tests cover criteria 4-6 and 14; integration covers criteria 1-3 and 7-13 plus all consumers; cross-client contracts cover criteria 7, 12, 13, and 16; manual smoke covers criteria 1, 7, 12, and 15 through one downstream path.
- A11: Preserve behavior outside the plan-generation delta and update README, changelog, plan-format/reference docs, smoke protocol, and ADR links.
- A12: Release runs the complete Node suite, both plugin validators, and the Codex skill validator, with synchronized versions ready for an immutable tag.

### Task 1: Establish the plan-native artifact-bundle walking skeleton
Task ID: plan-skeleton-and-graph-t01
Owned files: skills/plan/SKILL.md, skills/plan/references/task-format.md, skills/plan/references/artifact-bundle.md, tests/plan.test.js
Interfaces: consumes the approved spec and ADR-0008/ADR-0009; produces the canonical bundle procedure, plan-header sidecar references, ten-field task contract, and orchestration hooks consumed by Tasks 2-6
Graph context: owns plan-skill, task-format, artifact-bundle, and plan-contract-test nodes; produces bundle-contract and task-graph-slice contracts; depends on no implementation task
Acceptance criteria:
- WHEN a new implementation plan is generated THEN THE SYSTEM SHALL define one plan-native model and create the canonical plan, planned skeleton, skeleton manifest, and typed graph before presenting the completion gate.
- WHEN companion artifacts are emitted THEN THE SYSTEM SHALL write adjacent version-1 JSON manifest and graph files and reference them with `Skeleton manifest:` and `Dependency graph:` header fields.
- WHEN the shared task format is updated THEN THE SYSTEM SHALL add `Graph context:` after `Interfaces:` while retaining every existing field, stable task IDs, flat ordering, file isolation, full EARS text, and plan-runner compatibility.
- WHEN a task contract is rendered THEN THE SYSTEM SHALL include a self-contained graph slice for its owned, consumed, and produced nodes and relevant dependency edges.
- WHEN artifacts are emitted THEN THE SYSTEM SHALL derive the plan, manifest, graph, skeleton, and task slices from one normalized model rather than inferring one written artifact from another.
- WHEN plan generation is re-entered THEN THE SYSTEM SHALL retain the existing resume/regenerate gate and SHALL NOT silently regenerate an existing plan bundle.
Verification: `node --test tests/plan.test.js`
Non-goals:
- Does not define JSON schema internals or graph projection algorithms (Task 2).
- Does not define language syntax strategies or the opaque fallback (Task 3).
- Does not implement transactional filesystem mutation (Task 4).
- Does not alter downstream execution or tickets behavior (Task 5).
Blocked by: none
Constraints: This is the walking skeleton and owns every shared hotspot file. Keep `skills/plan/SKILL.md` within its existing 150-line budget by lazy-linking detailed procedures. Task bodies remain contracts rather than implementation code even though plan generation now materializes separate skeleton files. Use host-neutral Claude `/ideas:plan` and Codex `$ideas:plan` invocation wording.

### Task 2: Define the versioned graph, manifest, and projection contracts
Task ID: plan-skeleton-and-graph-t02
Owned files: skills/plan/references/graph-schema.json, skills/plan/references/skeleton-schema.json, skills/plan/references/graph-projection.md, tests/graph-projection.test.js
Interfaces: consumes bundle-contract and task-graph-slice contracts from Task 1; produces version-1 JSON schemas and a deterministic full-graph-to-task-slice projection contract consumed by Tasks 4-6
Graph context: owns graph-schema, skeleton-schema, graph-projector, and graph-projection-test nodes; consumes bundle-contract from plan-skeleton-and-graph-t01; produces graph-v1, skeleton-v1, and projected-task-context contracts
Acceptance criteria:
- WHEN the full graph validates THEN THE SYSTEM SHALL accept typed task, file/module, and public-contract nodes plus owns, depends-on, imports, exports, produces, and consumes edges.
- WHEN an import, export, or public-contract connection is represented THEN THE SYSTEM SHALL mark its assurance as syntactically verified or declarative/unverified.
- WHEN the skeleton manifest validates THEN THE SYSTEM SHALL record `schemaVersion: 1`, the related plan identity, every planned path, and each path's created, verified-compatible, or opaque-preserved classification.
- WHEN graph projection runs THEN THE SYSTEM SHALL include each task's owned, consumed, and produced nodes and relevant dependency edges in its self-contained `Graph context:` field.
- IF an edge references a missing node, a task references an unowned planned file, a node ID is duplicated, or an assurance value is invalid THEN THE SYSTEM SHALL reject the graph with a validation error naming the offending identity.
- WHEN plan, manifest, graph, skeleton, and slices are emitted THEN THE SYSTEM SHALL preserve stable task IDs and derive every cross-artifact identity from the same normalized model.
Verification: `node --test tests/graph-projection.test.js`
Non-goals:
- Does not choose or implement language-specific syntax rules.
- Does not mutate repository source files.
- Does not modify the plan orchestration or task-format hotspot files owned by Task 1.
- Does not change downstream consumer routing.
Blocked by: plan-skeleton-and-graph-t01
Constraints: JSON schemas must be valid draft-2020-12 schemas without external network resolution. Projection wording must be deterministic, host-neutral, and compact enough for task contracts. Sidecars are optional for legacy plans but required for newly generated bundles.

### Task 3: Specify bounded syntax strategies and the opaque fallback
Task ID: plan-skeleton-and-graph-t03
Owned files: skills/plan/references/syntax-strategies.md, test-fixtures/skeleton-strategies.json, tests/syntax-strategies.test.js
Interfaces: consumes graph-v1 and skeleton-v1 assurance contracts from Task 2; produces a bounded built-in language/file strategy matrix and unsupported-file fallback contract consumed by Task 4
Graph context: owns syntax-strategy-matrix, strategy-fixtures, and strategy-contract-test nodes; consumes assurance-classification from plan-skeleton-and-graph-t02; produces verified-strategy and opaque-fallback contracts
Acceptance criteria:
- WHEN a language/file combination is listed as supported THEN THE SYSTEM SHALL document exact safe placeholder, import/export, compatibility, and non-replacement rules and SHALL pair that matrix row with a fixture.
- WHEN a supported existing path is classified as compatible THEN THE SYSTEM SHALL require its built-in strategy to verify the planned node and required connections without replacing existing content.
- WHEN a language/file combination is unsupported THEN THE SYSTEM SHALL allow only safe missing-placeholder creation, SHALL NOT edit or semantically validate existing content, and SHALL classify its connections as declarative/unverified.
- WHEN the repository contains supported, mixed, or unsupported language/file combinations THEN THE SYSTEM SHALL select strategies per path and SHALL NOT require a project-specific generator or network access.
- WHEN generated placeholders do not yet build or type-check THEN THE SYSTEM SHALL allow structural generation to succeed if every assurance classification is honest and schema-valid.
- WHEN strategy verification runs THEN THE SYSTEM SHALL exercise supported, mixed-language, and unsupported fixtures and SHALL fail any strategy row that lacks its exact fixture contract.
Verification: `node --test tests/syntax-strategies.test.js`
Non-goals:
- Does not promise build or type-check success.
- Does not create an open-ended adapter framework or accept target-repository plugins.
- Does not edit existing unsupported files.
- Does not perform filesystem transactions.
Blocked by: plan-skeleton-and-graph-t01, plan-skeleton-and-graph-t02
Constraints: The checked-in matrix is the complete verified support claim; combinations absent from it always use the opaque fallback. Keep the fallback safe, explicit, and lower-assurance rather than guessing syntax. Use only local repository context.

### Task 4: Implement transactional skeleton materialization
Task ID: plan-skeleton-and-graph-t04
Owned files: skills/plan/references/materialization.md, skills/plan/scripts/materialize-bundle.mjs, tests/materialization.test.js
Interfaces: consumes bundle orchestration from Task 1, versioned schemas from Task 2, and syntax/fallback classifications from Task 3; produces an offline preflight/apply/rollback interface invoked by the plan stage
Graph context: owns materialization-procedure, materialize-helper, and materialization-integration-test nodes; consumes bundle-contract, graph-v1, skeleton-v1, verified-strategy, and opaque-fallback contracts; produces atomic-materialization-result
Acceptance criteria:
- WHEN materialization preflight runs THEN THE SYSTEM SHALL classify every proposed path as missing, verified-compatible, opaque-preserved, or conflicting before applying source or sidecar mutations.
- WHEN preflight finds one or more conflicts THEN THE SYSTEM SHALL report every detected conflicting path in one failure and SHALL NOT apply any skeleton or sidecar mutation.
- WHEN preflight finds verified-compatible content THEN THE SYSTEM SHALL preserve it without replacement and record its verified assurance in the manifest.
- WHEN preflight finds unsupported existing content THEN THE SYSTEM SHALL preserve it without editing or semantic validation and record it as opaque/declarative.
- WHEN apply begins THEN THE SYSTEM SHALL create only preflight-approved missing placeholders and sidecars and SHALL keep enough original-state data to reverse every applied change.
- IF materialization or sidecar emission fails after mutation begins THEN THE SYSTEM SHALL restore every modified source path and remove every skeleton or sidecar file created by the run.
- WHEN materialization is exercised in temporary repositories THEN THE SYSTEM SHALL pass missing-path, compatible-path, opaque-path, multiple-conflict, injected mid-apply failure, rollback, dirty-worktree-preservation, and idempotent re-entry cases on Windows, macOS, and Linux path semantics.
- WHILE materialization runs offline THEN THE SYSTEM SHALL use no network interface, no external package, and no project-specific generator.
Verification: `node --test tests/materialization.test.js`
Non-goals:
- Does not build, type-check, or implement generated placeholders.
- Does not overwrite incompatible or opaque existing content.
- Does not infer graph relationships by rescanning written files.
- Does not modify task contracts or downstream consumers.
Blocked by: plan-skeleton-and-graph-t01, plan-skeleton-and-graph-t02, plan-skeleton-and-graph-t03
Constraints: The helper uses only the Node standard library and a fully validated local bundle request. Resolve and verify every absolute target stays within the target repository before mutation. Stage temporary state inside a validated repository-local or OS-temporary directory, never through an unresolved broad path. Rollback must be byte-preserving for pre-existing content.

### Task 5: Preserve graph context through every plan-only consumer
Task ID: plan-skeleton-and-graph-t05
Owned files: skills/plan/references/execution.md, skills/tickets/SKILL.md, skills/tickets/references/emission.md, tests/tickets.test.js, tests/downstream-context.test.js
Interfaces: consumes the ten-field self-contained task contract from Task 1 and projected graph slices from Task 2; produces unchanged plan-only handoffs for plan-runner, inline execution, subagents, and GitHub issue projection
Graph context: owns execution-reference, tickets-skill, ticket-emission, ticket-contract-test, and downstream-context-test nodes; consumes task-graph-slice from plan-skeleton-and-graph-t01 and projected-task-context from plan-skeleton-and-graph-t02; produces plan-only-consumer-compatibility
Acceptance criteria:
- WHEN plan-runner, inline execution, subagent execution, or tickets consumes a new plan THEN THE SYSTEM SHALL provide the task's complete graph context from the Markdown task section without requiring graph or manifest sidecar access.
- WHEN inline or subagent execution constructs a task brief THEN THE SYSTEM SHALL retain the `Graph context:` field with the task's owned, consumed, produced, and dependency identities.
- WHEN tickets renders a GitHub issue THEN THE SYSTEM SHALL include `Graph context:` from the task section while continuing to read only the plan file and flagged constraints.
- WHEN tickets applies its Definition-of-Ready check THEN THE SYSTEM SHALL treat `Graph context:` as additive and SHALL retain self-containedness, full EARS text, and file-isolation requirements.
- WHEN an existing nine-field plan without sidecars or `Graph context:` is consumed THEN THE SYSTEM SHALL retain pre-feature plan-runner, inline, subagent, and tickets behavior without migration.
- IF a new task section references a sidecar instead of carrying self-contained graph context THEN THE SYSTEM SHALL fail the existing self-containedness gate rather than dereference the sidecar.
Verification: `node --test tests/tickets.test.js tests/downstream-context.test.js`
Non-goals:
- Does not make any downstream consumer parse the full graph or manifest sidecar.
- Does not change GitHub authentication, labels, sub-issue linking, or execution commit semantics.
- Does not modify the core task-format or graph projection files.
- Does not retrofit old plans with graph context.
Blocked by: plan-skeleton-and-graph-t01, plan-skeleton-and-graph-t02
Constraints: Tickets remains a one-way projection of the canonical plan under ADR-0004/ADR-0005. Preserve the plan-runner fresh-context handoff and current inline/subagent done-ness rules. Keep `skills/tickets/SKILL.md` within 150 lines by deferring details to its reference.

### Task 6: Add bundle-wide cross-client and smoke verification
Task ID: plan-skeleton-and-graph-t06
Owned files: tests/bundle-contract.test.js, docs/release/plan-skeleton-graph-smoke.md
Interfaces: consumes the complete bundle, strategy, materialization, and consumer contracts from Tasks 1-5; produces a cross-client automated regression gate and operator-runnable manual smoke protocol
Graph context: owns bundle-contract-test and release-smoke nodes; consumes bundle-contract, graph-v1, skeleton-v1, verified-strategy, opaque-fallback, atomic-materialization-result, and plan-only-consumer-compatibility; produces release-verification-evidence
Acceptance criteria:
- WHILE the shared plan skill runs in Claude Code or Codex on Windows, macOS, or Linux THE SYSTEM SHALL expose the same plan, materialization, graph, task-context, and legacy-compatibility contracts with host-neutral procedure wording.
- WHILE a repository is offline or contains supported, mixed, or unsupported language/file combinations THE SYSTEM SHALL generate and verify the bundle without a network call or project-specific generator.
- WHEN the automated bundle contract suite runs THEN THE SYSTEM SHALL assert sidecar naming and versioning, graph/manifest schema links, assurance distinctions, task graph slices, atomic preflight/rollback language, legacy-plan behavior, and all four plan-only consumers.
- WHEN the manual smoke runs THEN THE SYSTEM SHALL cover new-plan bundle creation, inspection of created and opaque-preserved paths, full-graph validation, conflict refusal with no mutation, injected rollback, completion-gate routing, and one downstream execution path.
- WHEN each smoke scenario is documented THEN THE SYSTEM SHALL state setup, action, expected artifact paths and classifications, and an observable pass/fail result for both Claude Code `/ideas:plan` and Codex `$ideas:plan` invocation surfaces.
- WHEN release verification runs THEN THE SYSTEM SHALL exercise supported, mixed-language, unsupported, and legacy-plan fixtures in the specified unit, integration, cross-client, and manual split.
Verification: `node --test tests/bundle-contract.test.js` and manually complete `docs/release/plan-skeleton-graph-smoke.md`
Non-goals:
- Does not implement or modify production skill procedures.
- Does not perform the semantic version bump or marketplace release.
- Does not require a live GitHub write during the smoke protocol.
- Does not replace focused tests owned by Tasks 1-5.
Blocked by: plan-skeleton-and-graph-t01, plan-skeleton-and-graph-t02, plan-skeleton-and-graph-t03, plan-skeleton-and-graph-t04, plan-skeleton-and-graph-t05
Constraints: Contract tests use `node:test` and local fixtures only. The smoke protocol is host-neutral but names both user-facing invocation forms. Avoid assertions that merely duplicate prose without checking the cross-artifact or cross-consumer relationship.

### Task 7: Document and release the dual-client feature
Task ID: plan-skeleton-and-graph-t07
Owned files: README.md, CHANGELOG.md, .claude-plugin/plugin.json, .codex-plugin/plugin.json, package.json, tests/contract.test.js, tests/task-5.test.js, .github/workflows/validate.yml
Interfaces: consumes release-verification-evidence from Task 6 and completed behavior from Tasks 1-5; produces synchronized dual-client metadata, user-facing documentation, CI validation, and an immutable-tag-ready v0.8.0 release commit
Graph context: owns readme, changelog, claude-manifest, codex-manifest, package-metadata, contract-version-test, release-version-test, and validation-workflow nodes; consumes release-verification-evidence from plan-skeleton-and-graph-t06; produces dual-client-release-contract
Acceptance criteria:
- WHEN README documents plan creation THEN THE SYSTEM SHALL explain that new plans create the source skeleton, adjacent versioned manifest and graph, and self-contained per-task graph context, and SHALL show both Claude `/ideas:plan` and Codex `$ideas:plan` invocation forms.
- WHEN CHANGELOG is updated THEN THE SYSTEM SHALL describe default bundle generation, atomic conflict/rollback safety, verified-versus-declarative assurance, legacy-plan compatibility, and every affected execution/tickets backend under version 0.8.0.
- WHEN the plugin version changes for release THEN THE SYSTEM SHALL set `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `package.json`, the changelog heading, and the contract-test version pins to exactly `0.8.0`.
- WHEN either plugin manifest is validated THEN THE SYSTEM SHALL retain supported Codex frontmatter fields, matching plugin identity, and user-facing descriptions that accurately describe skeleton and graph generation.
- WHEN CI validation runs THEN THE SYSTEM SHALL run `node --test tests/*.test.js`, both plugin validators, and the Codex skill validator and SHALL fail if any synchronized version or validation contract diverges.
- WHEN release verification completes THEN THE SYSTEM SHALL pass every focused test from Tasks 1-6, the complete Node suite, both plugin validators, the Codex skill validator, and the manual smoke protocol.
- WHEN the release commit is ready for main THEN THE SYSTEM SHALL be suitable for an immutable plain `v0.8.0` tag and subsequent catalog pinning to that tag and commit SHA without creating or moving the tag during implementation.
Verification: `node --test tests/*.test.js`; run both plugin validators and the Codex skill validator; then complete `docs/release/plan-skeleton-graph-smoke.md`
Non-goals:
- Does not create or move the immutable release tag.
- Does not update external marketplace catalogs or perform network release operations.
- Does not change the approved spec or ADR decisions.
- Does not alter unrelated repository behavior or files.
Blocked by: plan-skeleton-and-graph-t01, plan-skeleton-and-graph-t02, plan-skeleton-and-graph-t03, plan-skeleton-and-graph-t04, plan-skeleton-and-graph-t05, plan-skeleton-and-graph-t06
Constraints: Treat 0.8.0 as the next backward-compatible feature release from 0.7.1. Keep both plugin manifests, package metadata, changelog, and every contract-test pin synchronized. Skill frontmatter remains Codex-compatible and folder names continue matching skill names. Release uses a new immutable plain `v0.8.0` tag only after merge; catalog updates remain a separate post-tag action.
