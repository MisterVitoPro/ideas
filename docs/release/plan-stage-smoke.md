# Plan-stage smoke emission report (release gate)

Task: `docs/plans/2026-07-12-plan-stage.plan.md` Task 7 - Scratch-repo smoke emission.
Date: 2026-07-12
Operator: wave-5-agent-1

## Setup

- gh auth: confirmed working before starting (`gh auth status` -> logged in as `MisterVitoPro`,
  scopes `gist, read:org, repo`).
- Scratch repo: `MisterVitoPro/plan-stage-smoke-scratch`, created private via
  `gh repo create plan-stage-smoke-scratch --private --description "Throwaway scratch repo for
  /ideas:tickets smoke test - safe to delete"`, cloned to a scratchpad temp dir. Never a real
  project repo.
- Throwaway plan: `docs/plans/2026-07-12-smoke-test.plan.md` inside the scratch repo's working
  copy, 3 tasks (`smoke-test-t01/t02/t03`), written to the Task 1 format
  (`skills/plan/references/task-format.md`) - Task 1 walking skeleton with `Blocked by: none`,
  Tasks 2-3 each carry a `Blocked by` edge, all 9 fields present and non-blank, owned files
  disjoint (`src/greeting.js`+`.test.js`, `src/farewell.js`+`.test.js`, `src/session.js`).
- Procedure exercised as written: `skills/tickets/SKILL.md` flow (preflight -> read plan -> DoR
  gate -> render bodies -> create/upsert -> link sub-issues -> report) and
  `skills/tickets/references/emission.md` (DoR gate, marker format, upsert lookup, sub-issue
  linking/fallback, partial-failure reporting), hand-executed via the `gh` CLI since no automated
  harness exists yet for these two skills.

## Scenario 1: create

DoR gate: all 3 tasks passed (self-contained, file-isolated, fully specified). Labels
`ideas-plan:smoke-test` and `agent-ready` were absent on the scratch repo and were created first,
per the emission procedure.

- Sub-issues created: `smoke-test-t01` -> #1, `smoke-test-t02` -> #2, `smoke-test-t03` -> #3, each
  with the visible key (`Task ID: <id>`) as body first line and the hidden marker
  (`<!-- ideas-plan:task:<id> -->`) below it, labeled `ideas-plan:smoke-test` + `agent-ready`.
- Parent tracking issue created: #4 (`Plan: smoke-test`, visible key `Plan: smoke-test`, hidden
  marker `<!-- ideas-plan:parent:smoke-test -->`, labeled `ideas-plan:smoke-test`), created only
  after at least one task passed the gate, per procedure.
- Sub-issue linking: `gh api graphql` `addSubIssue` mutation succeeded on the first attempt (#1 ->
  parent #4), confirming sub-issues are available on this repo - no fallback triggered. Linked #2
  and #3 the same way. All three mutations returned the expected `{issue, subIssue}` number pairs.

Outcome: PASS. 1 parent + 3 sub-issues created, all linked as true GitHub sub-issues (no
checklist-fallback needed).

## Scenario 2: unchanged re-run

Re-ran the upsert lookup (`gh issue list --label ideas-plan:smoke-test --state all --json
number,body`), which returned all 4 issues with markers intact. Re-rendered all 4 bodies from the
unedited plan file and diffed each against the fetched remote body.

Outcome: PASS. All 4 diffs were identical (`#1`, `#2`, `#3`, `#4`) - zero `gh` writes issued, per
the "re-run against an unchanged plan produces zero destructive GitHub writes" requirement.

## Scenario 3: edited re-run

Edited only `smoke-test-t02`'s `Constraints` line in the plan file, committed and pushed, then
repeated the lookup + diff.

- Diff result: #2 differed, #1/#3/#4 identical.
- Write applied: `gh issue edit 2 --body-file body-t02.md` - succeeded, preserving the existing
  visible key and hidden marker lines unchanged.

Outcome: PASS. Only the changed task's issue was written; the other 3 were correctly skipped.

## Scenario 4: forced mid-emission failure

Edited both `smoke-test-t01` and `smoke-test-t03` constraints in the plan (2 tasks needing
writes this round, `smoke-test-t02` and the parent unchanged). Forced the `t01` write to fail by
adding a nonexistent label in the same `gh issue edit` call
(`gh issue edit 1 --body-file body-t01.md --add-label "does-not-exist-forced-failure"`), then ran
the real `t03` update (`gh issue edit 3 --body-file body-t03.md`, no forced fault).

- `t01` write: reported failed - `gh` exited 1 with `failed to update ... 'does-not-
  exist-forced-failure' not found`.
- `t03` write: succeeded - `gh issue edit 3` returned the issue URL, exit 0.

Partial-failure report (per `emission.md`'s format):
- Emitted this run: `smoke-test-t03` (#3, updated).
- Held back by DoR gate: none.
- Failed gh writes: `smoke-test-t01` (#1, update) - label-add step failed with "label not found".
- Sub-issue fallback: did not trigger this run (established unavailable/available once in
  Scenario 1; stays available).
- Unaffected/skipped (unchanged from lookup): `smoke-test-t02` (#2), parent (#4).

Outcome: PASS - the forced failure was correctly isolated to the one task, and the report can
name every emitted and every failed task by ID and number, matching the acceptance criterion.

**Finding (process gotcha, not a functional bug in the skills as written):** `gh issue edit`
combining `--body-file` with `--add-label` in one invocation is **not atomic** - the body update
was applied even though the overall command reported failure and returned exit 1 (confirmed by
re-fetching issue #1's body immediately after the "failed" call: it already showed the edited
constraints text). The documented upsert procedure in `references/emission.md` never combines a
body write with a label write in the same call (label creation/attachment only happens at
`gh issue create` time), so this exact failure mode does not occur in the procedure as written.
Recommend adding a one-line gotcha to `skills/tickets/references/emission.md`'s "Known gotchas"
equivalent (or `SKILL.md`'s Known gotchas) warning against ever combining `--body-file` with a
label flag in a single `gh issue edit` call, since a partial write could be reported as a clean
failure when the body already changed.

## Cleanup

- Closed all 4 issues by label:
  `for n in $(gh issue list --label "ideas-plan:smoke-test" --state open --json number -q
  '.[].number'); do gh issue close "$n" --comment "Closing scratch smoke-test issue after
  plan-stage release-gate smoke run."; done`
  -> closed #4, #3, #2, #1.
- Repo deletion: `gh repo delete MisterVitoPro/plan-stage-smoke-scratch --yes` failed - HTTP 403,
  the authenticated token lacks the `delete_repo` scope (`gh auth status` scopes were `gist,
  read:org, repo` only; would need `gh auth refresh -s delete_repo`, which requires an interactive
  browser step not available in this session). Did not attempt an interactive scope escalation
  without explicit user confirmation.
- Mitigation applied instead: `gh repo archive MisterVitoPro/plan-stage-smoke-scratch --yes`
  succeeded; confirmed via `gh repo view ... --json isArchived,visibility` ->
  `{"isArchived":true,"visibility":"PRIVATE"}`. The repo is archived, private, read-only, and all
  its issues are closed.
- **Outstanding action for a human with `delete_repo` scope**: run
  `gh repo delete MisterVitoPro/plan-stage-smoke-scratch --yes` (or delete via the GitHub UI) to
  finish removing the scratch repo. It is inert in the meantime (archived + private + closed
  issues).

## Summary

All four scenarios required by the release gate were exercised against a real, private, throwaway
scratch repo using only the `gh` CLI and the documented `/ideas:tickets` procedure text
(`skills/tickets/SKILL.md` + `skills/tickets/references/emission.md`), hand-executed step by step
exactly as written:

| Scenario | Result | Issue(s) |
|---|---|---|
| Create | PASS | parent #4, sub-issues #1, #2, #3 |
| Unchanged re-run | PASS (0 writes) | #1-#4 |
| Edited re-run | PASS (1 write) | #2 |
| Forced mid-emission failure | PASS (1 write ok, 1 reported failed) | #3 ok, #1 failed |

The procedure text in `skills/tickets/SKILL.md` and `skills/tickets/references/emission.md` was
followed as written with no ambiguity encountered severe enough to block execution; the one
finding above is a documentation-improvement suggestion, not a defect that blocked this smoke run.

Release-gate status: **met**, with one outstanding manual cleanup step (final repo deletion,
blocked on token scope) tracked above.
