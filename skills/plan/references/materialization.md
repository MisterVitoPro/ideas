# Transactional skeleton materialization

`scripts/materialize-bundle.mjs` materializes the already validated, normalized bundle produced by
the plan procedure. It is an offline transaction: it imports only Node built-ins, does not invoke a
project generator, and never consults the network.

## Invocation

CLI (the plan procedure's path): `node scripts/materialize-bundle.mjs <request.json> [--preflight]`.
It prints exactly one JSON object to stdout and sets exit code 1 on refusal, conflict, or failure:
`{ ok, mode, plan, planPath, entries, conflicts, createdPaths }` on success, or
`{ ok: false, error, conflicts }` when it declined. `--preflight` reports classifications and
conflicts without writing.

Library: `materializeBundle(bundlePath, options)` returns the same report plus `manifest`,
`graph`, and an idempotent `rollback()`; `options` accepts `preflightOnly` and
`injectFailureAfterWrites`.

## Validated input contract

The local JSON request contains `schemaVersion: 1` and an absolute `repositoryRoot`, then either:

- **document mode** (plan-native bundle): `planPath` (`.../YYYY-MM-DD-<slug>.plan.md`), a
  `document`, optional `entries`, and an optional `graph`. The plan identity defaults to the
  normalized `planPath`; `manifestPath`/`graphPath` default to the adjacent sidecars and may not
  point elsewhere. The canonical plan is rendered from `document` and written in the same
  transaction as the skeleton and sidecars.
- **legacy mode** (sidecars and skeleton only): the canonical `plan` identity, repository-relative
  `manifestPath` and `graphPath`, `entries`, and the version-1 `graph`.

`document` carries `title`, `goal`, `sourceSpec`, `flaggedConstraints` (array, may be empty) and
ordered `tasks`, each with `title`, `taskId` (`<slug>-t<NN>`), `ownedFiles`, `interfaces`,
`acceptanceCriteria` (each a WHEN/IF ... SHALL sentence), `verification`, `nonGoals`, `blockedBy`
(task IDs), and `constraints`. Validation refuses, naming the task: a reference-only criterion,
owned files shared by two tasks, an unknown or self blocker, a cycle, a non-first task with no
blocker when the plan has two or more tasks, and a literal `<...>` placeholder in any field.

Every entry supplies a normalized `path`. With an explicit `strategyId` (checked-in or `null`) the
`content` defaults to that strategy's safe placeholder and is validated strictly: unknown
strategies, strategy/extension mismatches, non-string content, and non-empty opaque placeholders
are rejected. With no `strategyId` the entry is resolved at preflight: a missing path receives the
placeholder of the strategy its extension selects (or a zero-byte opaque placeholder), and an
existing path is `verified-compatible` only when its bytes equal that placeholder, otherwise
`opaque-preserved`. Owned files without an entry become such auto entries. Duplicate targets and
file/directory overlaps are rejected before mutation.

The graph is validated structurally against the version-1 schema and the identity rules in
`graph-projection.md`. In document mode the script derives task and file nodes, `owns` edges from
`ownedFiles`, `depends-on` edges from `blockedBy`, and every edge ID; the request's `graph` adds
module/contract nodes and connection edges (an omitted connection assurance defaults to
`declarative-unverified`), and a planned path owned by no task is rejected.

## Repository-boundary check

All entry and sidecar paths pass the same portable validation. POSIX absolute paths, Windows drive
paths, UNC paths, both slash forms of `..` traversal, empty paths, and NUL bytes are rejected. The
helper then resolves each target below the absolute repository root and checks the nearest existing
ancestor's real path, preventing an in-repository symbolic link from redirecting a write outside the
repository. Newly encountered parent components are checked again while applying the transaction.

## Complete preflight

Preflight reads and classifies every source target before any source, directory, or sidecar is
created:

- absent targets are `missing`;
- supported targets whose bytes equal the validated planned content are `verified-compatible`;
- existing unsupported targets are `opaque-preserved` without parsing or editing; and
- supported targets with different bytes are `conflicting`.

`{ preflightOnly: true }` returns the full report without applying changes, including all conflicts.
Normal apply reports every conflicting source or incompatible existing sidecar together on the
thrown error's `conflicts` array and leaves the repository untouched. Verified and opaque existing
files remain byte-for-byte unchanged.

## Apply transaction

After a conflict-free preflight, the helper renders a manifest with `created`,
`verified-compatible`, or `opaque-preserved` classifications and records
`syntactically-verified` assurance for checked-in strategies or `declarative-unverified` assurance
for opaque fallback entries. Source placeholders, the canonical plan (document mode), and both
sidecars are staged in an OS-temporary directory, then copied with exclusive-create semantics. Only preflight-approved missing targets are
created; existing source content is never replaced.

Every successful create is recorded immediately. A race, I/O error, sidecar failure, or injected
test failure triggers recovery before the error is returned. Temporary staging is removed in all
cases.

## Rollback

Recovery unlinks every file created by the transaction in reverse order and then removes only the
empty parent directories that transaction created. It never restores by regeneration and never
touches a pre-existing path, so pre-existing bytes and unrelated dirty-worktree content are
preserved. The successful result exposes the same idempotent asynchronous `rollback()` operation
for callers that need to reverse the completed apply.

## Re-entry and idempotence

If all planned files already have their compatible or opaque disposition and the adjacent sidecars
describe the same plan, paths, assurances, and graph, the prior sidecar bytes are reused. No file is
rewritten, `createdPaths` is empty, and the first materialization remains byte-for-byte stable.
Different source bytes, sidecar content, or (in document mode) canonical plan bytes are reported as
conflicts rather than overwritten; a hand-edited plan therefore blocks regeneration until the
request reproduces it or the user chooses to replace it.
