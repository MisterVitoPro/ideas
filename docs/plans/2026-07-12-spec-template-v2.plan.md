# Spec template v2 - implementation plan
Goal: Ship template v2 (Architecture & components, Verification strategy, NFR subsection), the gate-2 digest, and the auditor scope-creep verdict as ideas v0.4.0.
Source spec: docs/specs/2026-07-12-spec-template-v2.md
Flagged constraints (unconfirmed): None

### Task 1: Template v2 sections in spec-template.md
Owned files: skills/interview/references/spec-template.md
Interfaces: consumes the existing v1 template structure; produces the headings `## Architecture & components` (between Chosen approach and Data & interfaces), `## Verification strategy` (after Acceptance criteria (EARS)), and `### Non-functional requirements` (inside Requirements) that Tasks 3 and 5 depend on.
Acceptance criteria:
- WHEN a spec is drafted at any scope THE SYSTEM SHALL include the `## Architecture & components` and `## Verification strategy` headings, writing "None" when empty at S scope.
- WHEN a spec is drafted at L scope THE SYSTEM SHALL include at least one data-flow line under Architecture & components.
- WHEN acceptance criteria exist THE SYSTEM SHALL tag each criteria group unit, integration, or manual under Verification strategy.
- WHEN non-functional requirements are elicited THE SYSTEM SHALL number them in the shared requirement sequence with ledger citations.
Constraints: Architecture & components carries component names, one-line responsibilities, and interface boundaries only - no internals, no file trees beyond paths. Both new sections are mandatory at all scopes with "None" allowed at S, matching the existing honesty-section rule. Contracts-not-code discipline applies to the template prose itself: keep guidance lines short and rationale-bearing, no all-caps imperatives.

### Task 2: Review gate digest, feature-flag flow, and checkpoint component enumeration in SKILL.md
Owned files: skills/interview/SKILL.md
Interfaces: consumes the auditor violation JSON produced by Task 3 (`classification` field, `confirm-or-remove` suggested_fix); produces the gate-2 presentation contract and the approach-checkpoint component enumeration that backs Architecture & components content.
Acceptance criteria:
- WHEN gate 2 is presented THE SYSTEM SHALL show the Goals bullets and numbered requirement titles capped at 12 lines, appending "+N more in the file" on overflow, and SHALL NOT echo the full spec body.
- IF the auditor finds an unbacked claim that adds capability or surface THEN THE SYSTEM SHALL present it in the gate-2 call as "unrequested - confirm or remove" and record the disposition in the ledger.
- WHEN more than 3 features are flagged THE SYSTEM SHALL resolve the remainder in exactly one follow-up AskUserQuestion call.
Constraints: All additions live inline in the Review gate and Approach checkpoint sections - no new reference files. SKILL.md stays at or under its 150-line budget (the additions are budgeted at ~6-10 lines). The approach-checkpoint prose must require enumerating the chosen approach's components so the checkpoint's decided ledger row backs the spec's Architecture & components section.

### Task 3: Auditor classification verdict in spec-auditor.md
Owned files: agents/spec-auditor.md
Interfaces: consumes the drafted spec and ledger as today; produces the extended violation JSON `{"claim", "location", "reason": "unbacked | missing-row", "classification": "feature | parameter", "suggested_fix": "demote to Assumptions | add to Open questions | confirm-or-remove"}` consumed by Task 2's gate flow, with `classification` present on `unbacked` violations.
Acceptance criteria:
- IF the auditor finds an unbacked claim that fills in a value THEN THE SYSTEM SHALL demote it to Assumptions as in v1.
- IF the auditor cannot classify an unbacked claim THEN THE SYSTEM SHALL classify it as feature.
- WHEN the auditor reports an unbacked violation THE SYSTEM SHALL include a `classification` field valued `feature` or `parameter` in the violation object.
- WHEN the auditor evaluates Architecture & components content THE SYSTEM SHALL treat claims tracing to the approach-checkpoint decided row or linked ADRs as backed.
- WHEN the auditor classifies Verification strategy tags THE SYSTEM SHALL classify them as parameter, never feature.
Constraints: The agent stays read-only (Read, Grep, Glob) and isolated from conversation context. The existing rules - report every violation, never soften findings, orchestrator applies fixes - are preserved verbatim. `feature` means the claim adds capability or user-visible surface; `parameter` means it fills in a value for something already decided.

### Task 4: Verification standing probe in question-craft.md
Owned files: skills/interview/references/question-craft.md
Interfaces: consumes the existing Standing probes section; produces the elicitation source for Verification strategy content that Task 1's section depends on.
Acceptance criteria:
- WHEN acceptance criteria exist THE SYSTEM SHALL tag each criteria group unit, integration, or manual under Verification strategy.
Constraints: Add one Verification standing probe ("unit/integration/manual split, harness, fixtures?") alongside the existing Lifecycle, Non-functionals, and Interfaces probes. No new taxonomy category and no extra AskUserQuestion calls - the probe rides existing waves. The criterion above is satisfied jointly with Task 1; this task's deliverable is the probe line that gives the section a ledger source.

### Task 5: Contract-test pins and v0.4.0 four-place release bump
Owned files: tests/contract.test.js, .claude-plugin/plugin.json, package.json, CHANGELOG.md, README.md
Interfaces: consumes the headings produced by Task 1, the SKILL.md phrases produced by Task 2, and the auditor contract produced by Task 3; produces the release artifacts.
Acceptance criteria:
- WHEN v0.4.0 ships THE SYSTEM SHALL pass contract tests pinning the new headings, the digest cap, and the classification contract, with the version bumped in all four places.
Constraints: New pins cover at minimum: the `## Architecture & components`, `## Verification strategy`, and `### Non-functional requirements` headings in the template; the 12-line digest cap phrase and "+N more in the file" in SKILL.md; the `classification` field, feature/parameter values, ambiguous-defaults-to-feature rule, and `confirm-or-remove` in spec-auditor.md; SKILL.md line count <= 150. Version bumped in plugin.json, the contract-test version pin, package.json, and CHANGELOG.md (four-place protocol). README updated where it describes the template's sections. All tests run under `node --test`.

### Task 6: Dogfood release gate
Owned files: docs/ (dogfood spec and ledger output paths only; no source files)
Interfaces: consumes the completed Tasks 1-5; produces the release evidence for v0.4.0.
Acceptance criteria:
- WHEN v0.4.0 ships THE SYSTEM SHALL have completed one live dogfood interview whose output spec contains the v2 sections.
- WHEN the pre-release dogfood interview runs THE SYSTEM SHALL run at M or L scope and its audit SHALL yield zero feature-classified violations originating from the Architecture & components or Verification strategy sections.
Constraints: This task is interactive and release-blocking: it requires a human answering a real /ideas:interview run at M or L scope and cannot be completed by a non-interactive dev agent. Execute it after Tasks 1-5 land, in a live session; if run under plan-runner, the dev agent's deliverable is limited to verifying Tasks 1-5 are consistent and documenting that the interactive gate remains open, without marking the release complete.
