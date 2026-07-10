# Changelog

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
