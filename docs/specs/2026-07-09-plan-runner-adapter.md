# plan-runner output adapter (0.2.0) - design spec

Date: 2026-07-09
Status: awaiting review
Author: MisterVitoPro

## Problem

An approved ideas spec is tool-agnostic prose; turning it into work for /plan-runner:run today means
a human (or a fresh session) re-deriving tasks by hand. The pipeline's front door and its execution
engine do not connect. (Interview ledger: plan-runner-adapter, 2026-07-09.)

## Goals

- One motion from approved spec to a plan-runner-ready plan file (ledger rows 2, 9).
- The plan preserves the honesty chain: every task traces to EARS criteria, and unresolved
  assumptions/open questions are carried visibly in the plan header (row 8). Whether plan-runner's
  verifier acts on that header is assumption A2, not a decided fact.
- Ship without modifying plan-runner (rests on assumption A1, unverified until the first run).

## Non-goals

- No per-task plan files in 0.2.x - deferred to the 0.3.x migration (ADR-0001).
- No new pipeline agent - decomposition happens in the main loop (row 6).
- No changes to plan-runner in 0.2.x; whether the emitted file is consumable exactly as-is is
  assumption A1, not a settled fact.

## Users / consumers

The user approving a spec at gate 2; /plan-runner:run (and its plan-analyzer) as the file's consumer.

## Requirements

Brownfield: expressed as change deltas against ideas v0.1.0 behavior.

MODIFIED - gate 2 options (row 9): the review gate becomes
"Approve / Approve + generate plan / Add more / Modify / Start over". Choosing
"Approve + generate plan" completes approval exactly as Approve does, then runs the adapter in the
same session. No additional AskUserQuestion call is spent on the offer.

ADDED - standalone invocation (rows 2, 10): `/ideas:interview --plan-runner <spec-path>` skips the
interview and runs the adapter against an existing approved spec. The spec alone suffices as input;
if the matching ledger still exists it enriches traceability, but its absence is never an error.

ADDED - adapter procedure (rows 4, 5, 6, 11), in references/plan-adapter.md (ADR-0002):
1. Read the approved spec (and ledger if present).
2. Confirm-or-carry (row 8): if the spec has non-empty Assumptions or Open questions sections,
   present them once in a single batch - resolve now, or carry. Carried items land in the plan
   header under "Flagged constraints (unconfirmed)". Nothing is dropped silently.
3. Decompose inline: one task per cluster of related EARS criteria with an independently
   verifiable deliverable (row 11). No hard task cap; the procedure notes plan-runner runs at
   most 6 agents per wave.
4. Emit a flat ordered task list (row 5) - wave grouping belongs to plan-analyzer.
5. Self-check before writing (row 14): if any task's acceptance-criteria block contains a
   reference-only pattern (a criterion number with no WHEN/SHALL sentence), refuse to write the
   plan and name the offending task.
6. Write the plan to docs/plans/YYYY-MM-DD-<slug>.plan.md and commit it (row 7, git-gated).

ADDED - plan file format (rows 3, 4; ADR-0001): a single Markdown file with
- a header: goal, source spec path, flagged constraints carried from the spec;
- delimited per-task sections (### Task N), each containing: owned files, interfaces consumed and
  produced, EARS acceptance criteria as full copied text (never a bare reference number - critic
  finding, row 14: plan-runner's analyzer, dev, and verifier agents only ever see the plan file,
  never the source spec, so a numeric reference leaves the verifier nothing to check), and
  constraints. Never function bodies, test code, or shell commands - plan-runner's TDD agents
  write those. Sections are delimited so 0.3.x can split them into per-task files mechanically.

ADDED - SKILL.md delta (ADR-0002): at most ~4 new lines - the flag, the new gate-2 option, and the
pointer to references/plan-adapter.md.

## Chosen approach

Lazy reference file (ADR-0002) emitting a single structured plan file (ADR-0001). Alternatives and
their rejections are recorded in the two ADRs.

## Data & interfaces

- Input: approved spec at docs/specs/YYYY-MM-DD-<slug>.md (ledger optional).
- Output: docs/plans/YYYY-MM-DD-<slug>.plan.md, committed.
- New file: skills/interview/references/plan-adapter.md (procedure + plan template).
- Modified: skills/interview/SKILL.md (~4 lines), tests/contract.test.js (new pins), README.md,
  CHANGELOG.md, version bump to 0.2.0.

## Edge cases & error handling

- Spec missing or lacking an Acceptance criteria section: the adapter refuses with one sentence
  naming what is missing; it never invents criteria.
- Empty Assumptions and Open questions ("None"): confirm-or-carry is skipped entirely.
- git absent: plan file is written, commit skipped with a note (v0.1.0 policy unchanged).
- Confirm-or-carry answer is empty (the known plugin bug): items carry - carrying is the safe
  default and is visible in the plan header.
- S-scope spec with one criterion cluster: a one-task plan is valid output.

## Acceptance criteria (EARS)

1. WHEN the user selects "Approve + generate plan" at gate 2 THE SKILL SHALL complete spec
   approval and then run the adapter in the same session without further AskUserQuestion calls
   for the offer itself.
2. WHEN `/ideas:interview --plan-runner <spec-path>` is invoked with an approved spec THE SKILL
   SHALL run the adapter without conducting an interview.
3. WHEN the source spec carries non-empty Assumptions or Open questions sections THE SKILL SHALL
   present them once for resolve-or-carry, and carried items SHALL appear in the plan header
   under "Flagged constraints (unconfirmed)".
4. WHEN the adapter decomposes a spec THE SKILL SHALL emit a flat ordered task list where every
   task names its owned files and interfaces and carries the full text of the EARS criteria it
   satisfies - never a bare reference number - and contains no function bodies, test code, or
   shell commands.
4b. WHEN any task's acceptance-criteria block contains a reference-only pattern THE SKILL SHALL
   refuse to write the plan and name the offending task (row 14 self-check).
5. WHEN the plan file is written THE SKILL SHALL place it at docs/plans/YYYY-MM-DD-<slug>.plan.md
   and commit it when git is available.
6. WHEN the source spec lacks an Acceptance criteria section THE SKILL SHALL refuse with a
   one-sentence reason and write nothing.
7. THE PLUGIN SHALL keep SKILL.md <= 150 lines after the adapter delta and pass
   `node --test tests/contract.test.js` and `claude plugin validate .` with new pins covering:
   the gate-2 option set, the --plan-runner flag, confirm-or-carry, the flat-task-list rule,
   the full-criterion-text rule and its reference-only self-check, the contracts-not-code rule
   for plans, and both refusal rules (missing criteria section; reference-only criteria).

## Assumptions (unconfirmed)

- A1: plan-runner's analyzer parses the structured single-file plan without changes. Basis: it
  accepts free-form Markdown plans today; untestable until the adapter's first real run.
- A2: plan-runner's verifier sees the plan-header "Flagged constraints (unconfirmed)" because the
  header is part of the plan text the analyzer ingests. Untested; no plan-runner contract
  guarantees the header reaches per-task verification context.
- A3: the plan header's goal and source-spec-path fields are authored format detail within the
  decided single-file shape (row 3), not user decisions - kept unless the first real run shows
  they confuse plan-analyzer.

## Open questions

None. (O1 resolved at the review gate: refuse-with-reason, ledger row 13.)
