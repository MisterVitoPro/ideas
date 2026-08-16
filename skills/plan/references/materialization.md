# Transactional skeleton materialization

`scripts/materialize-bundle.mjs` materializes the already validated, normalized bundle produced by
the plan procedure. It is an offline transaction: it imports only Node built-ins, does not invoke a
project generator, and never consults the network.

## Validated input contract

Call `materializeBundle(bundlePath, options)` with a local JSON request containing `schemaVersion:
1`, the canonical `plan` identity, an absolute `repositoryRoot`, repository-relative
`manifestPath` and `graphPath` values, `entries`, and the version-1 `graph`. Every entry supplies a
normalized `path`, a checked-in `strategyId` or `null`, its already strategy-validated `content`,
and its declared `connections`. The helper rejects unknown strategies, strategy/extension
mismatches, non-string content, non-empty opaque placeholders, duplicate targets, and file/directory
target overlaps before mutation.

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
for opaque fallback entries. Source placeholders and both sidecars are staged in an OS-temporary
directory, then copied with exclusive-create semantics. Only preflight-approved missing targets are
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
Different source bytes or sidecar content are reported as conflicts rather than overwritten.
