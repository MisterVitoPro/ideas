# Plan stage - implementation plan
Goal: Evolve the plan adapter into a first-class plan stage: /ideas:plan writes a canonical Contracts+ plan file and /ideas:tickets projects it to GitHub as agent-agnostic issues behind a Definition-of-Ready gate.
Source spec: docs/specs/2026-07-12-plan-stage.md
Flagged constraints (unconfirmed):
- A1: GitHub access via the gh CLI only - no tokens in files, no GitHub App.
- A2: new SKILL.md files follow the plugin's lean-skill/lazy-reference conventions and line budgets.
- A3: ships as v0.5.0 via the four-place bump protocol.
- A4: task IDs use `<slug>-t<NN>`, assigned once at first plan write, never renumbered.
- A5: when zero tasks pass the Definition-of-Ready gate, nothing is emitted (including the parent issue) and every reason is reported.
- A6: the plan header carries Goal and Source spec lines in addition to Flagged constraints.
- A7: when sub-issues are unavailable, degrade to a task-list checklist in the parent issue body, announced in the emission report.

### Task 1: Shared Contracts+ task-format reference
Owned files: skills/plan/references/task-format.md
Interfaces: consumes nothing; produces the task-section contract both commands and the contract tests pin - field lines verbatim: `### Task N: <title>`, `Task ID:`, `Owned files:`, `Interfaces:`, `Acceptance criteria:`, `Verification:`, `Non-goals:`, `Blocked by:`, `Constraints:`; task-ID scheme `<slug>-t<NN>`.
Acceptance criteria:
- WHEN `/ideas:plan` runs against an approved spec with acceptance criteria THE SYSTEM SHALL write a plan file at `docs/plans/YYYY-MM-DD-<slug>.plan.md` whose every task section contains the task-format fields with full EARS text, verification commands, non-goals, and blocked-by edges.
- WHEN a task ID is assigned THE SYSTEM SHALL keep it stable across plan edits and re-emissions, never renumbering existing tasks.
Constraints: Target 30-60 dense lines per task; no code bodies - executors write the code. Reference-only acceptance criteria (a criterion number with no WHEN/SHALL sentence) refuse the plan write, naming the offending task. The format is a strict superset of plan-runner's expected fields (Owned files, Interfaces, Acceptance criteria, Constraints); new fields are additive only.

### Task 2: /ideas:plan command skill
Owned files: skills/plan/SKILL.md
Interfaces: consumes skills/plan/references/task-format.md (Task 1); produces the plan-generation procedure the interview gate routes into (Task 3) and the plan files /ideas:tickets consumes (Tasks 4-5).
Acceptance criteria:
- WHEN `/ideas:plan` runs against an approved spec with acceptance criteria THE SYSTEM SHALL write a plan file at `docs/plans/YYYY-MM-DD-<slug>.plan.md` whose every task section contains the task-format fields with full EARS text, verification commands, non-goals, and blocked-by edges.
- IF the source spec lacks an Acceptance criteria section THEN THE SYSTEM SHALL refuse in one sentence and write nothing.
- WHEN a plan is generated THE SYSTEM SHALL emit a flat ordered task list with no wave groupings, and the file SHALL be accepted by `/plan-runner:run` unchanged.
- WHEN a plan contains two or more tasks THE SYSTEM SHALL make Task 1 a walking skeleton owning all hotspot files, and every other task SHALL carry at least one blocked-by edge.
- WHEN a task ID is assigned THE SYSTEM SHALL keep it stable across plan edits and re-emissions, never renumbering existing tasks.
Constraints: Procedure evolves the retired plan adapter: confirm-or-carry spec assumptions into the "Flagged constraints (unconfirmed)" header (carry is the default); header carries Goal and Source spec lines; plan commit is git-gated (when git is absent, write the file and note committing was skipped). Blocked by: Task 1.

### Task 3: Interview gate routing and flag removal
Owned files: skills/interview/SKILL.md, skills/interview/references/plan-adapter.md
Interfaces: consumes the /ideas:plan procedure (Task 2); produces the updated review-gate text.
Acceptance criteria:
- WHEN the interview review gate resolves "Approve + generate plan" THE SYSTEM SHALL run the `/ideas:plan` logic.
- WHEN this release ships THE SYSTEM SHALL no longer accept the `--plan-runner` flag, and README and gate text SHALL reference `/ideas:plan` instead.
Constraints: This task owns the gate-text half of the flag-removal criterion; README changes belong to Task 6. references/plan-adapter.md is removed or reduced to a pointer at the new command - no duplicate procedure text survives. SKILL.md stays within its 150-line budget. Blocked by: Task 2.

### Task 4: /ideas:tickets command skill
Owned files: skills/tickets/SKILL.md
Interfaces: consumes plan files in the Task 1 format; produces the projection flow that invokes the emission procedures (Task 5).
Acceptance criteria:
- WHEN `/ideas:tickets` runs against a plan file in a GitHub-backed repo THE SYSTEM SHALL create one parent tracking issue and one sub-issue per exported task, each sub-issue linked to the parent and labeled `ideas-plan:<slug>` and `agent-ready`.
- WHEN a task is exported THE SYSTEM SHALL render its issue body from the task section and the plan's flagged constraints alone, with no vendor-specific fields.
- IF the repo has no GitHub remote, gh is missing, or gh is unauthenticated THEN THE SYSTEM SHALL refuse in one sentence naming what is missing and write nothing.
- WHEN `/ideas:tickets` performs GitHub operations THE SYSTEM SHALL use only the gh CLI, storing no tokens in files.
Constraints: Reads only the plan file - never the source spec or ledger (ADR-0005). Sub-issue linking uses the `gh api graphql` addSubIssue mutation; gh has no built-in sub-issue command. Labels created if absent. Heavy procedure text lives in the Task 5 reference, keeping SKILL.md lean. Blocked by: Task 1.

### Task 5: Definition-of-Ready gate and upsert engine reference
Owned files: skills/tickets/references/emission.md
Interfaces: consumes the Task 1 task format and the Task 4 flow; produces the DoR rules, upsert lookup procedure, partial-failure report format, and sub-issue fallback behavior.
Acceptance criteria:
- IF a task is not self-contained, file-isolated, and fully specified THEN THE SYSTEM SHALL hold it back from export and list it with a one-line reason.
- WHEN `/ideas:tickets` re-runs against a previously emitted plan THE SYSTEM SHALL create only missing issues and update only changed ones, resolving existing issues by enumerating the `ideas-plan:<slug>` label with `--state all` and parsing markers locally - never via GitHub search - producing no duplicates.
- IF any gh write fails during emission THEN THE SYSTEM SHALL report every emitted and every failed task by name.
- WHEN zero tasks pass the Definition-of-Ready gate THE SYSTEM SHALL emit no issues and report every held-back reason.
- IF sub-issues are unavailable on the target repo THEN THE SYSTEM SHALL degrade to a task-list checklist in the parent issue body and announce the fallback in the emission report.
Constraints: Upsert key is an HTML-comment task-ID marker in each issue body; the task ID also appears as the visible fixed first line of the body as a fallback key (HTML comments are not search-indexed and can be stripped by template edits). Lookup command shape: `gh issue list --label ideas-plan:<slug> --state all --json number,body`. Blocked by: Task 4.

### Task 6: Contract tests, version bump, and docs
Owned files: tests/contract.test.js, plugin.json, package.json, CHANGELOG.md, README.md
Interfaces: consumes the surfaces produced by Tasks 1-5 (command names, task-format field lines, refusal phrases); produces the v0.5.0 release artifacts.
Acceptance criteria:
- WHEN this release ships THE SYSTEM SHALL pass contract tests pinning the two command surfaces and the task-format field names, with the version bumped in all four places.
- WHEN this release ships THE SYSTEM SHALL no longer accept the `--plan-runner` flag, and README and gate text SHALL reference `/ideas:plan` instead.
Constraints: This task owns the README half of the flag-removal criterion; gate text belongs to Task 3. Four-place bump: plugin.json, contract-test version pin, package.json, CHANGELOG.md. README pipeline description gains /ideas:plan and /ideas:tickets and drops --plan-runner. Blocked by: Tasks 1, 2, 3, 4, 5.

### Task 7: Scratch-repo smoke emission (release gate)
Owned files: docs/release/plan-stage-smoke.md
Interfaces: consumes the complete /ideas:plan and /ideas:tickets implementations; produces the release-blocking smoke report.
Acceptance criteria:
- WHEN this release ships THE SYSTEM SHALL have completed one smoke emission of a 3-task throwaway plan against a scratch private repo exercising create, unchanged re-run, edited re-run, and a forced mid-emission failure - release-blocking.
Constraints: Uses a scratch private repo, never a real project repo; no dogfood emission of a real plan. Requires an authenticated gh session - if unavailable, the task reports blocked rather than simulating results. The report records per-scenario outcomes (create / unchanged re-run / edited re-run / forced failure) with issue numbers and cleanup (`gh issue close` by label). Blocked by: Task 6.
