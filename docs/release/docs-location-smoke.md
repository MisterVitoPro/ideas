# Docs-location detection smoke protocol (release gate)

Task: `docs/plans/2026-07-23-docs-location-detection.plan.md` Task 6 - Manual verification
protocol and user-facing docs.
Reference (canonical resolution rule, read before running any case): `skills/interview/references/docs-location.md`.

This is a protocol, not a completed report: each case below is written so an operator can execute
it against a throwaway scratch repo and judge pass/fail from this document alone, without opening
the resolution-rule source. Like the `/ideas:tickets` smoke run this mirrors
(`docs/release/plan-stage-smoke.md`), use a private, disposable scratch repo - never a real
project repo - and record actual results (PASS/FAIL, deltas from expectation) inline when this
protocol is executed for a release gate.

## Shared setup notes

- Each case starts from a **fresh scratch repo** (or a fresh subdirectory with its own git init)
  so directory layouts do not leak between cases.
- "Committed ideas spec" means a file carrying both content markers required by the artifact
  pass: a `- design spec` title line AND a `## Acceptance criteria (EARS)` heading. A file merely
  named to the `YYYY-MM-DD-<slug>.md` shape does not qualify on its own.
- "Resolution" can be exercised either by running `/ideas:interview` (or `$ideas:interview` in
  Codex) end to end against the scratch repo, or by hand-tracing the rule in
  `skills/interview/references/docs-location.md` against the scratch repo's fixture layout - both
  are acceptable ways to judge a case, but the write-report checks require an actual run.
- "Write report" refers to the message the interview (or plan skill, for the re-entry glob) shows
  after resolving a root and writing files - the acceptance criteria require certain paths and
  disclosure lines to be visible there, not just correct on disk.

## Case 1: Divergence check (non-conventional root, durable re-resolution)

**Setup:**
- Fresh scratch repo. No `docs/`, `documentation/`, `doc/`, or `.docs/` directory anywhere.
- Pre-seed `design/specs/2026-01-01-seed.md` with both content markers (a real, committed ideas
  spec) - this simulates a repo that already adopted `design/` as its docs root before this
  protocol run.

**Steps:**
1. Run 1: invoke the interview for a new idea and let it reach the write step.
2. Run 2: in a fresh session (or after `/clear`), invoke the interview again for a different idea
   against the same scratch repo state (now containing both the seed spec and run 1's output).
3. Take the resulting spec into `/ideas:plan`. Observe the plan skill's re-entry glob (the check
   it runs to decide "resume remaining tasks" vs. "regenerate" / "no existing plan").

**Expected resolved root:** `design/` for both run 1 and run 2 - never `docs/`. Run 1 writes its
spec to `design/specs/2026-07-23-<slug>.md`. Run 2's resolution is re-derived independently (no
resolver memory across sessions) and lands on `design/` again because the artifact pass still
finds a valid committed spec under `design/specs`. The plan skill's re-entry glob checks
`design/plans/*.plan.md`, not `docs/plans/*.plan.md`.

**Pass/Fail condition:** PASS only if all three are true: (a) run 1's spec file appears under
`design/specs/`, (b) run 2's spec file also appears under `design/specs/` (confirming the second
run did not drift to `docs/`), and (c) the plan skill's re-entry check globs `design/plans`. FAIL
if either run's write report or on-disk output names `docs/` anywhere, or if the plan re-entry
check globs `docs/plans` instead of `design/plans`.

## Case 2: Conventional-root check (non-`docs` conventional name)

**Setup:**
- Fresh scratch repo. Create `documentation/` containing at least one `.md` file (e.g. a plain
  `documentation/overview.md`). Do not create `docs/`, `doc/`, or `.docs/`. Do not seed any
  committed ideas spec anywhere (artifact pass must find nothing, so resolution falls through to
  the conventional pass).

**Steps:**
1. Invoke the interview for a new idea and let it reach the write step.
2. Read the write report the interview prints after writing the spec.

**Expected resolved root:** `documentation/` (conventional pass priority order
`docs` > `documentation` > `doc` > `.docs`; `docs/` is absent so `documentation/` - the next
qualifying directory with a `.md` file - wins). The spec lands at
`documentation/specs/YYYY-MM-DD-<slug>.md`.

**Pass/Fail condition:** PASS if the spec file is written under `documentation/specs/` and the
write report's stated path explicitly names `documentation/specs/...` (not `docs/specs/...`).
FAIL if the file lands under `docs/specs/` (a `docs/` directory should not even exist yet in this
fixture) or if the write report's stated path says `docs/` instead of `documentation/`.

## Case 3: False-positive guard (name-only match must not win)

**Setup:**
- Fresh scratch repo with two immediate children:
  - `api/specs/2024-01-01-openapi.md` - matches the `YYYY-MM-DD-<slug>.md` filename shape but is
    plain OpenAPI reference text with neither the `- design spec` title line nor the
    `## Acceptance criteria (EARS)` heading. Not an ideas spec.
  - `docs/specs/2026-07-01-real-spec.md` - a real committed ideas spec (both content markers
    present).
- No other candidate directories.

**Steps:**
1. Invoke the interview for a new idea and let it reach the write step.
2. Confirm no file is ever written under `api/`.

**Expected resolved root:** `docs/`, never `api/`. Two independent reasons both point here: `api/`
never qualifies as an artifact-pass candidate in the first place (its file matches the filename
shape only, not the content markers, so it is not a candidate to rank against `docs/` at all), and
separately the docs-bias short-circuit would prefer `docs/` over any other candidate even if `api`
did lexicographically precede it.

**Pass/Fail condition:** PASS if the new spec is written under `docs/specs/` and `api/` is
untouched (no new file, no directory created under it). FAIL if any artifact is written under
`api/`, or if the write report names `api/` as the resolved root.

## Case 4: False-negative boundary case (non-conventional-only docs, no seed spec)

**Setup:**
- Fresh scratch repo. Create `design/` containing several `.md` files (e.g. design guidelines,
  notably more `.md`-heavy than any other top-level directory in the fixture) but do **not** seed
  any committed ideas spec under `design/specs` or anywhere else. Do not create `docs/`,
  `documentation/`, `doc/`, or `.docs/`.

**Steps:**
1. Invoke the interview for a new idea and let it reach the write step.
2. Read the write report in full, including any disclosure/warning line.

**Expected resolved root:** `docs/` (the fallback - neither the artifact pass nor the conventional
pass finds a candidate, since `design/` holds no committed ideas spec and is not one of the four
conventional names). `docs/specs`, `docs/plans`, and `docs/adr` are created on first write.
Because `design/` is a plausible non-conventional candidate (`.md`-heavy relative to its
siblings), the fallback-disclosure rule requires the write report to name it in one line and state
that seeding a spec under `design/specs` switches roots on the next run.

**Pass/Fail condition:** PASS if the spec lands under `docs/specs/` AND the write report contains
an explicit one-line disclosure naming `design/` and stating that seeding a spec under
`design/specs` would switch the resolved root next run. FAIL if the root instead resolves to
`design/` itself, if the fallback occurs silently with no disclosure line, or if the disclosure
line names a different directory than `design/`.

## Operator sign-off template

Fill in when this protocol is actually executed for a release gate:

| Case | Result (PASS/FAIL) | Notes |
|---|---|---|
| 1. Divergence check | | |
| 2. Conventional-root check | | |
| 3. False-positive guard | | |
| 4. False-negative boundary case | | |

Release-gate status: **not yet executed** (protocol authored; run against a scratch repo before
citing this file as evidence of a passing release gate).
