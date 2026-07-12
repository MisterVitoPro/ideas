---
name: plan
description: Writes a canonical Contracts+ implementation plan from an approved design spec - stable task IDs, full EARS text per task, a flat task list ready for /plan-runner:run. Use when a spec with acceptance criteria needs docs/plans/YYYY-MM-DD-<slug>.plan.md, or the interview review gate resolves Approve + generate plan.
---

# ideas:plan - approved spec to canonical plan

Turn an approved design spec into a canonical, agent-agnostic plan file at
`docs/plans/YYYY-MM-DD-<slug>.plan.md`. This is the successor to the retired plan adapter
(`skills/interview/references/plan-adapter.md`) - same procedure, now a first-class command that
both the interview review gate and standalone invocation route into. Read
`references/task-format.md` for the field-by-field task-section contract; this file is the
procedure only.

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
   accepted by /plan-runner:run unchanged.
8. Fill every task section per `references/task-format.md`: Task ID, Owned files, Interfaces,
   Acceptance criteria (full EARS text, never a bare reference number - plan-runner's agents only
   ever see the plan file, not the source spec), Verification command(s), Non-goals, Blocked by,
   Constraints. Tasks are contracts: never function bodies, test code, or shell commands -
   executors write the code.
9. Self-check before writing: a reference-only pattern is a criterion number with no WHEN/IF/SHALL
   sentence. If any task's acceptance-criteria block contains one:
   refuse to write the plan and name the offending task.
10. Write the plan to docs/plans/YYYY-MM-DD-<slug>.plan.md. Commit is git-gated: when git is absent,
    write the file and note that committing was skipped.

## Plan template

    # <Title> - implementation plan
    Goal: <one sentence>
    Source spec: docs/specs/YYYY-MM-DD-<slug>.md
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
- docs/plans/ may not exist in the target repo - create it on first write.
- Re-emission: diffing by task title/owned-files overlap before assigning IDs matters more than
  it looks - a reordered task is still the same task, and losing that identity breaks
  /ideas:tickets' upsert lookup downstream.
