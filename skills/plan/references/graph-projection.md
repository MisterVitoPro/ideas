# Graph validation and projection contract

This contract defines the version 1 offline validation and deterministic projection rules for a
plan bundle. The JSON schemas are self-contained draft-2020-12 documents and require no network
resolution. Structural schema validation is followed by the identity-based checks below because
JSON Schema cannot compare identifiers across arrays.

## Shared normalized model and stable identities

The normalized model is the sole identity source. Emitters MUST NOT reconstruct identity by
reading a previously written artifact.

- Normalize repository paths by converting separators to `/`, removing a leading `./`, resolving
  `.` segments, and rejecting absolute paths or `..` segments. Preserve the remaining spelling and
  case.
- The plan identity is its normalized repository-relative canonical plan path.
- The manifest identity is its `plan` value; it MUST equal the plan identity.
- The graph identity is its `plan` value; it MUST equal the plan identity.
- Each skeleton identity is the normalized `path` of its manifest entry, paired with that plan
  identity.
- Each slice identity is the stable task ID of the task whose `Graph context:` is being rendered,
  paired with that plan identity.
- Preserve stable task IDs exactly across the plan, graph, manifest relationship, skeleton, and
  slices. Re-entry may carry a matched task ID forward but MUST NOT renumber it because ordering
  changed.

Construct node IDs deterministically from type and canonical identity: `task:<stable-task-id>`,
`file:<normalized-path>`, `module:<normalized-module-name>`, and
`public-contract:<normalized-contract-name>`. Construct each edge ID from its type and endpoints as
`edge:<type>:<source-id>-><target-id>`. The normalized model MUST contain at most one edge of a
given type between the same endpoints.

## Full graph and manifest validation

Validate the complete graph and manifest against their version 1 schemas, then apply these checks
to the normalized model before any artifact is emitted:

1. Build a node table keyed by node ID. Reject a duplicate node ID and name the offending ID.
2. For every edge, resolve both endpoint IDs in that table. Reject a missing source or target node
   and name the offending edge ID and missing node ID.
3. Require `syntactically-verified` or `declarative-unverified` assurance on every `imports`,
   `exports`, `produces`, and `consumes` edge. Reject invalid assurance and name the offending edge
   ID.
4. Compare the manifest entries with the complete planned-path set in the normalized model. There
   MUST be exactly one entry for every planned path and no entry for an unplanned path.
5. Every planned file referenced by a task MUST be the target of an `owns` edge from that task.
   Reject an unowned planned file or path and name the offending stable task ID and file node ID.
6. Require the graph and manifest `plan` values to equal the shared plan identity, and require each
   task node's `taskId`, when present, to equal the stable task ID encoded by its node ID.

Any failure rejects the whole bundle before writing. A validation error MUST name the offending
identity or ID; reporting only an array index is insufficient.

## Deterministic per-task projection

For each task, project its slice from the already validated normalized model:

1. Start with the task node.
2. Select its outgoing `owns`, `consumes`, and `produces` edges. Their targets are respectively the
   task's owned nodes, consumed nodes, and produced nodes.
3. Select outgoing `depends-on` edges from the task, plus `imports` and `exports` edges incident to
   any selected owned, consumed, or produced node.
4. Add both endpoint nodes of every selected edge. This endpoint closure makes the slice
   self-contained: a consumer never needs the graph sidecar to resolve an ID.
5. Sort nodes first by `type` and then by `id`, both in ascending Unicode code-point order. Sort
   edges by `type`, `source`, `target`, and `id` in the same order. Sort each owned, consumed, and
   produced node-ID list ascending and remove duplicates.

Render exactly one compact JSON object after `Graph context:`. It has `task`, `owned`, `consumed`,
`produced`, `nodes`, and `edges` keys in that order. Nodes contain `id` and `type`; edges contain
`id`, `type`, `source`, and `target`, plus `assurance` when present. Use JSON string escaping and no
insignificant whitespace. The owned nodes, consumed nodes, produced nodes, and relevant dependency
edges are therefore explicit, stable, deterministic, and suitable as an offline compact task
contract.

Example shape (illustrative identities only):

```text
Graph context: {"task":"plan-example-t01","owned":["file:src/example.js"],"consumed":[],"produced":["public-contract:example-api"],"nodes":[...],"edges":[...]}
```
