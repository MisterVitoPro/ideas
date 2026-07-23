# Changelog

## [Unreleased]

### Changed
- The interview's spec/plan/ADR output root is now auto-detect: it resolves to the project's
  existing docs directory (an artifact pass looks for a committed ideas spec under an immediate
  child's `specs/`; a conventional pass then checks `docs` > `documentation` > `doc` > `.docs` for
  a qualifying directory), falling back to `docs/` when neither pass finds a candidate. Detection
  is local filesystem reads only, resolved silently once per session with no prompt or
  configuration surface.

### Known limitations
- O1: a project whose docs live under a non-conventionally-named directory (`design/`, `wiki/`,
  `notes/`, etc.) is not auto-adopted on first use when no ideas spec exists yet under it - the
  first write still falls back to `docs/`. The only adoption path is seeding an ideas spec under
  `<dir>/specs`; once that spec is committed, the next run's artifact pass finds it and resolves
  to `<dir>/` instead.

## [0.7.1] - 2026-07-20

### Changed
- The "Execute with plan-runner" option at the plan completion gate (and the tickets execution
  re-offer) no longer invokes `plan-runner:run` inside the same session. It now instructs the
  user to run `/clear` first and prints the exact command to paste afterwards
  (`/plan-runner:run <plan file>` in Claude Code, `$plan-runner:run <plan file>` in Codex), so
  plan-runner starts with a fresh context and only the plan file it needs.

## [0.7.0] - 2026-07-14

### Added
- Codex plugin manifest and catalog-ready interface metadata for all three Ideas skills.
- Dual-client validation in CI, including synchronized manifest/package versions and Codex-safe
  skill frontmatter.

### Changed
- Skills now use host-neutral structured-question and skill-invocation wording, resolve bundled
  references relative to their skill directories, and load the auditor/critic definitions into
  subagents explicitly so the review gate works in both Claude Code and Codex.
- README installation and invocation examples now cover both clients.

## [0.6.0] - 2026-07-12

### Added
- `/ideas:plan` completion gate: once the plan file is written (or on re-entry, resumed), one
  AskUserQuestion offers up to five options in order - "Execute with plan-runner" (shown and
  recommended only when `plan-runner:run` is available in the session), "Run inline", "Run with
  subagents", "Create GitHub tickets" (shown only when the repo has a GitHub remote and `gh` is on
  PATH), and "Stop here"; an empty answer is always treated as "Stop here", never as consent to
  execute.
- Two execution modes (inline, subagents), documented in `skills/plan/references/execution.md`:
  both use the `exec(<slug>-tNN): <title>` commit convention, one commit per task, staging only
  that task's owned files.
- Resume: done-ness for a task is computed from a matching `exec()` commit whose title exactly
  matches the current plan (or, when git is absent, from its Verification command passing) so a
  re-run skips already-completed tasks instead of redoing them.
- `/ideas:plan` re-entry check: if a plan file already exists for a spec, one AskUserQuestion asks
  "Resume remaining tasks" or "Regenerate plan" before any regeneration, instead of silently
  re-running emission.
- `/ideas:tickets` execution re-offer: when invoked from the completion gate (not standalone), it
  presents the same execution options minus "Create GitHub tickets" itself, exactly once, right
  after its emission report.

### Changed
- Interview review gate default flipped: "Approve + generate plan" is now the recommended,
  first-listed option (plain "Approve" remains available); it completes approval identically, then
  runs `/ideas:plan` in the same session.

## [0.5.0] - 2026-07-12

### Added
- Plan stage: `/ideas:plan` writes a canonical Contracts+ plan file (`docs/plans/YYYY-MM-DD-<slug>.plan.md`) from an approved spec - flat ordered task list, stable `<slug>-tNN` task IDs, full EARS criterion text, verification commands, non-goals, and blocked-by edges - accepted by `/plan-runner:run` unchanged.
- `/ideas:tickets` projects a plan file to GitHub as agent-agnostic issues behind a Definition-of-Ready gate: one parent tracking issue plus one labeled, linked sub-issue per exported task, using only the `gh` CLI with no tokens stored in files; re-runs upsert via an in-body task-ID marker rather than GitHub search.

### Changed
- The interview's "Approve + generate plan" gate now routes into `/ideas:plan`; the standalone `--plan-runner <spec-path>` flag is retired in favor of running `/ideas:plan` directly.

## [0.4.0] - 2026-07-12

### Added
- Spec template v2: two mandatory sections - `## Architecture & components` (component names, one-line responsibilities, and interface boundaries; at least one data-flow line at L scope, "None" allowed at S) and `## Verification strategy` (each acceptance-criteria group tagged unit, integration, or manual) - plus a `### Non-functional requirements` subsection numbered in the shared requirement sequence. Both new sections follow the honesty-section rule: structurally mandatory at every scope.
- Review gate-2 digest: the receipt shows the spec's Goals bullets and numbered requirement titles capped at 12 lines total, appending "+N more in the file" on overflow, and never echoes the full spec body.
- Auditor scope-creep verdict: unbacked violations now carry a `classification` field valued `feature` (adds capability or user-visible surface) or `parameter` (fills in a value for something already decided); unclassifiable claims default to `feature`, Verification strategy tags are always `parameter`, and a new `confirm-or-remove` suggested_fix routes feature-classified claims to the gate as "unrequested - confirm or remove".
- Verification standing probe (unit/integration/manual split, harness, fixtures) added to `question-craft.md` to give the Verification strategy section a ledger source.

## [0.3.2] - 2026-07-12

### Removed
- Design spec documents removed from the shipped tree (docs/specs/); they remain in git history (tag v0.3.1) and the README no longer references them.

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
