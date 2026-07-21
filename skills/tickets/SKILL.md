---
name: tickets
description: Projects an Ideas plan file to GitHub as agent-ready issues behind a Definition-of-Ready gate. Use when a plan is approved and ready to become trackable work items. Not for drafting or editing the plan itself.
---

# ideas:tickets - project a plan file to GitHub issues

Turn a Contracts+ plan file (written by the Ideas plan skill) into one parent tracking issue and one
sub-issue per exported task, each sub-issue linked to the parent and labeled `ideas-plan:<slug>`
and `agent-ready`. Reads only the plan file - never the source spec or ledger (ADR-0005); the
plan file is the sole input so sub-issues stay agent-agnostic.

Flow: preflight -> read plan -> Definition-of-Ready gate -> render bodies -> create/upsert
issues -> link sub-issues -> emission report -> (gate-invoked only) execution re-offer.

## Preflight (refuse fast)
This command targets a GitHub-backed repo. Before touching GitHub, check in order - on any
failure, refuse in one sentence naming what is missing and write nothing:
- IF the repo has no GitHub remote THEN refuse, naming "no GitHub remote".
- IF `gh` is missing THEN refuse, naming "gh is missing".
- IF `gh` is unauthenticated THEN refuse, naming "gh is unauthenticated" (check via
  `gh auth status`).

The Ideas tickets skill performs GitHub operations using only the gh CLI, storing no tokens in files.

## Read plan
Parse the plan file's header (Goal, Source spec, Flagged constraints) and every `### Task N:`
section using the format pinned in `../plan/references/task-format.md`. The slug comes from
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

## Execution re-offer (gate-invoked only)
When this skill is invoked from the Ideas plan skill's completion gate (the user picked "Create
GitHub tickets"), present exactly one structured question call immediately after the emission report,
offering the same execution options as that completion gate minus "Create GitHub tickets" itself
- no looping back into tickets: "Execute with plan-runner" (only when `plan-runner:run` appears in
the session's available-skills list, marked recommended whenever shown), "Run inline", "Run with
subagents", and "Stop here". Same hiding rule and same empty-answer-means-stop rule as the
completion gate in `../plan/SKILL.md`. A structured question call uses `AskUserQuestion` in
Claude Code or `request_user_input` in Codex when available, with concise numbered prose as the
fallback. Route the answer identically to that gate:
- "Execute with plan-runner": never invoke the skill from this session. Tell the user to run
  `/clear` first, then print the exact command to paste after clearing -
  `/plan-runner:run <plan file path>` in Claude Code, `$plan-runner:run <plan file path>` in
  Codex - and end the run.
- "Run inline" or "Run with subagents": read `../plan/references/execution.md` - the first and
  only point it is read on this path - and follow its procedure for the chosen mode.
- "Stop here" or an empty answer: end the run.

This re-offer fires exactly once per gate-invoked run - it is never shown a second time and never
re-enters this skill.

When this skill is invoked standalone (directly, not via the completion gate), skip this
section entirely: the emission report above is the last output, exactly as it is today. Tell
gate-invoked from standalone apart by invocation context alone - never a state file or a
plan-file field.

## Known gotchas
- `gh auth status` writes to stderr on success in some gh versions - check exit code, not stream.
- Treat the plan file read at step start as the snapshot for the whole run; do not re-read it
  mid-run even if the Ideas plan skill could be running concurrently.
