# Docs-location resolution

Canonical procedure for resolving the root directory under which specs, plans, and ADRs are
written. Run once per interview session; the resolved root is applied silently, with no user
prompt or confirmation gate. Detection is local filesystem reads only - no network calls, no
runtime resolver module, no configuration surface or override key. Two passes run in order;
the first pass to produce a candidate wins and the other pass does not run.

## Pass 1: artifact pass

For each immediate child directory `C` of the repository root, taken in lexicographic order,
inspect `C/specs` for a committed ideas spec. A file counts as a committed ideas spec only by
content markers, never by name alone: it must carry a `- design spec` title line AND an
`## Acceptance criteria (EARS)` heading. A file named to the `YYYY-MM-DD-<slug>.md` shape is not
itself a signal - a candidate file that matches only that filename shape without both content
markers does NOT make its directory an artifact-pass candidate.

The artifact pass looks at most one level below each immediate child - its `specs`, `plans`, and
`adr` subdirectories - and does not descend further. It does not consider the repository root's
own files.

Docs-bias short-circuit: when the conventional `docs/` directory itself carries a valid ideas
spec (both content markers present), resolve the root to `docs/` in preference to any other
artifact-pass candidate, even one that lexicographically precedes `docs`. Apply this check before
ranking remaining candidates.

If the docs-bias short-circuit does not apply and more than one artifact-pass candidate remains,
select the lexicographically first candidate by directory name.

## Pass 2: conventional pass

Runs only when the artifact pass finds no candidate. Considers only immediate children of the
repository root - no descent into subdirectories. Select the highest-priority immediate child
directory holding at least one `.md` file directly inside it - a `.md` file nested deeper in that
child's own subtree does not qualify the child - in the fixed priority order
`docs` > `documentation` > `doc` > `.docs`. The first name in that order with a qualifying
directory present wins; lower-priority names are not evaluated once a match is found.

## Fallback

If neither pass yields a candidate, resolve the root to `docs/` and create `<root>/specs`,
`<root>/plans`, and `<root>/adr` on first write.

## Fallback disclosure

If resolution lands on the `docs/` fallback while a plausible non-conventional candidate child
exists - a child holding a `specs/` subdirectory, or a directory that is notably `.md`-heavy
relative to its siblings - the caller must name that candidate in one line of its write report,
and state that seeding a spec under `<candidate>/specs` switches roots on the next run.

## Secondary hints (non-durable)

`C/plans/*.plan.md` and `C/specs/*.ledger.md` may be gitignored and are commonly absent after a
fresh clone; they are non-durable secondary hints only and never substitute for the artifact-pass
content markers. The committed spec file - matching both the `- design spec` title line and the
`## Acceptance criteria (EARS)` heading - is the durable signal the artifact pass relies on.
