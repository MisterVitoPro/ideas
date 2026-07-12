# ADR-0005: Backend-neutral Contracts+ task format; tickets reads only the plan file

Status: accepted (2026-07-12)

## Context
Tasks must render three ways without loss: as plan-runner input (hard compatibility
constraint), as an in-session subagent brief, and as a self-contained GitHub issue
body an agent-agnostic worker can complete. Research on agent-completed issues shows
long bodies and external references measurably reduce success, and ADR-0001 already
fixed the plan as a single flat structured file with no pre-grouped waves.

## Options
1. Contracts+ format in a shared reference; /ideas:tickets reads only the plan file.
2. Contracts-only format unchanged; tickets enriches bodies from the source spec and
   ledger at emission time.
3. Superpowers-style full-code steps embedded per task.

## Decision
Option 1. A shared references/task-format.md defines the task section: stable task ID,
single-outcome title, owned files, consumes/produces interfaces, full EARS criteria
verbatim, verification commands with expected output, non-goals, and blocked-by edges -
about 30-60 dense lines, no code bodies. /ideas:plan writes it; /ideas:tickets projects
it reading nothing but the plan file. A Definition-of-Ready gate holds back tasks that
are not self-contained, file-isolated, and fully specified, reporting each with a reason.

## Consequences
- One format, two backends: they cannot drift because there is one writer.
- Self-containedness is mechanically checkable - if the issue body would need the spec,
  the task fails DoR by definition.
- Hand-edited plans remain first-class input to tickets.
- The format stays a superset of plan-runner's expectations; contract tests pin the
  headings to keep the compatibility promise honest.
