# Plan stage - design spec
Date: 2026-07-12 | Status: approved | Author: MisterVitoPro

## Problem
An approved spec today has exactly one road to execution: the interview's plan adapter emits a plan-runner file, and everything runs in-session. There is no way to hand tasks to outside agents - Claude GitHub Action, Copilot coding agent, or a human - as GitHub issues, and the plan format carries no dependency metadata, no verification commands, and no defense against parallel agents colliding on shared files. A 20-agent research pass (superpowers writing-plans, plan-runner internals, Spec Kit/Kiro, Copilot agent-ready-issue guidance, orchestration and failure-mode literature) informed this design. (ledger 1)

## Existing system
Claude Code plugin `ideas` (branch `feat/spec-template-v2`, implementing v0.4.0), Node contract tests (`node --test tests/contract.test.js`), four-place version bump protocol. The interview skill's review gate offers "Approve + generate plan", which runs `references/plan-adapter.md`: spec to a flat ordered task list (owned files, interfaces, full EARS text, constraints - no code) written to `docs/plans/YYYY-MM-DD-<slug>.plan.md`, also reachable via `/ideas:interview --plan-runner <spec-path>`. The sibling plugin plan-runner consumes that file: its analyzer derives file-disjoint waves (max 6 agents), TDD dev/test-author agents implement, per-wave verifiers flag bugs. ADR-0001 fixed the plan as a single structured file with no pre-grouped waves; ADR-0002 made the adapter a lazy reference. (ledger 3, 5)

## Goals
- An approved spec can become a canonical implementation plan via a first-class `/ideas:plan` command, evolving the plan adapter. (ledger 3, 7)
- The same plan can be projected to GitHub as agent-agnostic issues via `/ideas:tickets`, so outside agents or humans can pull and work tasks asynchronously. (ledger 1, 4, 7)
- One backend-neutral task format renders losslessly as plan-runner input, an in-session subagent brief, or a self-contained issue body. (ledger 10, 18)
- Plans defend against parallel-agent collisions: blocked-by edges plus a walking-skeleton first task owning all hotspot files. (ledger 11)
- Ticket emission is safe to re-run: idempotent upsert, explicit partial-failure reporting, and a Definition-of-Ready gate in front of every export. (ledger 12, 13)

## Non-goals
- Status read-back or lifecycle sync in v1: emission is write-only; tracking after emission lives entirely on GitHub. No conflict with the compatibility constraint. (ledger 9)
- Two-way sync between plan file and issues - rejected as the dominant drift source; the plan file stays canonical. See ADR-0004. (ledger 6)
- Migrating plan-runner's run/pr execution engines into this plugin - they stay where they are for this release. (ledger 3)
- Vendor-specific issue fields or repo scaffolding (workflow files, issue templates, copilot-setup files): issues stay neutral, labels only. (ledger 4, 17)
- A live dogfood emission of a real plan before release - out; a throwaway scratch-repo smoke emission is in instead (see requirement 13). (ledger 14, 21)
- Pre-grouped waves in the plan file - plan-runner's analyzer owns waving (ADR-0001, unchanged). (ledger 11)

## Users / consumers
The interview skill's review gate (routes "Approve + generate plan" into `/ideas:plan`), plan-runner's analyzer and agents (consume the plan file), outside coding agents and humans (consume the GitHub issues), and the human who reviews the plan. (ledger 4, 7)

## Requirements
1. ADDED - `/ideas:plan <spec-path>`: a new command (skill `skills/plan/`) that reads an approved spec and writes the canonical plan file to `docs/plans/YYYY-MM-DD-<slug>.plan.md`, evolving the plan adapter's procedure (refuse fast without Acceptance criteria; confirm-or-carry assumptions into a "Flagged constraints (unconfirmed)" header; commit git-gated). (ledger 3, 6, 7, 22, 23)
2. ADDED - `references/task-format.md`, shared by both commands, defining the Contracts+ task section: stable task ID, single-outcome title, owned files, consumes/produces interfaces, full EARS criteria verbatim (reference-only criteria refuse the write, naming the offending task), verification commands with expected output, non-goals, blocked-by edges, task-specific constraints. Target 30-60 dense lines per task; no code bodies - executors write the code. (ledger 10, 18, 24)
3. MODIFIED - the plan remains a flat ordered task list and valid `/plan-runner:run` input; new fields are additive only. (ledger 5, 11)
4. ADDED - the planner emits a Task 1 walking skeleton that lands shared contracts and owns all hotspot files (registries, barrel exports, config); every other task carries a blocked-by edge to it or to a nearer prerequisite. (ledger 11)
5. ADDED - `/ideas:tickets <plan-path>`: a new command (skill `skills/tickets/`) that reads only the plan file and projects it to GitHub: one parent tracking issue per plan, one sub-issue per exported task linked via the `gh api graphql` addSubIssue mutation (gh has no built-in sub-issue command), blocked-by edges noted in issue bodies. Where sub-issues are unavailable, degrade to a task-list checklist in the parent issue body, announced in the emission report (Assumption A7). (ledger 7, 8, 18, 20)
6. ADDED - issue bodies are context-complete and vendor-neutral: the rendered task section plus the plan's flagged constraints, no vendor-specific fields or triggers. (ledger 4, 10)
7. ADDED - a Definition-of-Ready gate inside `/ideas:tickets`: only self-contained, file-isolated, fully-specified tasks export; held-back tasks are listed with one-line reasons. Nothing is exported that fails the bar, and nothing is held back silently. (ledger 12)
8. ADDED - emission is an idempotent upsert keyed on a hidden task-ID marker in each issue body: re-runs create missing issues, update changed ones, and never duplicate. The lookup never uses GitHub search (HTML comments are not indexed): it enumerates issues via `gh issue list --label ideas-plan:<slug> --state all --json number,body` and parses markers locally; the task ID also appears as the visible fixed first line of the body as a fallback key. Partial failures name every emitted and every failed task; a re-run completes the remainder. (ledger 13, 19)
9. ADDED - exported issues carry two labels, created if absent: `ideas-plan:<slug>` and `agent-ready`. (ledger 17)
10. ADDED - when the GitHub context is unusable (no GitHub remote, gh CLI missing, or unauthenticated), `/ideas:tickets` refuses with one sentence naming exactly what is missing and writes nothing. (ledger 15)
11. MODIFIED - the interview's "Approve + generate plan" gate routes into `/ideas:plan` logic. (ledger 7)
12. REMOVED - the `--plan-runner` flag is dropped this release with no alias; README and gate text point only to `/ideas:plan`. `references/plan-adapter.md` content evolves into the new command's references. (ledger 3, 16)
13. MODIFIED - `tests/contract.test.js` pins the new command surfaces and the task-format headings; additionally, one throwaway 3-task smoke emission against a scratch private repo (create, unchanged re-run, edited re-run, forced mid-emission failure) is release-blocking. No dogfood emission of a real plan. (ledger 14, 21)

### Non-functional requirements
14. Each exported issue is completable without following external references: everything an agent needs sits in the issue body, per the Contracts+ format's 30-60 dense-line target. (ledger 4, 10)
15. Re-running `/ideas:tickets` against an unchanged plan performs no destructive GitHub writes - upsert semantics make re-runs safe by construction. (ledger 13)

## Chosen approach
Approach A: plan-file-only projection. A shared `references/task-format.md` is the single contract; `/ideas:plan` writes it and `/ideas:tickets` reads nothing but the plan file - if a task is not ticket-ready from its own text, that is a Definition-of-Ready failure by definition. Rejected: Approach B (tickets re-reads the spec/ledger for enrichment), which couples emission to spec availability, breaks on hand-edited plans, and creates two sources that can disagree. See `docs/adr/0004-plan-file-canonical-issues-projection.md` and `docs/adr/0005-backend-neutral-task-format.md`. (ledger 18)

## Architecture & components
- Interview review gate (existing): on "Approve + generate plan", routes into the plan writer. (ledger 7)
- Plan writer (`skills/plan/`): approved spec in, canonical plan file out; sole author of the task format. (ledger 7, 18)
- Task-format contract (`references/task-format.md`): shared definition both commands and the contract tests pin. (ledger 10, 18)
- Tickets projector (`skills/tickets/`): plan file in, parent issue + sub-issues out via gh; contains the Definition-of-Ready gate and the upsert engine. (ledger 7, 12, 13)
- plan-runner (external, unchanged): consumes the same plan file for in-session execution. (ledger 5)

Data flow: `approved spec -> /ideas:plan -> docs/plans/<date>-<slug>.plan.md -> { /plan-runner:run (in-session agents) | /ideas:tickets -> gh -> parent issue + sub-issues -> outside agents/humans }`. (ledger 6, 7)

## Data & interfaces
- Plan path: `docs/plans/YYYY-MM-DD-<slug>.plan.md`; header carries Goal, Source spec, Flagged constraints (unconfirmed). (ledger 3, 6)
- Task section fields (task-format.md, pinned verbatim by contract tests): `### Task N: <title>`, `Task ID:`, `Owned files:`, `Interfaces:` (consumes/produces), `Acceptance criteria:` (full EARS text), `Verification:` (commands + expected output), `Non-goals:`, `Blocked by:`, `Constraints:`. (ledger 10)
- Issue marker: an HTML comment embedding the task ID in each issue body, the upsert key; the same task ID is the visible first line of the body as fallback. Lookup: `gh issue list --label ideas-plan:<slug> --state all --json number,body`, markers parsed locally, never GitHub search. (ledger 13, 19)
- Labels: `ideas-plan:<slug>`, `agent-ready`. (ledger 17)
- GitHub shapes: one parent tracking issue per plan; tasks as sub-issues via the `gh api graphql` addSubIssue mutation; fallback per Assumption A7. (ledger 8, 20)

## Edge cases & error handling
- Spec has no Acceptance criteria section: `/ideas:plan` refuses with one sentence, writes nothing - decided (carried forward from the adapter it evolves). (ledger 3)
- gh write fails mid-emission: report names every emitted and failed task; re-run upserts the remainder - decided. (ledger 13)
- Plan edited after emission: re-run updates changed issues in place via the marker key - decided. (ledger 13)
- No GitHub remote / gh missing / unauthenticated: refuse fast, write nothing - decided. (ledger 15)
- Task fails Definition-of-Ready: held back and listed with a reason, never exported degraded - decided. (ledger 12)
- Zero tasks pass the gate: assumed - emit nothing (not even the parent issue) and report every reason (Assumption A5).
- Sub-issues unavailable on the target repo: assumed - degrade to a task-list checklist in the parent issue body, announced in the emission report (Assumption A7). (ledger 20)

## Acceptance criteria (EARS)
1. WHEN `/ideas:plan` runs against an approved spec with acceptance criteria THE SYSTEM SHALL write a plan file at `docs/plans/YYYY-MM-DD-<slug>.plan.md` whose every task section contains the task-format fields with full EARS text, verification commands, non-goals, and blocked-by edges.
2. IF the source spec lacks an Acceptance criteria section THEN THE SYSTEM SHALL refuse in one sentence and write nothing.
3. WHEN a plan is generated THE SYSTEM SHALL emit a flat ordered task list with no wave groupings, and the file SHALL be accepted by `/plan-runner:run` unchanged.
4. WHEN a plan contains two or more tasks THE SYSTEM SHALL make Task 1 a walking skeleton owning all hotspot files, and every other task SHALL carry at least one blocked-by edge.
5. WHEN `/ideas:tickets` runs against a plan file in a GitHub-backed repo THE SYSTEM SHALL create one parent tracking issue and one sub-issue per exported task, each sub-issue linked to the parent and labeled `ideas-plan:<slug>` and `agent-ready`.
6. WHEN a task is exported THE SYSTEM SHALL render its issue body from the task section and the plan's flagged constraints alone, with no vendor-specific fields.
7. IF a task is not self-contained, file-isolated, and fully specified THEN THE SYSTEM SHALL hold it back from export and list it with a one-line reason.
8. WHEN `/ideas:tickets` re-runs against a previously emitted plan THE SYSTEM SHALL create only missing issues and update only changed ones, resolving existing issues by enumerating the `ideas-plan:<slug>` label with `--state all` and parsing markers locally - never via GitHub search - producing no duplicates.
9. IF any gh write fails during emission THEN THE SYSTEM SHALL report every emitted and every failed task by name.
10. IF the repo has no GitHub remote, gh is missing, or gh is unauthenticated THEN THE SYSTEM SHALL refuse in one sentence naming what is missing and write nothing.
11. WHEN zero tasks pass the Definition-of-Ready gate THE SYSTEM SHALL emit no issues and report every held-back reason.
12. WHEN the interview review gate resolves "Approve + generate plan" THE SYSTEM SHALL run the `/ideas:plan` logic.
13. WHEN this release ships THE SYSTEM SHALL no longer accept the `--plan-runner` flag, and README and gate text SHALL reference `/ideas:plan` instead.
14. WHEN this release ships THE SYSTEM SHALL pass contract tests pinning the two command surfaces and the task-format field names, with the version bumped in all four places.
15. WHEN `/ideas:tickets` performs GitHub operations THE SYSTEM SHALL use only the gh CLI, storing no tokens in files.
16. WHEN a task ID is assigned THE SYSTEM SHALL keep it stable across plan edits and re-emissions, never renumbering existing tasks.
17. IF sub-issues are unavailable on the target repo THEN THE SYSTEM SHALL degrade to a task-list checklist in the parent issue body and announce the fallback in the emission report.
18. WHEN this release ships THE SYSTEM SHALL have completed one smoke emission of a 3-task throwaway plan against a scratch private repo exercising create, unchanged re-run, edited re-run, and a forced mid-emission failure - release-blocking.

## Verification strategy
- Criteria 1-4, 13, 14: unit - contract tests (`node --test`) pinning command surfaces, task-format field names, and adapter-refusal phrases against the prose files. (ledger 14)
- Criteria 5, 8, 9, 15, 16, 18: integration - the release-blocking scratch-repo smoke emission (create, unchanged re-run, edited re-run, forced mid-emission failure). (ledger 21)
- Criteria 6, 7, 10, 11, 12, 17: manual - exercised on first real use post-release; their prose is contract-pinned. (ledger 14)
- No standing integration harness beyond the one-time smoke emission. (ledger 14, 21)

## Assumptions (unconfirmed)
- A1, binding default: GitHub access goes through the gh CLI only - no tokens in files, no GitHub App. Welded into criterion 15. (offered at triage, not selected as binding)
- A2, binding default: new SKILL.md files follow the plugin's lean-skill/lazy-reference conventions and stay within established line budgets. (offered at triage, not selected as binding)
- A3, binding default: ships as v0.5.0 via the four-place bump protocol. Welded into criterion 14. (offered at triage, not selected as binding)
- A4, binding default: task IDs use `<slug>-t<NN>`, assigned once at first plan write and never renumbered. Welded into criterion 16.
- A5, binding default: when zero tasks pass the Definition-of-Ready gate, nothing is emitted (including the parent issue) and every reason is reported. Welded into criterion 11.
- A6, binding default: the plan header's Goal and Source spec lines are carried over from the adapter template being evolved; only the Flagged constraints line traces to a decided row. (audit demotion)
- A7, binding default: when sub-issues are unavailable, the fallback mode is a task-list checklist in the parent issue body, announced - the user required a defined fallback without picking degrade-vs-refuse. Welded into criterion 17. (ledger 20)

## Open questions
None.

## Definition of done
- Tests written and passing (`node --test`, including new pins).
- Existing behavior preserved outside the described change - interview, audit, and gate flows unaffected except the plan routing and flag removal.
- Stated platform, runtime, and environment floors honored (Node contract tests, Claude Code plugin layout, gh CLI at runtime for tickets only).
- No new network calls unless specified in Data & interfaces (gh CLI calls to GitHub are the only addition).
- Docs updated where user- or operator-visible behavior changed (README pipeline description, CHANGELOG, gate text).
- Every acceptance criterion above passes.
