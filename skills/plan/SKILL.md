---
name: plan
description: Writes a canonical Contracts+ implementation plan from an approved design spec - stable task IDs, full EARS text per task, and a flat task list ready for the plan-runner run skill. Use when a spec with acceptance criteria needs docs/plans/YYYY-MM-DD-<slug>.plan.md, or the interview gate resolves Approve + generate plan.
---

# ideas:plan - approved spec to canonical plan

Turn an approved design spec into a canonical, agent-agnostic plan file named
`YYYY-MM-DD-<slug>.plan.md` under the resolved docs root. Both the interview review gate and
standalone invocation route into this procedure. Read
`references/task-format.md` for the field-by-field task-section contract; this file is the
procedure only.

A "structured question call" means the host's batched user-input tool: `AskUserQuestion` in
Claude Code or `request_user_input` in Codex when available. If unavailable, ask the same
numbered options in concise prose and wait for the answer.

## Root resolution
Root resolution: the docs root is the approved spec path's parent directory's parent
(`<root>/specs/<file>.md` yields `<root>`) - derive this from whatever spec path was actually
handed in, even when it does not match that shape, and never default to `docs/` or run detection
here.

## Re-entry check
Before emission (before step 1), check whether `<root>/plans/YYYY-MM-DD-<slug>.plan.md` already
exists for this spec. If it does, ask once via one structured question call - "Resume remaining tasks" or
"Regenerate plan" - before any regeneration; do not silently re-run the emission procedure against
an already-planned spec. "Resume remaining tasks" skips steps 1-9 entirely, keeps the existing
plan file and its task IDs untouched, and proceeds straight to the completion gate below.
"Regenerate plan" proceeds through the full procedure, matching existing tasks by title and owned
files (step 5) so their IDs carry forward. Either choice still ends at the completion gate -
resuming does not by itself execute anything. Per-task done-ness (which tasks are already
complete) is only ever computed if an execution mode is chosen at the gate, using the done-ness
rule in `references/execution.md`; the plan-runner, tickets, and stop paths never need it and
never load that file.

## Procedure

1. Read the approved spec (and the ledger if present - it enriches traceability but its absence
   is never an error).
2. Refuse fast: if the spec has no Acceptance criteria section, refuse in one sentence naming
   what is missing and write nothing - never invent criteria to satisfy the gate.
3. Confirm-or-carry: if the spec's Assumptions or Open questions sections are non-empty, present
   them once in a single batch - resolve now, or carry. Carried items land in the plan header
   under "Flagged constraints (unconfirmed)". Nothing is dropped silently: an empty answer means
   carry, since carrying is the safe default.
4. Decompose: one task per cluster of related EARS criteria with an independently verifiable
   deliverable. No hard task cap; plan-runner runs at most 6 agents per wave.
5. Assign task IDs: `<slug>-t<NN>`, zero-padded, assigned once at first plan write. On a
   re-emission against an already-planned spec, match tasks to the prior plan by title and owned
   files (not position) and reuse their existing IDs; only new tasks get new IDs - task IDs are
   stable and never renumbered across plan edits or re-emissions.
6. Walking skeleton: when the plan has two or more tasks, make Task 1 a walking skeleton that
   owns all hotspot files (the files every other task needs to build against); every other task
   carries at least one blocked-by edge naming the task ID(s) it depends on.
7. Emit a flat ordered task list - no wave groupings. Waving stays plan-runner's analyzer's job;
   two waving algorithms fighting over one plan is worse than either alone. The file SHALL be
   accepted by the plan-runner run skill unchanged.
8. Fill every task section per `references/task-format.md`: Task ID, Owned files, Interfaces,
   Acceptance criteria (full EARS text, never a bare reference number - plan-runner's agents only
   ever see the plan file, not the source spec), Verification command(s), Non-goals, Blocked by,
   Constraints. Tasks are contracts: never function bodies, test code, or shell commands -
   executors write the code.
9. Self-check before writing: a reference-only pattern is a criterion number with no WHEN/IF/SHALL
   sentence. If any task's acceptance-criteria block contains one:
   refuse to write the plan and name the offending task.
10. Write the plan to `<root>/plans/YYYY-MM-DD-<slug>.plan.md`, stating that resolved path in the
    write confirmation. Commit is git-gated: when git is absent, write the file and note that
    committing was skipped.
11. Completion gate: once the plan file is written and committed (or, on resume, immediately after
    the re-entry check), present exactly one structured question call before ending the run, offering, in
    order: "Execute with plan-runner" (only when `plan-runner:run` appears in the session's
    available-skills list - detection is that skill-availability check only, never filesystem
    probing - and marked recommended whenever it is shown), "Run inline", "Run with subagents",
    "Create GitHub tickets" (only when the repo has a GitHub remote and `gh` is on PATH - a cheap
    preflight only; tickets runs its own deeper auth check), and "Stop here". An empty answer is
    treated as "Stop here" - execution never begins on silence. Route the answer:
    - "Execute with plan-runner": never invoke the skill from this session - the run is at its
      largest right here, and plan-runner needs only the plan file. Tell the user to run `/clear`
      first, then print the exact command to paste after clearing -
      `/plan-runner:run <plan file path>` in Claude Code, `$plan-runner:run <plan file path>` in
      Codex - and end this run. `references/execution.md` is never read on this path.
    - "Run inline" or "Run with subagents": read `references/execution.md` now - this is the first
      and only point it is read - and follow its procedure for the chosen mode.
    - "Create GitHub tickets": run the Ideas tickets skill against the plan file. `references/execution.md`
      is never read on this path; the re-offer after tickets' emission report is defined in
      `../tickets/SKILL.md`.
    - "Stop here" or an empty answer: end the run.
      `references/execution.md` is never read on this path.

## Plan template

    # <Title> - implementation plan
    Goal: <one sentence>
    Source spec: <resolved path to the approved spec file>
    Flagged constraints (unconfirmed): <carried items, or "None">

    ### Task 1: <deliverable>
    Task ID: <slug>-t01
    Owned files: <exact paths>
    Interfaces: consumes <...>; produces <...>
    Acceptance criteria:
    - WHEN <trigger> THE SYSTEM SHALL <behavior>
    Verification: <command or procedure>
    Non-goals: <bullets>
    Blocked by: none
    Constraints: <task-specific constraints>

See `references/task-format.md` for the full field-by-field contract.

## Known gotchas
- `<root>/plans/` may not exist in the target repo - create it on first write.
- Re-emission: diffing by task title/owned-files overlap before assigning IDs matters more than
  it looks - a reordered task is still the same task, and losing that identity breaks
  the Ideas tickets skill's upsert lookup downstream.
- Structured question tools can return empty answers inside plugin skills; the completion gate treats empty
  as "Stop here", never as consent to execute - mirrors the interview's empty-answer gotcha.
- The completion gate's option list is rebuilt from the live session state (available-skills list,
  git remote, gh on PATH) every run - a prior run's option set is never cached or assumed to hold.
