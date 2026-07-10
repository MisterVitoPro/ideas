# Plan adapter - approved spec to plan-runner plan

Read this file only when generating a plan: after "Approve + generate plan" at the review gate,
or when invoked as `/ideas:interview --plan-runner <spec-path>` against an existing approved
spec. For standalone runs the spec alone suffices; the ledger enriches traceability when it
still exists but its absence is never an error.

## Procedure

1. Read the approved spec (and the ledger if present).
2. Refuse fast: if the spec has no Acceptance criteria section, refuse with one sentence naming
   what is missing and write nothing - the adapter never invents criteria.
3. Confirm-or-carry: if the spec's Assumptions or Open questions sections are non-empty, present
   them once in a single batch - resolve now, or carry. Carried items land in the plan header
   under "Flagged constraints (unconfirmed)". Nothing is dropped silently; an empty answer means
   carry (carrying is the safe default).
4. Decompose in the main loop: one task per cluster of related EARS criteria with an
   independently verifiable deliverable. No hard task cap; plan-runner runs at most 6 agents
   per wave.
5. Emit a flat ordered task list - wave grouping belongs to plan-runner's analyzer, and two
   waving algorithms would fight.
6. Self-check before writing: every task carries the full text of the EARS criteria it satisfies,
   never a bare reference number - plan-runner's agents only ever see the plan file, not the
   source spec. If any task's acceptance-criteria block contains a reference-only pattern (a
   criterion number with no WHEN/SHALL sentence), refuse to write the plan and name the offending task.
7. Write the plan to docs/plans/YYYY-MM-DD-<slug>.plan.md and commit it (git-gated: when git is
   absent, write the file and note that committing was skipped).

## Plan template

    # <Title> - implementation plan
    Goal: <one sentence>
    Source spec: docs/specs/YYYY-MM-DD-<slug>.md
    Flagged constraints (unconfirmed): <carried items, or "None">

    ### Task 1: <deliverable>
    Owned files: <exact paths>
    Interfaces: consumes <...>; produces <...>
    Acceptance criteria:
    - WHEN <trigger> THE SYSTEM SHALL <behavior>
    Constraints: <task-specific constraints>

Tasks are contracts: owned files, interfaces, acceptance criteria, constraints - never function bodies, test code, or shell commands; plan-runner's TDD agents write those.
Keep sections delimited (### Task N) so a later release can split them into per-task files
mechanically.
