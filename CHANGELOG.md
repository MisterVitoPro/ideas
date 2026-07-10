# Changelog

## Unreleased (dev)

### Added
- `bench/` (dev tooling, not plugin payload -- no version bump): the paired, blind,
  simulated-user benchmark harness comparing `/ideas:interview` against
  `superpowers:brainstorming` (design spec section 13). Scenario corpus (6 pilot
  scenarios), simulated-user + conversation driver, tier A/B/C metrics (deterministic
  cost/burden, judge-scored elicitation vs. ground truth, masked order-swapped spec
  quality with anchored 1-5 rubrics), paired statistics (exact Wilcoxon signed-rank,
  exact binomial), and an orchestrator CLI (`node bench/run.js run|score|report`) with a
  paired-table report generator, a pre-declared PASS/FAIL/INSUFFICIENT-DATA success bar,
  and a mandatory Caveats section. Tier D (downstream execution) is a documented manual
  procedure, not automated. See `bench/README.md`.

## [0.2.0] - 2026-07-09

### Added
- Plan adapter (spec: docs/specs/2026-07-09-plan-runner-adapter.md, ADRs 0001-0002): "Approve + generate plan" review-gate option and `--plan-runner <spec-path>` standalone re-entry. Emits a single plan-runner-ready plan file (flat task list, full EARS criterion text - never bare reference numbers, confirm-or-carry header for unresolved assumptions), written to docs/plans/ and committed git-gated. Refuses specs without acceptance criteria and plans with reference-only criteria.

## [0.1.0] - 2026-07-09

### Added
- Initial release: `/ideas:interview` skill (scope-sized interview, three-status ledger, ledger audit, biggest-miss critic, EARS spec output).
- Read-only pipeline agents `ideas:spec-auditor` and `ideas:spec-critic`.
- Contract tests and trigger-query fixtures.
