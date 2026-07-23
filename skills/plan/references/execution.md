# Execution reference - inline and subagent modes

Read this file from `../SKILL.md` only after the user picks "Run inline" or "Run with
subagents" at the completion gate - it is never loaded on the plan-runner, tickets, or stop paths
(ADR-0006). It defines both execution procedures, the commit convention, the done-ness rule that
drives resume, and failure handling. Everything here operates on tasks already parsed per
`task-format.md`; `<slug>` is the plan filename's slug (from
`<root>/plans/YYYY-MM-DD-<slug>.plan.md`, where `<root>` is the resolved docs root - see
`docs-location.md`) and each task's ID is `<slug>-t<NN>`.

## Commit convention

Every execution commit uses the message `exec(<slug>-tNN): <title>`, where `<title>` is the task's
`### Task N: <title>` heading text verbatim. This message is the machine-readable link between git
history and per-task state: resume reads it back, so it is written exactly, one commit per task,
never squashed or reworded. A task's commit stages only that task's `Owned files` - nothing else.

## Done-ness and resume

Before implementing anything, compute per-task done-ness so a resumed run re-does only what is not
finished. A task is done only when all three hold:

1. a commit with subject `exec(<slug>-tNN): <title>` exists for the task's ID, and
2. that commit subject's `<title>` exactly matches the task's title in the current plan, and
3. the task's Verification command passes now.

The exact-title match is deliberate: task IDs are stable across plan regeneration, so a retitled or
content-changed task keeps its ID but no longer matches its old `exec()` commit subject - it breaks
loudly (treated as not-done) instead of being reported done off a stale commit. Never treat an ID
match alone as done; the title comparison and a passing Verification are both required.

When git is absent, there are no commits to read: done-ness degrades to verification-only (a task
is done when its Verification command passes), and the final report states that resume is
verification-based. Execution then proceeds without committing, exactly as the plan skill's own
write step degrades when git is absent.

## Inline mode

Implement tasks one at a time in blocked-by order (a topological order of the `Blocked by` edges;
where the plan is already ordered, plan order suffices). For each task:

1. Skip it if done-ness above already marks it done (resume).
2. Implement its `Owned files` to satisfy its full acceptance criteria, honoring its Constraints
   and Non-goals - the task section is self-contained; do not consult the source spec.
3. Run its Verification command. If it passes and git is present, commit that task's `Owned files`
   with `exec(<slug>-tNN): <title>`. If git is absent, note the skipped commit and continue.
4. If Verification fails (or implementation cannot complete), the task has failed - go to Failure
   handling. In inline mode "finish the current wave" means finish the current task only; do not
   start the next task before handling the failure.

## Subagent mode

Group tasks into waves from the `Blocked by` edges: a task joins the earliest wave in which all its
blockers already sit in earlier waves. Every wave is therefore file-disjoint - the plan format
already guarantees each task's `Owned files` are disjoint from every other task's, and that
disjointness is exactly what lets each task's files be staged and committed independently without
cross-contamination. Waves run in order; a wave starts only after the prior wave's commits land.

Within a wave, dispatch one general-purpose agent per task (up to the wave's task count), each told
to implement only its own `Owned files` against its acceptance criteria and Constraints. Do not add
verifier agents - per-wave verification depth is plan-runner's job, deliberately not cloned here.
When every agent in the wave has returned, for each task whose agent completed: run that task's
Verification command, and if it passes (and git is present) commit that task's `Owned files`
individually with `exec(<slug>-tNN): <title>` - one commit per task, never a combined wave commit.
Skip already-done tasks (resume) rather than dispatching an agent for them.

## Failure handling

A task fails when its implementation cannot complete or its Verification command does not pass. On a
failure:

- Finish the current wave: let the wave's other in-flight tasks run to completion (inline: finish
  only the current task) - do not abort siblings that share no dependency on the failure.
- Revert the failed task's `Owned files` before any commit includes them, so failed work never
  enters history: discard that task's working-tree changes (its files are disjoint, so reverting
  them touches nothing else). The failed task produces no `exec()` commit.
- Skip every task that depends on the failed task through `Blocked by` edges, transitively; tasks
  with no dependency on the failure still run in their waves.
- Continue through the remaining independent waves, then stop at the report.

## Report

End every execution run - success, partial failure, or fully resumed - with one report: one line
per task giving its task ID, title, and status of `completed`, `failed`, or `skipped`, with a
one-line reason for each failed or skipped task (which check failed, or which failed task it
depended on). When git is absent, the report also states that resume is verification-based.
