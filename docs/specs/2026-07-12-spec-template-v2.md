# Spec template v2 - design spec
Date: 2026-07-12 | Status: approved | Author: MisterVitoPro

## Problem
Comparison against superpowers:brainstorming and the plugin's original design research showed the v1 spec template has no home for architecture and component boundaries, no testing-strategy contract, and no dedicated place for non-functional requirements; gate 2 asks for approval on a receipt without showing any spec content; and the auditor silently demotes scope creep to Assumptions instead of putting it in front of the user. (ledger 1)

## Existing system
Claude Code plugin `ideas` v0.3.2, Node-based contract tests (`node --test`). The template lives at `skills/interview/references/spec-template.md`; the review gate in `skills/interview/SKILL.md` (~119 of a 150-line budget) presents a receipt and critic callout, never spec content; `agents/spec-auditor.md` returns `{"violations": [{claim, location, reason, suggested_fix}], clean}` and every unbacked claim is demoted to Assumptions. `tests/contract.test.js` pins template headings and SKILL.md phrases. When the audit cannot run, SKILL.md presents the spec with an explicit "unaudited" banner. Releases follow the four-place bump protocol (plugin.json, contract-test pin, package.json, CHANGELOG.md). ADR-0001/0002 are unaffected.

## Goals
- The template gains contract-level Architecture & components and Verification strategy sections and a Non-functional requirements subsection. (ledger 1, 6, 7, 11)
- Gate 2 shows a capped content digest alongside the receipt, without echoing the full spec. (ledger 8)
- The auditor distinguishes unrequested features from parameter defaults, and features are confirmed or removed by the user at gate 2. (ledger 9, 14)
- Ships as v0.4.0 with contract-test pins and a live dogfood run. (ledger 3, 12)

## Non-goals
- Visual companion or mockup support - standing v1 non-goal, unchanged by this work; no conflict with the critical constraints. (ledger 1)
- Migration or regeneration of pre-v2 specs - they remain valid v1 artifacts; conflicts with no constraint since consumers accept both. (ledger 5)
- Splitting the template and behavioral changes into separate releases - the decided release shape is a single v0.4.0 minor. (ledger 3)
- New lazy reference files for gate behavior - rejected against the line-budget constraint, which the inline change respects. (ledger 10)

## Users / consumers
The interview skill's draft step, `ideas:spec-auditor`, the plan adapter (`references/plan-adapter.md`), and the human reviewer at gate 2. (ledger 13)

## Requirements
1. ADDED - `skills/interview/references/spec-template.md` gains `## Architecture & components` between Chosen approach and Data & interfaces: component names, one-line responsibilities, and interface boundaries between components; no internals, no file trees beyond paths. At L scope it also carries at least one data-flow line. Mandatory at all scopes; "None" allowed at S. (ledger 4, 6)
2. ADDED - the template gains `## Verification strategy` after Acceptance criteria (EARS): one line per criteria group tagging it unit, integration, or manual, naming fixtures or harness where needed. Mandatory at all scopes; "None" allowed at S. (ledger 4, 7)
3. MODIFIED - the template's Requirements section gains a `### Non-functional requirements` subsection whose entries continue the shared requirement numbering, cite ledger rows, and are EARS-checkable - one requirement regime. (ledger 11)
4. MODIFIED - SKILL.md's Review gate presents a digest with the receipt and critic callout: the spec's Goals bullets verbatim plus numbered requirement titles only, hard-capped at 12 lines, then "+N more in the file". Echoing the full spec body remains forbidden. The change lives inline in the Review gate section within the 150-line budget. (ledger 8, 10)
5. MODIFIED - `agents/spec-auditor.md` classifies each unbacked claim as `feature` (adds capability or surface) or `parameter` (fills in a value). Parameters demote to Assumptions as in v1; features surface at gate 2 as "unrequested - confirm or remove", riding the gate-2 AskUserQuestion call as extra questions (max 3; overflow resolved in one follow-up call), with each disposition recorded in the ledger. Backing rules for the new sections: Architecture & components content traces to the approach-checkpoint decided row and linked ADRs; Verification strategy tags are classifications of existing decided criteria and default to `parameter`, never `feature`. (ledger 9, 14, 15; ADR-0003)
6. MODIFIED - `tests/contract.test.js` pins the two new template headings, the NFR subsection heading, the 12-line digest cap phrase, and the auditor classification contract. (ledger 12)
7. MODIFIED - release as v0.4.0 via the four-place bump protocol. (ledger 3, 12)
8. ADDED - one live dogfood interview producing a v2-format spec runs before release. The run is M or L scope, and its audit pass yields zero feature-classified violations originating from the Architecture & components or Verification strategy sections - a release-blocking check. (ledger 12, 17)
9. MODIFIED - `skills/interview/references/question-craft.md` gains a Verification standing probe ("unit/integration/manual split, harness, fixtures?") alongside the existing Lifecycle and Non-functionals probes, and SKILL.md's approach checkpoint enumerates the chosen approach's components so its decided row backs Architecture & components. No extra AskUserQuestion calls. (ledger 16)

### Non-functional requirements
10. SKILL.md stays at or under its 150-line budget after the Review gate additions (~6-10 lines). (ledger 10)
11. The gate-2 digest adds at most 12 lines of chat surface per review round. (ledger 8)

## Chosen approach
Same-call gate integration of feature flags (Approach A), chosen over a dedicated pre-gate resolution wave (extra call per dirty run) and receipt-only flagging (silent consent by another name). See `docs/adr/0003-auditor-classification-verdict.md`. (ledger 14)

## Data & interfaces
- Template headings, verbatim: `## Architecture & components`, `## Verification strategy`, `### Non-functional requirements`.
- Auditor violation object, extended: `{"claim", "location", "reason": "unbacked | missing-row", "classification": "feature | parameter", "suggested_fix": "demote to Assumptions | add to Open questions | confirm-or-remove"}`; `classification` appears on `unbacked` violations. (ledger 18)
- Gate-2 digest format: Goals bullets verbatim, then `N. <requirement title>` lines; on overflow, final line `+N more in the file`. (ledger 8)

## Edge cases & error handling
- Empty Architecture, Verification strategy, or NFR content at S scope: section present with "None" - decided. (ledger 4)
- Digest source sections longer than 12 lines: truncate with "+N more in the file" - decided. (ledger 8)
- Auditor cannot decide feature vs parameter: classify as feature so it surfaces to the user - decided. (ledger 19)
- More than 3 flagged features: overflow resolved in one follow-up AskUserQuestion call - decided. (ledger 14)
- Auditor fails to run: existing "unaudited" banner behavior, unchanged. (existing system)

## Acceptance criteria (EARS)
1. WHEN a spec is drafted at any scope THE SYSTEM SHALL include the `## Architecture & components` and `## Verification strategy` headings, writing "None" when empty at S scope.
2. WHEN a spec is drafted at L scope THE SYSTEM SHALL include at least one data-flow line under Architecture & components.
3. WHEN acceptance criteria exist THE SYSTEM SHALL tag each criteria group unit, integration, or manual under Verification strategy.
4. WHEN non-functional requirements are elicited THE SYSTEM SHALL number them in the shared requirement sequence with ledger citations.
5. WHEN gate 2 is presented THE SYSTEM SHALL show the Goals bullets and numbered requirement titles capped at 12 lines, appending "+N more in the file" on overflow, and SHALL NOT echo the full spec body.
6. IF the auditor finds an unbacked claim that adds capability or surface THEN THE SYSTEM SHALL present it in the gate-2 call as "unrequested - confirm or remove" and record the disposition in the ledger.
7. IF the auditor finds an unbacked claim that fills in a value THEN THE SYSTEM SHALL demote it to Assumptions as in v1.
8. IF the auditor cannot classify an unbacked claim THEN THE SYSTEM SHALL classify it as feature.
9. WHEN the auditor reports an unbacked violation THE SYSTEM SHALL include a `classification` field valued `feature` or `parameter` in the violation object.
10. WHEN more than 3 features are flagged THE SYSTEM SHALL resolve the remainder in exactly one follow-up AskUserQuestion call.
11. WHEN v0.4.0 ships THE SYSTEM SHALL pass contract tests pinning the new headings, the digest cap, and the classification contract, with the version bumped in all four places.
12. WHEN v0.4.0 ships THE SYSTEM SHALL have completed one live dogfood interview whose output spec contains the v2 sections.
13. WHEN the auditor evaluates Architecture & components content THE SYSTEM SHALL treat claims tracing to the approach-checkpoint decided row or linked ADRs as backed.
14. WHEN the auditor classifies Verification strategy tags THE SYSTEM SHALL classify them as parameter, never feature.
15. WHEN the pre-release dogfood interview runs THE SYSTEM SHALL run at M or L scope and its audit SHALL yield zero feature-classified violations originating from the Architecture & components or Verification strategy sections.

## Verification strategy
None - this section arrives with v2; for this spec itself, criteria 1-4, 9, and 11 are unit-checkable via contract tests against the prose files; criteria 5-8, 10, 13, and 14 are integration-checked by the dogfood run (ledger 12); criteria 12 and 15 are manual sign-off on the dogfood output as the release gate.

## Assumptions (unconfirmed)
None - former binding defaults A1 (auditor JSON field encoding) and A2 (ambiguous classifications resolve to feature) were confirmed as decided at the plan adapter. (ledger 18, 19)

## Open questions
None.

## Definition of done
- Tests written and passing (`node --test`, including new pins).
- Existing behavior preserved outside the described change - v1 specs still audit cleanly; clean runs see no new gate calls.
- Stated platform, runtime, and environment floors honored (Node contract tests, Claude Code plugin layout).
- No new network calls unless specified in Data & interfaces (none are).
- Docs updated where user- or operator-visible behavior changed (README template description, CHANGELOG).
- Every acceptance criterion above passes.
