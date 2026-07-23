# Docs location detection - implementation plan

Goal: Replace the ideas plugin's hardcoded `docs/` artifact tree with a deterministic two-pass detection of the project's existing docs root, preserving today's `docs/` layout as the fallback.
Source spec: docs/specs/2026-07-23-docs-location-detection.md
Flagged constraints (unconfirmed):
- A1 (Scan boundary): bounded scan - conventional pass is top-level only; artifact pass looks at most one level below each immediate child (`specs`/`plans`/`adr`). Neither pass is recursive. Binding default welded to an EARS criterion.
- A2 (Real-content qualifier): a conventional docs dir counts as a signal only if it holds at least one `.md` file. Binding default.
- A3 (Fallback): no signal resolves to `docs/`, creating `docs/{specs,plans,adr}` on first write. Binding default.
- A4 (Verification approach): the static-contract + manual-protocol split is an assumed default, not user-elicited; reversible.
- O1 (Open - non-conventional first-use scope): a project whose docs live under a non-conventional name (`design/`, `wiki/`, `notes/`) with no ideas artifacts yet is NOT auto-adopted on first use; it falls back to `docs/` and D17 then locks `docs/` in. Accepted consequence of the no-config-surface decision; the only adoption path is seeding an ideas spec under `<dir>/specs`. Knowingly out of scope for this change.

### Task 1: Author the canonical docs-location resolution rule
Task ID: docs-location-detection-t01
Owned files: skills/interview/references/docs-location.md
Interfaces: consumes nothing; produces the canonical resolved-root procedure cited by the interview skill (Task 2), referenced in wording by the plan skill (Task 3) and bundled references (Task 4), and asserted by the static contract tests (Task 5)
Acceptance criteria:
- WHEN the reference is authored THE SYSTEM SHALL define a two-pass resolution procedure in which an artifact pass runs before a conventional pass, and SHALL state that the first match wins.
- WHEN describing the artifact pass THE SYSTEM SHALL specify that for each immediate child directory C of the repository root, taken in lexicographic order, `C/specs` is inspected for a committed ideas spec.
- WHEN defining what counts as a committed ideas spec THE SYSTEM SHALL require content markers - a `- design spec` title line AND an `## Acceptance criteria (EARS)` heading - and SHALL state that a `YYYY-MM-DD-<slug>.md` filename shape alone is not a signal.
- IF a candidate file matches only by filename shape without those content markers THEN THE SYSTEM SHALL NOT treat its directory as an artifact-pass candidate.
- WHEN the conventional `docs/` directory itself carries a valid ideas spec THE SYSTEM SHALL resolve the root to `docs/` in preference to any other artifact-pass candidate (docs-bias short-circuit).
- WHEN more than one artifact-pass candidate remains after the docs-bias short-circuit THE SYSTEM SHALL select the lexicographically first candidate.
- WHEN the artifact pass finds no candidate THE SYSTEM SHALL run a conventional pass selecting the highest-priority immediate-child directory containing at least one `.md` file, in the fixed order `docs` > `documentation` > `doc` > `.docs`.
- IF neither pass yields a candidate THEN THE SYSTEM SHALL resolve the root to `docs/` and create `<root>/specs`, `<root>/plans`, and `<root>/adr` on first write.
- WHILE running the artifact pass THE SYSTEM SHALL look at most one level below each immediate child (its `specs`/`plans`/`adr` subdirectories) and SHALL NOT descend further; WHILE running the conventional pass THE SYSTEM SHALL consider only immediate children of the repository root.
- WHEN a root is resolved THE SYSTEM SHALL apply it silently without any user prompt or confirmation gate.
- IF resolution lands on the `docs/` fallback WHILE a plausible non-conventional candidate child exists (a child holding a `specs/` subdirectory, or a notably `.md`-heavy directory) THEN THE SYSTEM SHALL require the caller to name that candidate in one line of its write report and state that seeding a spec under `<candidate>/specs` switches roots.
- WHEN the reference describes secondary hints THE SYSTEM SHALL mark `C/plans/*.plan.md` and `C/specs/*.ledger.md` as non-durable (may be gitignored or absent after clone) and SHALL name the committed spec file as the durable signal.
Verification: `test -f skills/interview/references/docs-location.md` and confirm each required clause is present, e.g. `grep -c "documentation" skills/interview/references/docs-location.md` plus manual read-through against the twelve criteria above; Task 5 converts these into automated assertions.
Non-goals:
- Does not edit any SKILL.md (Tasks 2 and 3 own those).
- Does not introduce a runtime resolver module, function, or script - the rule is prose only.
- Does not add a configuration surface or override key.
- Does not write tests (Task 5 owns them).
Blocked by: none
Constraints: Prose only, no code bodies. Follows the lazy-reference convention of ADR-0002/0006 - loaded by the interview skill, not inlined. Target a tight reference (roughly 40-70 dense lines); the rule is stated once here and never restated in a SKILL.md. Detection performs local filesystem reads only, no network calls.

### Task 2: Wire the interview skill to the resolved docs root
Task ID: docs-location-detection-t02
Owned files: skills/interview/SKILL.md
Interfaces: consumes the resolved-root procedure from `skills/interview/references/docs-location.md` (Task 1); produces spec files at `<root>/specs/YYYY-MM-DD-<slug>.md` that the plan skill (Task 3) derives its root from
Acceptance criteria:
- WHEN the interview skill runs THE SYSTEM SHALL resolve the docs root exactly once per run by citing `references/docs-location.md`, and SHALL NOT restate the detection algorithm inline.
- WHEN the interview writes the ledger THE SYSTEM SHALL place it at `<root>/specs/YYYY-MM-DD-<slug>.ledger.md`.
- WHEN the interview writes the approved spec THE SYSTEM SHALL place it at `<root>/specs/YYYY-MM-DD-<slug>.md`.
- WHEN the interview writes an ADR THE SYSTEM SHALL place it at `<root>/adr/NNNN-<slug>.md`.
- WHEN the resume check looks for an in-progress ledger THE SYSTEM SHALL glob under `<root>/specs/` rather than a literal `docs/specs/`.
- WHEN the context scan reads existing documentation and ADRs THE SYSTEM SHALL target `<root>/` and `<root>/adr/`.
- WHEN the ledger is first written THE SYSTEM SHALL append the ignore line `<root>/specs/*.ledger.md` to the target repo's .gitignore; IF an equivalent entry already exists THEN THE SYSTEM SHALL leave it unchanged.
- WHEN the interview reports written or committed files THE SYSTEM SHALL state the resolved artifact paths in that existing output and SHALL NOT add a new prompt or confirmation gate.
- IF the resolved root is the `docs/` fallback WHILE a plausible non-conventional candidate child exists THEN THE SYSTEM SHALL emit one additional line naming that candidate and stating that seeding a spec under `<candidate>/specs` switches roots.
- WHEN a repository has no detectable docs location THE SYSTEM SHALL produce the same artifact paths as the pre-change `docs/` layout.
Verification: `node --test tests/docs-location.test.js` once Task 5 lands; before that, `grep -n "docs-location" skills/interview/SKILL.md` confirms the citation and `grep -n "docs/specs" skills/interview/SKILL.md` returns no hardcoded write paths.
Non-goals:
- Does not define or duplicate the detection algorithm (Task 1 owns the rule).
- Does not change the interview's question waves, gates, elicitation floor, or audit/critic flow.
- Does not touch the plan or tickets skills.
- Does not add a configuration surface or a location confirmation prompt.
Blocked by: docs-location-detection-t01
Constraints: Keep the skill's existing structure and section headings; this is a path-resolution rewiring, not a flow change. The detection rule is cited, never restated (NFR-12). Preserve the "docs/ may not exist in the target repo - create it on first write" gotcha, generalized to the resolved root. Prose only, no code bodies.

### Task 3: Wire the plan skill to derive its root from the spec path
Task ID: docs-location-detection-t03
Owned files: skills/plan/SKILL.md
Interfaces: consumes the spec path produced by the interview skill (Task 2) and the resolved-root vocabulary from `docs-location.md` (Task 1); produces plan files at `<root>/plans/YYYY-MM-DD-<slug>.plan.md` consumed unchanged by the tickets skill and plan-runner
Acceptance criteria:
- WHEN the plan skill reads an approved spec THE SYSTEM SHALL set the docs root to that spec file's parent-of-parent directory (`<root>/specs/<spec>` yields `<root>`) and SHALL NOT run detection itself.
- WHEN the plan skill writes a plan THE SYSTEM SHALL write it to `<root>/plans/YYYY-MM-DD-<slug>.plan.md`.
- WHEN the plan skill performs its re-entry check THE SYSTEM SHALL glob for an existing plan under `<root>/plans/` rather than a literal `docs/plans/`.
- WHEN the plan template emits its `Source spec:` line THE SYSTEM SHALL reference the spec by its actual resolved path rather than a literal `docs/specs/` path.
- WHEN the plan skill reports the written plan file THE SYSTEM SHALL state the resolved path in its existing output.
- IF the spec path supplied to the plan skill is not of the shape `<root>/specs/<file>.md` THEN THE SYSTEM SHALL treat the spec file's parent directory's parent as the root and SHALL NOT silently default to `docs/`.
- WHEN the plan skill describes root resolution THE SYSTEM SHALL keep it to at most a one-line derive-from-path instruction and SHALL NOT restate the detection algorithm.
Verification: `node --test tests/docs-location.test.js` once Task 5 lands; before that, `grep -n "docs/plans" skills/plan/SKILL.md` returns no hardcoded write paths and `grep -n "parent" skills/plan/SKILL.md` confirms the derive-from-spec rule.
Non-goals:
- Does not run or duplicate the detection algorithm (Task 1 owns it; plan derives, never detects).
- Does not change the plan file format, task-section contract, or task-ID scheme (ADR-0005 holds).
- Does not change the completion gate's option list or routing behavior.
- Does not touch the interview or tickets skills.
Blocked by: docs-location-detection-t01
Constraints: The derive-from-path rule must be at most one line so the detection rule stays single-homed (NFR-12). Preserve the existing re-entry check, confirm-or-carry step, self-check refusal, and completion gate semantics verbatim apart from path wording. Prose only, no code bodies.

### Task 4: Make bundled reference files root-relative
Task ID: docs-location-detection-t04
Owned files: skills/plan/references/task-format.md, skills/plan/references/execution.md, skills/interview/references/spec-template.md
Interfaces: consumes the resolved-root vocabulary from `docs-location.md` (Task 1); produces root-relative wording asserted by the static contract tests (Task 5)
Acceptance criteria:
- WHEN `task-format.md` states the plan-file naming requirement THE SYSTEM SHALL express it as `<root>/plans/YYYY-MM-DD-<slug>.plan.md` rather than a literal `docs/plans/` path.
- WHEN `execution.md` refers to the plan file location THE SYSTEM SHALL express it relative to the resolved root rather than a literal `docs/plans/` path.
- WHEN `spec-template.md` instructs the author to link an ADR THE SYSTEM SHALL express the target as `<root>/adr/NNNN-<slug>.md` rather than a literal `docs/adr/` path.
- WHEN any of these references mention the resolved root THE SYSTEM SHALL NOT restate the detection algorithm and SHALL leave root resolution to `docs-location.md`.
- WHEN these edits are applied THE SYSTEM SHALL preserve every other field definition, validation rule, and section of the three files unchanged.
Verification: `grep -n "docs/plans\|docs/adr" skills/plan/references/task-format.md skills/plan/references/execution.md skills/interview/references/spec-template.md` returns no hardcoded artifact paths, and `node --test tests/docs-location.test.js` passes once Task 5 lands.
Non-goals:
- Does not change the nine-field task-section contract, field order, or validation rules in task-format.md.
- Does not change execution.md's inline/subagent procedures or done-ness rule.
- Does not change spec-template.md's section list or EARS guidance.
- Does not touch any SKILL.md.
Blocked by: docs-location-detection-t01
Constraints: Wording-only edits; these three files are read by downstream skills and plan-runner, so structural changes are out of bounds. The plan file format is untouched (ADR-0005 holds).

### Task 5: Static contract tests for detection and wiring
Task ID: docs-location-detection-t05
Owned files: tests/docs-location.test.js, package.json
Interfaces: consumes `docs-location.md` (Task 1), `skills/interview/SKILL.md` (Task 2), `skills/plan/SKILL.md` (Task 3), and the three reference files (Task 4); produces an automated regression gate runnable via `npm test`
Acceptance criteria:
- WHEN the test suite runs THE SYSTEM SHALL assert that `skills/interview/references/docs-location.md` exists and its prose states the conventional priority order `docs` > `documentation` > `doc` > `.docs`.
- WHEN asserting the detection rule THE SYSTEM SHALL verify the reference states both passes (artifact before conventional), the depth-2 artifact-pass boundary, the content-check signal (`- design spec` title plus `## Acceptance criteria (EARS)` heading, not filename shape), the `docs/` docs-bias short-circuit, the lexicographic-first tie-break, and the `docs/` fallback.
- WHEN asserting the interview wiring THE SYSTEM SHALL verify `skills/interview/SKILL.md` cites `docs-location.md` and contains no hardcoded `docs/specs` or `docs/adr` write path.
- WHEN asserting the plan wiring THE SYSTEM SHALL verify `skills/plan/SKILL.md` derives its root from the spec path, contains no hardcoded `docs/plans` write path, and does not restate the detection algorithm.
- WHEN asserting the bundled references THE SYSTEM SHALL verify `task-format.md`, `execution.md`, and `spec-template.md` use root-relative wording with no hardcoded `docs/plans` or `docs/adr` artifact paths.
- WHEN asserting the tickets skill THE SYSTEM SHALL verify `skills/tickets/SKILL.md` contains no detection algorithm and derives root and slug from the handed plan path, confirming it is unchanged by this feature.
- WHEN the new test file is added THE SYSTEM SHALL register it in the `test` script in package.json so `npm test` executes it alongside the existing contract tests.
- IF any asserted clause is absent from its target file THEN THE SYSTEM SHALL fail the corresponding test naming the missing clause.
Verification: `npm test` exits zero and its output includes the docs-location test cases.
Non-goals:
- Does not introduce a runtime resolver module or test any callable resolution function - detection is prose executed by the model, so assertions are static text checks only.
- Does not execute a live interview or plan run; the two-run divergence check is a manual protocol owned by Task 6.
- Does not modify any skill or reference file to make assertions pass (Tasks 1-4 own those).
- Does not broaden the npm test script to glob all of `tests/`, which would sweep in unrelated existing test files.
Blocked by: docs-location-detection-t01, docs-location-detection-t02, docs-location-detection-t03, docs-location-detection-t04
Constraints: Use `node --test` with `node:test`/`node:assert`, matching the existing `tests/contract.test.js` style of `readFileSync` plus string/regex assertions. Extend the package.json `test` script by appending the new file path explicitly (`node --test tests/contract.test.js tests/docs-location.test.js`), leaving the existing entry intact.

### Task 6: Manual verification protocol and user-facing docs
Task ID: docs-location-detection-t06
Owned files: docs/release/docs-location-smoke.md, README.md, CHANGELOG.md
Interfaces: consumes the resolution rule from `docs-location.md` (Task 1); produces an operator-runnable smoke protocol and user-facing documentation of the new behavior
Acceptance criteria:
- WHEN the smoke protocol is authored THE SYSTEM SHALL document a divergence check in which run 1 writes to a non-conventional root (`design/specs/...`), run 2's interview re-resolves to `design/` rather than `docs/` via the durable committed spec, and the plan re-entry glob resolves to `design/plans`.
- WHEN the smoke protocol is authored THE SYSTEM SHALL document a conventional-root check confirming that in a repo whose docs live in `documentation/`, artifacts land under `documentation/specs` and the write report names that path.
- WHEN the smoke protocol is authored THE SYSTEM SHALL document a false-positive guard in which a repo containing a non-ideas `api/specs/2024-01-01-openapi.md` alongside a real `docs/specs/<ideas spec>.md` resolves to `docs/` and never to `api/`.
- WHEN the smoke protocol is authored THE SYSTEM SHALL document a false-negative boundary case in which a repo whose docs live only in `design/` with no ideas spec resolves to `docs/` and the write report emits the warning line naming `design/`.
- WHEN each protocol case is written THE SYSTEM SHALL state its setup, the exact expected resolved root, and a pass/fail condition an operator can judge without reading the source spec.
- WHEN README describes where artifacts are written THE SYSTEM SHALL state that the location is auto-detected from the project's existing docs directory with `docs/` as the fallback, replacing the current hardcoded `docs/specs` and `docs/adr` claims.
- WHEN CHANGELOG is updated THE SYSTEM SHALL add an entry under an `## [Unreleased]` heading describing the auto-detected docs root, the `docs/` fallback, and the known O1 first-use limitation for non-conventionally-named directories.
Verification: manual - read `docs/release/docs-location-smoke.md` and confirm all four cases carry setup, expected root, and pass/fail condition; `grep -n "auto-detect" README.md CHANGELOG.md` returns the new wording.
Non-goals:
- Does not bump the plugin version or perform any release step (version bump, git tag, and marketplace pin are a separate release protocol).
- Does not automate the manual protocol as a JS test (Task 5 covers what is statically assertable).
- Does not modify any skill or reference file.
- Does not attempt to resolve the O1 limitation, which is documented rather than fixed.
Blocked by: docs-location-detection-t01
Constraints: Follow the existing `docs/release/plan-stage-smoke.md` shape for the smoke doc. CHANGELOG follows the repo's Keep-a-Changelog style; use `## [Unreleased]` so no version number is pre-committed. README edits are scoped to the artifact-location claims around the current `docs/specs` and `docs/adr` mentions.
