# Changelog

## [0.3.1] - 2026-07-12

### Changed
- README: new "How it fits with plan-runner" section - ideas is the pipeline front door, not a plan-runner replacement; the run/pr migration remains a 0.4.x roadmap item.

## [0.3.0] - 2026-07-11

### Added
- Elicitation floor v2: the floor is now a category-coverage gate - every ambiguity-taxonomy category needs a `decided` row or an explicit waiver before the approach checkpoint, gap waves sweep breadth before depth, and the chronic blind spots (Non-functionals, Lifecycle, Interfaces) are weighted first. The review receipt always names unprobed categories ("Not probed: ..." or "all categories probed").
- Existing-system baseline: brownfield interviews establish language/runtime, current behavior, integrated services, and existing data from the repo before drafting; greenfield is now a claim the user confirms, not a default the model assumes.
- Round-trip rule: every concrete requirement stated in the user's idea lands in the ledger and spec, satisfied or explicitly cut with confirmation - never silently dropped.
- Binding defaults: the spec template's Assumptions mechanism goes two-tier - low-cost, reversible unknowns become a binding default welded into a matching EARS criterion; high-cost or irreversible unknowns escalate to blocking Open questions instead.
- Collision rule: an assumed ledger row touching a stated hard constraint is never self-adjudicated - it returns to the user at the next gate.
- Definition of done and constraint-conflict check added to the spec template; standing probes (Lifecycle, Non-functionals, Interfaces surface inventory) and interviewing rules (one requirement type per question, paraphrase-before-binding) added to `question-craft.md`.
- Gate-turn trim: the critic's biggest miss and mitigations are presented verbatim at the review gate; the full rationale stays in the ledger rather than the chat surface.

Evidence: ideas-bench `docs/pilot2-2026-07-11-report.md` and its tier-D failure analysis - 15 of 22 build failures traced to facts that were never elicited or were self-adjudicated instead of confirmed by the user; misses concentrated in Lifecycle (67%), Non-functionals (63%), and Interfaces (48%).

## [0.2.3] - 2026-07-10

### Fixed
- Token-cost discipline, from benchmark pilot measurements (ideas-bench docs/pilot-2026-07-10-report.md): ledger updates are now targeted appends anchored on section headings (wholesale rewrites every wave were the dominant per-session token cost); wave prose stays lean; the review gate presents the receipt and critic callout without echoing the spec body. No behavioral change to the interview's questions, honesty rules, or artifacts.

## [0.2.2] - 2026-07-10

### Fixed
- Elicitation floor: before the approach checkpoint the interview sweeps the question-craft ambiguity taxonomy against the ledger and spends up to two extra gap waves (within the 5-call cap) on unprobed categories with plausible bearing on the idea. Added after the benchmark's first live run (ideas-bench docs/smoke-2026-07-10-s01.md) showed an interview closing with most critical facts unasked - flagged as assumptions instead of asked. Draft-now/cap-exhausted paths now name the categories left unprobed in the review receipt.

## [0.2.1] - 2026-07-10

### Changed
- Extracted the benchmark harness to its own repo, [ideas-bench](https://github.com/MisterVitoPro/ideas-bench)
  (full history preserved), so the installed plugin ships lean. The harness (6-pilot-scenario
  paired simulated-user benchmark vs `superpowers:brainstorming`, tier A/B/C metrics, exact
  paired statistics, pre-declared success bar) was developed in this repo between v0.2.0 and
  this release; no plugin behavior changed.

## [0.2.0] - 2026-07-09

### Added
- Plan adapter (spec: docs/specs/2026-07-09-plan-runner-adapter.md, ADRs 0001-0002): "Approve + generate plan" review-gate option and `--plan-runner <spec-path>` standalone re-entry. Emits a single plan-runner-ready plan file (flat task list, full EARS criterion text - never bare reference numbers, confirm-or-carry header for unresolved assumptions), written to docs/plans/ and committed git-gated. Refuses specs without acceptance criteria and plans with reference-only criteria.

## [0.1.0] - 2026-07-09

### Added
- Initial release: `/ideas:interview` skill (scope-sized interview, three-status ledger, ledger audit, biggest-miss critic, EARS spec output).
- Read-only pipeline agents `ideas:spec-auditor` and `ideas:spec-critic`.
- Contract tests and trigger-query fixtures.
