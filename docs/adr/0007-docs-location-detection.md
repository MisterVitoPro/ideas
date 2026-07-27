# ADR-0007: Auto-detect the docs root; canonical rule as a lazy reference in interview

Status: accepted
Date: 2026-07-23

## Context

The interview, plan, and tickets skills hardcode `docs/specs`, `docs/plans`, and `docs/adr` as
the write locations for ledgers, specs, plans, and ADRs. A project that already keeps its
documentation elsewhere (for example `documentation/` or `.docs/`) ends up with a second,
plugin-imposed `docs/` tree instead of the skills placing artifacts where its docs already live.

The skills are prompt-based Markdown, not code, so "detection" is a procedure the model follows.
Only the interview skill originates artifacts by name; the plan skill reads an already-written
spec and the tickets skill is handed an already-written plan path. So the full detection logic is
needed in exactly one place, and duplicating it into three skills would let the copies drift.

## Options

1. Inline the full detection rule in each of the three SKILL.md files - no new file, but three
   copies of the same prose that drift out of sync.
2. Canonical rule in a new shared reference `skills/interview/references/docs-location.md`,
   cited and run by interview; plan and tickets carry only a one-line derive-from-path rule and
   never run detection.
3. Canonical rule at a plugin-root shared doc referenced by all skills via `../../` - most
   centralized, but adds a cross-skill relative-path dependency for a rule only interview runs.

## Decision

Option 2. The detection/resolution rule (signals, priority order, scan boundary, content
qualifier, fallback) lives in `skills/interview/references/docs-location.md`, following the
lazy-reference convention of ADR-0002 and ADR-0006. Interview runs detection once per run and
resolves every path under the returned root. Plan derives its root from the spec file it reads
(the spec's parent-of-parent) and never re-detects, so interview and plan cannot diverge on
location. Tickets derives root and slug from the handed plan path, unchanged.

Detection is auto, no config, and runs two bounded passes. Pass 1 (artifact pass): for each
immediate child directory C of the repo root, look one level in at `C/specs`, `C/plans`, `C/adr`
for ideas artifacts - the durable signal being a committed spec file `C/specs/…​.md`, since
`*.ledger.md` is gitignored and absent after a clone - and the first match sets root=C. Pass 2
(conventional pass, only when pass 1 finds nothing): the highest-priority conventional docs
directory containing at least one `.md` file, in the order `docs` > `documentation` > `doc` >
`.docs`, at the repository top level only. Else the existing `docs/` default. The two-pass shape
resolves a contradiction a plain top-level-only scan would have created: the plugin's own
artifacts always live at depth 2, so a strict top-level scan could never re-detect a
non-conventional root and the interview/plan location guarantee would break on the second run.

## Consequences

- Projects with an established docs location get artifacts written there with zero setup; projects
  without one behave exactly as today (`docs/` fallback), so the change is backward compatible.
- The detection rule has a single home; plan and tickets stay thin and cannot drift from it.
- The plan file format is untouched (ADR-0005 holds); only the resolved directory changes.
- Monorepo per-package docs directories are out of scope for the auto-default (top-level scan
  only); a user who wants a nested location moves the files, which is reversible.
