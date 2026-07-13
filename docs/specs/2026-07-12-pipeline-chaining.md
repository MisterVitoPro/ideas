# Pipeline chaining (interview -> plan -> execute/tickets) - design spec

Date: 2026-07-12
Status: approved
Author: MisterVitoPro

## Problem

The three ideas commands are a pipeline in name only: /ideas:interview ends by merely suggesting
next tools, /ideas:plan ends at a written file with no handoff, and /ideas:tickets must be
remembered and invoked by hand. Users who finish a spec or plan are dropped at a dead end and
have to know the next command themselves - including whether plan-runner is even installed.

## Existing system

Claude Code plugin `ideas` v0.5.0, skill-prose architecture (no runtime code beyond contract
tests). Three skills: interview (review gate offers "Approve" and "Approve + generate plan",
the latter already runs /ideas:plan in-session), plan (10-step procedure ending at write+commit),
tickets (GitHub projection behind a Definition-of-Ready gate, gh CLI only). Two read-only agents
(spec-auditor, spec-critic). plan-runner is a separate sibling plugin; its /plan-runner:run
accepts the plan file unchanged. Lazy-reference convention established by ADR-0002 and
skills/tickets/references/emission.md. Plan file format is agent-agnostic per ADR-0005.

## Goals

- Approving a spec flows into plan generation by default rather than by opt-in discovery.
- A completed plan always ends at one gate offering every next step: plan-runner execution when
  installed, inline execution, subagent execution, GitHub tickets, or stop.
- Users can route a plan to tickets instead of implementing, then still choose to implement.
- Execution without plan-runner is real (the session implements the plan), not a printed
  suggestion.

## Non-goals

- No new command surface (approach C rejected; the /ideas:execute-plan migration stays roadmap).
- No verifier agents in subagent mode - per-wave verification depth remains plan-runner's value
  proposition, deliberately not cloned here (constraint-conflict: "closer to plan-runner parity"
  lost to "no breaking changes / keep ideas lean"; resolution: waved dispatch without verifiers).
- No changes to the plan file format (ADR-0005 holds; chaining is skill prose only).
- No filesystem probing for plan-runner (skill-availability check only).

## Users / consumers

Existing ideas plugin users; downstream, /plan-runner:run and the GitHub repo receiving tickets.
The spec is consumed by /ideas:plan and plan-runner to implement this change (dogfooding).

## Requirements

1. MODIFIED - interview review gate: keep both "Approve" and "Approve + generate plan" options,
   with "Approve + generate plan" marked as the recommended default. (ledger: triage)
2. ADDED - plan completion gate: after the plan file is written and committed, /ideas:plan
   presents one unified AskUserQuestion with, at most: Execute with plan-runner / Run inline /
   Run with subagents / Create GitHub tickets / Stop here. (ledger: wave 1)
3. ADDED - plan-runner detection: the gate shows "Execute with plan-runner" only when
   /plan-runner:run appears in the session's available-skills list, and marks it recommended
   when shown. No filesystem probing. (ledger: wave 1)
4. ADDED - tickets option visibility: the gate shows "Create GitHub tickets" only when the cheap
   preflight passes (GitHub remote exists, gh binary present). (ledger: wave 2)
5. ADDED - execution reference: a new skills/plan/references/execution.md holds both execution
   procedures; it is read only after the user picks an execution mode. (ledger: approach)
6. ADDED - inline mode: implement task-by-task in blocked-by order, run each task's Verification
   command, commit per task (git-gated) using the execution commit convention (requirement 8a).
   (ledger: wave 2, review gate)
7. ADDED - subagent mode: order tasks by blocked-by edges into file-disjoint parallel waves,
   dispatch one general-purpose agent per task; commit per completed task's Owned files (file
   disjointness guarantees clean staging), and revert a failed task's Owned files at the wave
   boundary so a failed task never contaminates history. No verifier agents.
   (ledger: wave 1, superseded in part by review gate)
8. ADDED - failure handling and resume (both modes): on a task failure, finish the current wave
   (inline: the current task), skip tasks that depend on the failure, and report every task as
   completed/failed/skipped by task ID. Resume state is defined, not assumed:
   a. Commit convention: every execution commit message is `exec(<slug>-tNN): <title>`.
   b. Done-ness: a task is done when a matching `exec(<slug>-tNN)` commit exists whose subject
      `<title>` exactly matches the current plan's task title AND its Verification command
      passes - a retitled or content-changed task breaks the match loudly instead of passing
      silently. When git is absent, done-ness is verification-only and the report states that
      resume is verification-based.
   c. Re-entry: when docs/plans/YYYY-MM-DD-<slug>.plan.md already exists for the spec,
      /ideas:plan asks once - "Resume remaining tasks" (skip regeneration, completion gate
      scoped to not-done tasks) or "Regenerate plan" - instead of silently re-running the
      emission procedure. (ledger: wave 2, review gate)
9. MODIFIED - tickets composability: when /ideas:tickets is invoked from the plan gate, its
   emission report re-offers the execution options exactly once; standalone invocation is
   unchanged. (ledger: wave 1)
10. MODIFIED - docs: README pipeline description, CHANGELOG entry, and version bump follow the
    six-place release protocol. (ledger: approach, components)

### Non-functional requirements

11. No breaking changes: /ideas:plan standalone, /ideas:tickets against previously emitted plan
    files, and the plan file format all keep working unchanged. (ledger: triage)
12. Plan file stays agent-agnostic: no execution-mode or vendor fields are added to it
    (ADR-0005). (ledger: triage)
13. Token cost stays flat for non-executing runs: execution prose loads only via the lazy
    reference (ADR-0006). (ledger: approach)

## Chosen approach

Approach B - gate in skills/plan/SKILL.md, execution procedures as a lazy reference. Approach A
(all inline) lost on always-loaded token cost; approach C (new /ideas:execute command) lost on
release-surface churn and front-running the planned plan-runner migration. See
docs/adr/0006-execution-gate-as-lazy-reference.md.

## Architecture & components

- skills/interview/SKILL.md (modified): review gate recommends "Approve + generate plan".
- skills/plan/SKILL.md (modified): re-entry check (resume vs regenerate when the plan file
  already exists) and step 11 "completion gate" - detection, option assembly, one
  AskUserQuestion, routing.
- skills/plan/references/execution.md (new): inline and waved-subagent procedures, commit
  convention, done-ness rule, failure handling, resume semantics.
- skills/tickets/SKILL.md (modified): emission report re-offer when gate-invoked.
- Flow: interview review gate -> /ideas:plan -> completion gate -> { /plan-runner:run | inline |
  subagents | /ideas:tickets -> re-offer } -> report.

## Data & interfaces

- Plan file `docs/plans/YYYY-MM-DD-<slug>.plan.md`: unchanged format; sole input to every
  execution mode and to tickets.
- Detection interface: presence of `plan-runner:run` in the session's available-skills list.
- Tickets preflight subset used by the gate: GitHub remote in `git remote -v`, `gh` on PATH
  (authentication stays tickets' own deeper preflight).
- Execution report shape: one line per task - task ID, title, completed | failed | skipped
  (with one-line reason for failed/skipped); states "resume is verification-based" when git is
  absent.
- Execution commit convention: `exec(<slug>-tNN): <title>` - the machine-readable link between
  git history and plan task state.

## Edge cases & error handling

- plan-runner absent: option hidden; inline/subagents remain (decided).
- No GitHub remote or no gh: tickets option hidden (decided).
- Task failure mid-execution: stop at wave boundary, revert the failed task's Owned files, skip
  dependents, full report by ID (decided).
- Partial prior execution: /ideas:plan's re-entry check offers "Resume remaining tasks";
  done-ness is determined per task by the exec(<slug>-tNN) commit convention plus a passing
  Verification command (decided at review gate).
- Git absent: execution proceeds without commits; done-ness degrades to verification-only and
  the report says so explicitly (decided at review gate).
- User picks "Stop here": run ends exactly as today's /ideas:plan does (no regression).
- AskUserQuestion returns empty at the gate: treat as "Stop here" - never auto-execute
  (mirrors the interview's empty-answer gotcha; execution is the highest-cost action).

## Acceptance criteria (EARS)

- WHEN the interview review gate is presented THE SYSTEM SHALL mark "Approve + generate plan" as
  the recommended option while still offering plain "Approve".
- WHEN /ideas:plan finishes writing and committing a plan file THE SYSTEM SHALL present exactly
  one completion-gate AskUserQuestion before ending the run.
- WHILE /plan-runner:run is present in the available-skills list THE SYSTEM SHALL show "Execute
  with plan-runner" as the recommended gate option.
- WHILE /plan-runner:run is absent from the available-skills list THE SYSTEM SHALL omit the
  plan-runner option and still offer "Run inline" and "Run with subagents".
- IF the repo has no GitHub remote or gh is not on PATH THEN THE SYSTEM SHALL omit the "Create
  GitHub tickets" gate option.
- WHEN the user picks "Run inline" THE SYSTEM SHALL read references/execution.md and implement
  tasks in blocked-by order, running each task's Verification command and committing per task
  (git-gated).
- WHEN the user picks "Run with subagents" THE SYSTEM SHALL group tasks into file-disjoint waves
  by blocked-by edges, dispatch one general-purpose agent per task, and commit each completed
  task's Owned files individually.
- WHEN execution commits a task THE SYSTEM SHALL use the commit message `exec(<slug>-tNN):
  <title>`.
- IF a task fails during execution THEN THE SYSTEM SHALL finish the current wave, revert the
  failed task's Owned files before any commit includes them, skip dependent tasks, and report
  every task ID as completed, failed, or skipped.
- WHEN /ideas:plan is invoked and docs/plans/YYYY-MM-DD-<slug>.plan.md already exists for the
  spec THE SYSTEM SHALL ask once whether to resume remaining tasks or regenerate the plan,
  before any regeneration.
- WHILE resuming THE SYSTEM SHALL treat a task as done only when a matching exec(<slug>-tNN)
  commit exists, the commit subject's title exactly matches the current plan's task title, AND
  its Verification command passes; IF git is absent THEN THE SYSTEM SHALL use verification-only
  done-ness and state so in the report.
- WHEN the user picks "Create GitHub tickets" at the gate THE SYSTEM SHALL run /ideas:tickets and,
  after its emission report, re-offer the execution options exactly once.
- WHEN /ideas:tickets is invoked standalone THE SYSTEM SHALL behave exactly as it does today
  (no re-offer).
- IF the completion-gate AskUserQuestion returns an empty answer THEN THE SYSTEM SHALL treat it
  as "Stop here" and never begin execution.
- WHEN a non-executing path is taken (plan-runner, tickets, stop) THE SYSTEM SHALL not load
  references/execution.md.

## Verification strategy

- unit: contract tests (node --test tests/contract.test.js) extended to pin the new reference
  file's existence and the gate step's presence in plan's SKILL.md, plus the version pin.
- integration: claude plugin validate .; a scratch-repo dry run of /ideas:plan against an
  existing approved spec confirming the gate appears with correct options under both
  plan-runner-present and plan-runner-absent sessions. Regenerate-then-resume path: partially
  execute a plan, pick Regenerate with reordered tasks, then Resume - assert no task is
  reported done off a stale commit. The exec() token format is pinned in
  tests/contract.test.js alongside the existing checks.
- manual: one full-chain dogfood run (interview -> plan -> subagent execution; separately
  plan -> tickets -> re-offer) verifying failure reporting and the tickets re-offer.

## Assumptions (unconfirmed)

All three assumptions below were confirmed by the user at plan generation (2026-07-12); they
remain listed for traceability.

- Binding default: brownfield baseline is ideas v0.5.0 with the three-skill/two-agent layout and
  plan-runner as a sibling plugin whose /plan-runner:run accepts the plan file unchanged - welded
  into the acceptance criteria above (gate options and detection depend on it).
- Binding default (audit-demoted): an empty completion-gate answer is treated as "Stop here" and
  never begins execution - mirrors the interview's empty-answer gotcha, welded into the matching
  EARS criterion; not user-confirmed.
- Audit-demoted: the /ideas:execute-plan migration "stays roadmap" is sourced from the README's
  How-it-fits-with-plan-runner section, not from an interview decision; Non-goals and Chosen
  approach reference it on that basis.

## Open questions

None.

## Definition of done

- Tests written and passing (contract tests extended per Verification strategy).
- Existing behavior preserved outside the described change (requirement 11).
- Stated platform, runtime, and environment floors honored (skill prose only; no new runtime).
- No new network calls unless specified in Data & interfaces (gh usage stays inside tickets).
- Docs updated where user-visible behavior changed (README, CHANGELOG, six-place release).
- Every acceptance criterion above passes.
