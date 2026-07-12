---
name: tickets
description: Projects an /ideas:plan plan file to GitHub as agent-ready issues behind a Definition-of-Ready gate. Use when a plan is approved and ready to become trackable work items. Not for drafting or editing the plan itself.
---

# ideas:tickets - project a plan file to GitHub issues

Turn a Contracts+ plan file (written by `/ideas:plan`) into one parent tracking issue and one
sub-issue per exported task, each sub-issue linked to the parent and labeled `ideas-plan:<slug>`
and `agent-ready`. Reads only the plan file - never the source spec or ledger (ADR-0005); the
plan file is the sole input so sub-issues stay agent-agnostic.

Flow: preflight -> read plan -> Definition-of-Ready gate -> render bodies -> create/upsert
issues -> link sub-issues -> emission report.

## Preflight (refuse fast)
This command targets a GitHub-backed repo. Before touching GitHub, check in order - on any
failure, refuse in one sentence naming what is missing and write nothing:
- IF the repo has no GitHub remote THEN refuse, naming "no GitHub remote".
- IF `gh` is missing THEN refuse, naming "gh is missing".
- IF `gh` is unauthenticated THEN refuse, naming "gh is unauthenticated" (check via
  `gh auth status`).

`/ideas:tickets` performs GitHub operations using only the gh CLI, storing no tokens in files.

## Read plan
Parse the plan file's header (Goal, Source spec, Flagged constraints) and every `### Task N:`
section using the format pinned in `skills/plan/references/task-format.md`. The slug comes from
the plan filename (`YYYY-MM-DD-<slug>.plan.md`).

## Definition-of-Ready gate
Full rules, the upsert lookup procedure, the partial-failure report format, and the sub-issue
fallback live in `references/emission.md` - read it before emitting. In short: a task that is
not self-contained, file-isolated, and fully specified is held back with a one-line reason, and
zero tasks passing the gate means zero issues emitted and every reason reported.

## Render issue bodies
Each sub-issue body is rendered from the task section and the plan's flagged constraints alone -
no vendor-specific fields, nothing pulled from the source spec or ledger. The parent issue body
lists the plan's Goal, Source spec, and one line per exported task with its sub-issue link (or
checklist item under the sub-issue fallback).

## Create parent tracking issue and sub-issues
Create one parent tracking issue and one sub-issue per exported task. Every sub-issue is labeled
`ideas-plan:<slug>` and `agent-ready`. Labels created if absent. Sub-issues are linked to the
parent via the `gh api graphql` addSubIssue mutation - gh has no built-in sub-issue command. When
sub-issues are unavailable on the target repo, degrade to a task-list checklist in the parent
issue body instead (procedure in `references/emission.md`), and announce the fallback in the
emission report.

## Re-runs (upsert)
Re-running against a previously emitted plan creates only missing issues and updates only
changed ones - see `references/emission.md` for the label-enumeration lookup and marker format.

## Emission report
Report every emitted task by name, every held-back task with its one-line reason, and every
failed gh write by name; announce the sub-issue fallback here when it triggered.

## Known gotchas
- `gh auth status` writes to stderr on success in some gh versions - check exit code, not stream.
- Treat the plan file read at step start as the snapshot for the whole run; do not re-read it
  mid-run even if `/ideas:plan` could be running concurrently.
