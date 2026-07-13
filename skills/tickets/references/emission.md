# Emission reference - Definition-of-Ready gate and upsert engine

Read this file from `skills/tickets/SKILL.md` before emitting. It defines the DoR gate, the
marker format and upsert lookup, the partial-failure report format, and the sub-issue fallback.
Everything here operates on tasks already parsed per `skills/plan/references/task-format.md`.

## Definition-of-Ready gate

Run the gate once, over every task in the plan, before rendering any issue body. A task that
fails any check is held back with a one-line reason; it is never exported degraded. Checks:

- **Self-contained**: the task section supplies everything a worker needs without the source spec
  or ledger. Fails if the body would need to reference either - e.g. a bare acceptance-criteria
  reference number instead of full EARS text (already refused earlier, at plan-write time, but
  hand-edited plans reach `/ideas:tickets` unchecked), or prose pointing at "the spec" or "the
  ledger" for meaning.
- **File-isolated**: `Owned files` is present, non-empty, and disjoint from every other exported
  task's `Owned files`. Compute this as a single pass over the whole task set - two tasks that
  both claim a path fail together, each with a reason naming the other's task ID and the
  overlapping path.
- **Fully specified**: all nine task-format fields are present and non-blank, `Blocked by` names
  only task IDs that exist in this plan (a dangling ID fails the gate), and no field contains an
  unfilled placeholder token (e.g. a literal `<...>` left from the template).

One-line reason format: `<task ID> (<title>): held back - <check> - <specific cause>`. Example:
`plan-stage-t04 (tickets skill): held back - file-isolated - Owned files overlaps plan-stage-t05
on skills/tickets/SKILL.md`.

Tasks that pass proceed to rendering and emission in plan order. When zero tasks pass, emit no
issues - not even the parent tracking issue - and report every held-back reason; there is nothing
to track yet.

## Marker format

Every emitted issue body carries two identifiers for idempotent lookup, since HTML comments are
not search-indexed and can be stripped by template edits:

- **Visible fallback key**: the fixed first line of the body. Sub-issues: `Task ID: <slug>-t<NN>`.
  Parent issue: `Plan: <slug>`.
- **Hidden marker**: an HTML comment elsewhere in the body. Sub-issues:
  `<!-- ideas-plan:task:<slug>-t<NN> -->`. Parent issue: `<!-- ideas-plan:parent:<slug> -->`.

Both identifiers are written verbatim on every create and preserved on every update - never
regenerate or reformat an existing marker line beyond correcting a task ID.

## Upsert lookup

Never use GitHub search (it does not index HTML comments). Resolve existing issues for a plan by
enumerating the label and parsing markers locally:

    gh issue list --label ideas-plan:<slug> --state all --json number,body

For each returned issue, try the hidden-marker regex first (`<!-- ideas-plan:(task|parent):(\S+)
-->`); if no marker matches (a stripped or hand-edited body), fall back to checking whether the
first line equals the fixed visible key. Build one map of task ID -> issue number and one parent
lookup (`slug` -> issue number) from this single enumeration; do not issue a second `gh issue
list` call mid-run - the plan and the enumeration are both snapshotted at run start.

For each task that passed the DoR gate: if its task ID is in the map, diff the rendered body
against the existing issue body. Identical bodies are skipped (no write - this is what makes a
re-run against an unchanged plan produce zero destructive GitHub writes); a changed body is
written with `gh issue edit <number> --body-file -`, preserving the existing marker and visible
key lines. If the task ID is not in the map, create it: `gh issue create` with the rendered body,
labels `ideas-plan:<slug>` and `agent-ready` (created first if either label is absent), then link
it to the parent per the Sub-issue linking section below. The parent issue follows the same
create-or-update logic keyed on the parent marker, and is only created once at least one task has
passed the gate.

## Sub-issue linking and fallback

Link each created or newly-passing sub-issue to the parent via the `gh api graphql` addSubIssue
mutation (gh has no built-in sub-issue command). Treat a mutation failure as "sub-issues
unavailable on this repo" only when the GraphQL error itself signals the feature or field is
unrecognized (e.g. the `addSubIssue` field or `Issue.subIssues` type is unresolvable, or the
target repo rejects the mutation as unsupported) - detect this once, from the first attempt.

On that signal, degrade for the rest of the run: stop attempting the mutation, and instead render
the parent issue body's task list as a markdown checklist, one line per exported task:
`- [ ] <title> (#<sub-issue number>)`. Sub-issues themselves are still created and upserted
normally under Upsert lookup above - only the parent-to-child *link* falls back to the checklist.
Announce the fallback once in the emission report; do not repeat it per task.

Any other mutation failure (permissions, rate limit, transient network error) is not an
availability signal - report it as a failed write for that specific task under Partial-failure
reporting, and let a re-run retry the link.

## Partial-failure reporting

Every run - success, partial failure, or all-held-back - produces one report covering:

- Every task that passed the gate and was successfully emitted (created or updated), by task ID
  and title.
- Every task held back by the DoR gate, by task ID and its one-line reason.
- Every `gh` write that failed during this run, by task ID and title, whichever step failed
  (create, update, or sub-issue link) - a task can be emitted but still show a failed link.
- Whether the sub-issue fallback triggered this run, and at what point.

A re-run after a partial failure is safe by construction: unaffected issues are unchanged (same
body, skipped write) and only the previously-failed tasks produce new writes, resolved through the
same upsert lookup.

This report is the last output of a standalone `/ideas:tickets` run. A run invoked from the
`/ideas:plan` completion gate continues directly from this report into the one-time execution
re-offer defined in `skills/tickets/SKILL.md` - that routing lives there, not here.
