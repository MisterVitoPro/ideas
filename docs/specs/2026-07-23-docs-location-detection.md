# Docs location detection - design spec

Date: 2026-07-23
Status: Approved
Author: MisterVitoPro

## Problem

The ideas plugin always writes its artifacts under a hardcoded `docs/` tree - ledgers and specs to
`docs/specs`, plans to `docs/plans`, ADRs to `docs/adr`. A project that already keeps documentation
somewhere else (say `documentation/` or `.docs/`) gets a second, plugin-imposed `docs/` directory
sitting beside its real docs, instead of the skills placing artifacts where the project's
documentation already lives. (D2)

## Existing system

Prompt-based Claude Code / Codex plugin, version 0.7.0, no runtime code path for path resolution -
skills are Markdown instructions the model follows. Current behavior hardcodes the docs tree in:
`skills/interview/SKILL.md` (resume glob `docs/specs/*-<slug>.ledger.md`; ledger path
`docs/specs/YYYY-MM-DD-<slug>.ledger.md`; ADR path `docs/adr/NNNN-<slug>.md`; context-scan reads
`docs/`), `skills/plan/SKILL.md` (plan path `docs/plans/...`, re-entry glob, `Source spec:`
template line), `skills/plan/references/task-format.md` (plan filename rule),
`skills/plan/references/execution.md` (plan path), and
`skills/interview/references/spec-template.md` (ADR link path). The ledger is gitignored via
`docs/specs/*.ledger.md`. Backward compatibility with this layout is a hard constraint. (D6)

## Goals

- Skills detect where a project already stores documentation and write artifacts there. (D2)
- Detection is automatic with zero configuration. (D2)
- When nothing is detected, behavior is identical to today's `docs/` layout. (D6, A3)
- The interview and plan skills never diverge on the resolved location. (D8)
- The detection rule has a single canonical home and is not duplicated across skills. (D10)

## Non-goals

- No configuration surface (settings file, CLAUDE.md/AGENTS.md key) to override the location. (D2)
- No recursive or monorepo-per-package docs discovery; scan is bounded (top-level conventional
  pass plus a depth-2 artifact pass into each child's `specs`/`plans`/`adr`). (A1, D11)
- No migration or relocation of already-written artifacts when a location changes. (D6)
- No prompt or confirmation gate for the resolved location. (D9)
- No change to the plan file format or task contract (ADR-0005 holds). (D10)

Constraint-conflict check: the "detect adaptively" goal is bounded by the backward-compat
constraint - detection only ever *adds* the ability to pick a non-`docs/` root; the `docs/`
fallback is preserved verbatim, so no existing project's behavior changes.

## Users / consumers

The ideas plugin's own skills (interview, plan, tickets) at runtime resolve paths through this
rule. The user (MisterVitoPro), as plugin author, consumes this spec. (D5)

## Requirements

Changes expressed as deltas against the current hardcoded-`docs/` system.

1. ADDED - A canonical detection/resolution procedure exists as a shared reference
   `skills/interview/references/docs-location.md` describing how to resolve a single docs root
   from the repository. (D10)
2. ADDED - Detection runs two bounded passes in priority order. Pass 1 (artifact pass): for each
   immediate child directory C of the repo root (lexicographic order), inspect `C/specs` for a
   committed ideas spec - a `*.md` file whose content carries the spec-template signature markers
   (a `- design spec` title line AND an `## Acceptance criteria (EARS)` heading), not merely the
   `YYYY-MM-DD-<slug>.md` filename shape; a `C/plans/*.plan.md` or `C/specs/*.ledger.md` is a
   secondary hint only. If the conventional `docs/` directory itself carries a valid ideas spec it
   wins over any other artifact-pass candidate; otherwise the lexicographically first matching C
   sets root=C. Pass 2 (conventional pass, only when pass 1 finds nothing): the highest-priority
   conventional docs directory containing at least one `.md` file, in the order `docs` >
   `documentation` > `doc` > `.docs`. Else the `docs/` fallback.
   (D4, D7, D11, D12, D16, D17, A2, A3)
3. ADDED - Neither pass is recursive or unbounded: the conventional pass inspects only immediate
   children of the repo root, and the artifact pass looks at most one level below each immediate
   child (its `specs`/`plans`/`adr` subdirs). No monorepo per-package auto-discovery. (D11, A1)
4. ADDED - Resolution is deterministic and silent: the artifact pass runs before the conventional
   pass; within each pass, immediate children are iterated in lexicographic order and the first
   match wins; the chosen match is applied with no user prompt. (D7, D15)
5. MODIFIED - The interview skill runs detection once per run and resolves the ledger, spec, and
   ADR paths, the resume glob, the context-scan target, and the `.gitignore` ledger-ignore line
   under the resolved root as `<root>/specs`, `<root>/adr`. (D3, D10)
6. MODIFIED - The plan skill does not run detection. It derives the docs root from the approved
   spec file it reads - the root is the spec file's parent-of-parent (`<root>/specs/<spec>`
   -> `<root>`) - and writes the plan to `<root>/plans` with the re-entry glob under it. (D8)
7. MODIFIED - The plan file's `Source spec:` line and the plan filename rules in
   `task-format.md` and `execution.md` reference the resolved root rather than a literal
   `docs/`. (D3, D8)
8. UNCHANGED (verified) - The tickets skill runs no detection; it derives root and slug from the
   handed plan file path exactly as today. (D8)
9. MODIFIED - The interview skill reports the resolved artifact paths in its existing
   write/commit output (e.g. `documentation/specs/...`); no new prompt is added. WHEN detection
   lands on the `docs/` fallback while a plausible non-conventional candidate child exists (a child
   with a `specs/` subdir, or a notably `.md`-heavy dir), the report also names it in one line
   (e.g. "writing to docs/; existing design/ was not auto-adopted; seed a spec under design/specs
   to switch roots"). (D9, D19)

### Non-functional requirements

10. The change is backward compatible: a repository with no detectable docs location resolves to
    `docs/` and produces byte-for-byte the same paths as before. (D6, A3)
11. Detection performs only local filesystem reads (directory listing at the repo top level and
    the existing context-scan reads); it introduces no network calls. (D2)
12. The detection rule is defined once (`docs-location.md`); plan and tickets carry at most a
    one-line derive-from-path instruction and never restate the detection algorithm. (D10)
13. ADDED - Detection stays prose-only: no runtime resolver module is introduced. The rule is
    verified by static contract assertions over `docs-location.md` (priority list, depth-2
    artifact boundary, durable committed-spec signal, `docs/` fallback), matching the repo's
    existing readFileSync-over-SKILL.md test style. (D14)

## Chosen approach

Auto-detect a single docs root with a deterministic, silent priority rule; keep the plugin's
`specs`/`plans`/`adr` subdirectories under whatever root is resolved. The canonical rule lives in
one shared reference that only the interview skill runs; plan and tickets derive their root from a
path they are already given, so they cannot drift. Alternatives considered: inlining the rule in
each skill (rejected - three drifting copies) and a plugin-root shared doc (rejected - a
cross-skill relative-path dependency for a rule only interview runs). See
`docs/adr/0007-docs-location-detection.md`.

## Architecture & components

- `skills/interview/references/docs-location.md` (new) - the canonical rule: the two-pass scan
  (bounded depth-2 artifact pass, then top-level conventional pass), durable spec-file signal,
  `.md`-content qualifier, `docs/` fallback; yields one resolved root path.
- Interview skill wiring - runs detection once; resolves ledger/spec/ADR paths, resume glob,
  context-scan target, and `.gitignore` append under the root.
- Plan skill wiring - derives root as the read spec's parent-of-parent; no detection.
- Tickets skill wiring - unchanged; root and slug from the handed plan path.
- Reference-file edits - `task-format.md`, `execution.md`, `spec-template.md` use root-relative
  wording.

Data-flow: repo top level -> docs-location rule -> resolved root -> interview writes
`<root>/{specs,adr}`; interview spec path -> plan derives `<root>` -> plan writes `<root>/plans`;
plan path -> tickets derives root/slug.

## Data & interfaces

- Resolved root: a single directory path (relative to repo root), e.g. `docs`, `documentation`,
  `.docs`.
- Artifact paths under the root: `<root>/specs/YYYY-MM-DD-<slug>.ledger.md`,
  `<root>/specs/YYYY-MM-DD-<slug>.md`, `<root>/plans/YYYY-MM-DD-<slug>.plan.md`,
  `<root>/adr/NNNN-<slug>.md`.
- `.gitignore` ledger-ignore line: `<root>/specs/*.ledger.md`.
- Conventional-name priority list (fixed): `docs` > `documentation` > `doc` > `.docs`.
- Durable ideas-artifact signal: a committed spec file under an immediate child's `C/specs/`
  whose content carries the spec-template signature - a `- design spec` title line AND an
  `## Acceptance criteria (EARS)` heading. Filename shape alone is not a signal. Secondary hints
  (non-durable, may be gitignored/absent after clone): `C/plans/*.plan.md`, `C/specs/*.ledger.md`.

## Edge cases & error handling

- Multiple conventional dirs exist (e.g. both `docs/` and `documentation/`): pick by fixed
  priority, silently. (D7)
- A conventional dir exists but is empty / has no `.md`: it is not a signal; fall through to the
  next candidate, ultimately the `docs/` fallback. (A2)
- No docs directory anywhere: resolve to `docs/` and create `docs/{specs,plans,adr}` on first
  write, as today. (A3)
- Ideas artifacts live in a non-conventional dir (e.g. `design/`): the artifact pass looks into
  `design/specs`, finds a spec carrying the ideas signature markers, and sets root=`design/` - it
  outranks the conventional pass. This is the depth-2 case D11 exists to make satisfiable.
  (D4, D7, D11, D16)
- Lookalike file, not an ideas spec (e.g. `api/specs/2024-01-01-openapi.md`): the content check
  (D16) fails - no `- design spec` title / `## Acceptance criteria (EARS)` heading - so `api/` is
  not a signal, and detection falls through to the conventional pass and `docs/`. Filename shape
  alone never triggers a root. (D16)
- Both a real `docs/` ideas spec and a non-conventional ideas dir exist: the `docs/` docs-bias
  short-circuit (D17) wins, so an upgraded existing project never silently migrates its root away
  from `docs/`. (D17)
- Only a gitignored ledger/plan survives (fresh clone dropped `*.ledger.md`): the committed spec
  file remains the durable signal, so re-detection still resolves the same root; the ledger's
  absence does not silently drop the root back to `docs/`. (D12)
- Plan reads a spec at `<root>/specs/...`: root is unambiguously the parent-of-parent; plan never
  re-detects, so a repo change between interview and plan cannot cause a mismatch. (D8)
- Ledger `.gitignore` entry: appended under the resolved root; a pre-existing `docs/specs/*.ledger.md`
  entry is left as-is when the root is `docs/`. (D6)

## Acceptance criteria (EARS)

- WHEN an immediate child directory C of the repository root has a `C/specs/*.md` file whose
  content carries the ideas spec-template signature (a `- design spec` title line AND an
  `## Acceptance criteria (EARS)` heading), THE SYSTEM SHALL treat C as an artifact-pass
  candidate; IF the file matches only by `YYYY-MM-DD-<slug>.md` filename shape without those
  content markers, THEN THE SYSTEM SHALL NOT treat C as a candidate. (D4, D7, D11, D12, D16)
- WHEN the conventional `docs/` directory itself carries a valid ideas spec, THE SYSTEM SHALL
  resolve the docs root to `docs/` in preference to any other artifact-pass candidate; otherwise
  WHEN more than one candidate C exists, THE SYSTEM SHALL choose the lexicographically first.
  (D15, D17)
- WHEN no ideas-artifact directory is found by the artifact pass AND one or more conventional docs
  directories (`docs`, `documentation`, `doc`, `.docs`) contain at least one `.md` file, THE
  SYSTEM SHALL resolve the docs root to the highest-priority such directory in the order
  `docs` > `documentation` > `doc` > `.docs`. (D4, D7, D11, A2)
- IF the artifact pass finds nothing and no conventional docs directory with a `.md` file exists,
  THEN THE SYSTEM SHALL resolve the docs root to `docs/` and create `docs/{specs,plans,adr}` on
  first write. (A3)
- WHILE running the artifact pass, THE SYSTEM SHALL look at most one level below each immediate
  child (its `specs`/`plans`/`adr` subdirectories) and SHALL NOT descend further; WHILE running
  the conventional pass, THE SYSTEM SHALL consider only immediate children of the repository root.
  (D11, A1)
- WHEN more than one candidate resolves at the same tier, THE SYSTEM SHALL choose the
  lexicographically first candidate without prompting the user. (D7, D15)
- WHEN the interview skill resolves a root, THE SYSTEM SHALL write the ledger, spec, and ADR
  under `<root>/specs` and `<root>/adr`, and SHALL target the resume glob, context scan, and the
  `.gitignore` ledger-ignore line at that root. (D3, D5)
- WHEN the plan skill reads an approved spec, THE SYSTEM SHALL set the docs root to the spec
  file's parent-of-parent directory and SHALL NOT run detection itself. (D8)
- WHEN the plan skill writes a plan, THE SYSTEM SHALL write it to `<root>/plans` and reference the
  source spec by its actual resolved path. (D8)
- WHEN a run resolves the docs root, THE SYSTEM SHALL state the resolved artifact paths in its
  existing write/commit output and SHALL NOT add a new prompt or confirmation gate. (D9)
- IF detection resolves to the `docs/` fallback WHILE a plausible non-conventional candidate child
  exists (a child with a `specs/` subdir, or a notably `.md`-heavy dir), THEN THE SYSTEM SHALL
  name that candidate in one line of the write report and state how to switch roots by seeding a
  spec there. (D19)
- WHEN a repository has no detectable docs location, THE SYSTEM SHALL produce the same artifact
  paths as the pre-change `docs/` layout. (D6, A3)

## Verification strategy

Detection is prose executed by the model (D14), not a callable function - so verification mirrors
the repo's existing style: `readFileSync` + string/regex assertions over skill/reference Markdown,
never a live skill run. The unit/integration/manual grouping below is an assumed default (A4), not
a user-elicited decision.

- `unit` (static contract) - Assert `skills/interview/references/docs-location.md` exists and its
  prose states: the priority list `docs` > `documentation` > `doc` > `.docs`; the two passes
  (artifact then conventional); the depth-2 artifact-pass boundary; the content-check signal
  (`- design spec` title + `## Acceptance criteria (EARS)` heading, not filename shape); the
  `docs/` docs-bias short-circuit; the lexicographic-first tie-break; and the `docs/` fallback.
  Mirrors the existing `tests/*.test.js` readFileSync-over-`SKILL.md` assertions. (D14, D16, D17)
- `unit` (static contract) - Assert the interview SKILL cites `docs-location.md` and resolves
  ledger/spec/ADR paths, resume glob, and `.gitignore` line under the resolved root; assert the
  plan SKILL derives its root from the spec path and does not restate the detection algorithm;
  assert the reference files (`task-format.md`, `execution.md`, `spec-template.md`) use
  root-relative wording. (D10, D12)
- `manual` (documented protocol, D13) - Divergence protocol, run by hand since the JS harness
  cannot execute a live interview: run 1 writes to a non-conventional root (`design/specs/...`);
  confirm run 2's interview re-resolves to `design/` (not `docs/`) via the durable committed spec,
  and that the plan re-entry glob resolves to `design/plans`. Also run the interview in a repo
  whose docs live in `documentation/` and confirm artifacts land under `documentation/specs` and
  the write report names that path.
- `manual` (false-positive guard, D18) - In a repo containing a non-ideas
  `api/specs/2024-01-01-openapi.md` alongside a real `docs/specs/<ideas spec>.md`, confirm
  detection resolves to `docs/` (the lookalike fails the content check and the docs-bias
  short-circuit holds), never to `api/`. (D16, D17, D18)
- `manual` (false-negative boundary, D20) - In a repo whose docs live only in `design/` with no
  ideas spec present, confirm detection resolves to `docs/` (the documented O1 boundary) AND that
  the write report emits the D19 warning line naming `design/`. Documents the known limit rather
  than asserting adoption. (D19, D20, O1)

## Assumptions (unconfirmed)

- A1 (Scan boundary): Bounded scan - the conventional pass is top-level only; the artifact pass
  looks at most one level below each immediate child (its `specs`/`plans`/`adr`). Neither pass is
  recursive. Binding default, welded to the WHILE-scanning EARS criterion above. (superseded by
  D11 from the original top-level-only wording)
- A2 (Real-content qualifier): A conventional docs dir counts only with at least one `.md` file -
  Binding default, welded to the second WHEN criterion above.
- A3 (Fallback): No signal resolves to `docs/` with subdir creation on first write - Binding
  default, welded to the IF criterion above.
- A4 (Verification approach): The unit/integration/manual test breakdown in Verification strategy
  is an assumed default, not a user-elicited decision; reversible, so it is a binding default
  rather than an open question.

## Open questions

- O1 (Non-conventional first-use scope): A project whose docs live under a non-conventional
  directory name (`design/`, `wiki/`, `notes/`, `rfcs/`, ...) with no ideas artifacts yet is not
  auto-adopted on first use - detection falls back to `docs/`, and once a spec is written there the
  D17 docs-bias short-circuit keeps `docs/` winning. Why it matters: for that class of repo the
  plugin creates the very "second `docs/` tree beside the real docs" the Problem section names.
  Accepted consequence of the no-config-surface decision (D2); the only adoption path is seeding an
  ideas spec under `<dir>/specs`, which D19's warning line tells the user how to do. Knowingly out
  of first-use scope for this change, not a defect to fix now.

## Definition of done

- Static contract tests written and passing (no runtime resolver module; the divergence check is
  a documented manual protocol, not an automated test). (D14)
- `docs-location.md` prescribes a total resolution order (artifact pass before conventional pass;
  lexicographic-first within a pass), so identical repo state yields the same resolved root when
  the model follows it. (D15)
- Existing behavior preserved outside the described change: a repo without a detectable docs
  location resolves to `docs/` and yields the same paths as today.
- Stated platform, runtime, and environment floors honored (prompt-based skills; no new runtime).
- No new network calls unless specified in Data & interfaces.
- Docs updated where user- or operator-visible behavior changed (README/CHANGELOG note the
  auto-detection; ADR-0007 recorded).
- Every acceptance criterion above passes.
