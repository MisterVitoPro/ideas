# Plan artifact bundle

This reference defines the walking-skeleton contract for a plan-native bundle. The canonical plan
remains the downstream contract, but one normalized plan model is authoritative for every artifact
created during planning.

## Normalized plan model

Build the model in memory before writing anything. It contains:

- plan identity, title, goal, source spec, carried constraints, and stable task IDs;
- the flat ordered tasks with owned files, interfaces, full EARS criteria, verification, non-goals,
  blockers, constraints, and their projected graph slices;
- every planned path and its intended stub/placeholder contract, language strategy, disposition,
  and relationship to the plan;
- stable typed graph nodes for tasks, paths, exports/contracts, and external dependencies, plus
  directed typed edges; and
- sidecar schema version and adjacent output paths.

- The plan derives directly from the normalized model.
- The manifest derives directly from the normalized model.
- The graph derives directly from the normalized model.
- The skeleton derives directly from the normalized model.
- Every task slice derives directly from the normalized model.

Emitters must not parse, read back, or infer from a written artifact to produce another artifact.
Validate the complete model and all projected task slices before bundle emission.

## Bundle artifacts and emission boundary

One successful emission creates a coordinated bundle:

1. the **canonical plan** at `<root>/plans/YYYY-MM-DD-<slug>.plan.md`;
2. the **planned skeleton**, meaning the model-declared repository paths and safe stubs/placeholders;
3. the **skeleton manifest** beside the plan at `<plan-stem>.skeleton.json`; and
4. the **typed graph** beside the plan at `<plan-stem>.graph.json`.

Both JSON sidecars carry `schemaVersion: 1` and the canonical plan identity. The materialization
procedure may stage or roll back these outputs, but the plan procedure considers emission complete
only when the canonical plan, planned skeleton, skeleton manifest, and typed graph have all been
created successfully. Emit the complete bundle before presenting the completion gate.

## Plan header references

Render these lines in the canonical plan header using paths resolved adjacent to the plan:

```text
Skeleton manifest: <plan-stem>.skeleton.json
Dependency graph: <plan-stem>.graph.json
```

The references are model fields and are rendered from the normalized model; they are not discovered
after sidecars are written.

## Task graph slices

Before rendering a task, project a self-contained graph slice from the normalized model. Its
`Graph context:` field identifies the task's owned, consumed, and produced nodes and includes the
relevant dependency edges, including stable node identities, edge types, and endpoints. A task
consumer can therefore understand its local contract from the plan alone; it need not open the
complete graph sidecar. The task slice is rendered directly from the normalized model just as the
full graph is, rather than being inferred from either written artifact.

## Re-entry and legacy plans

Finding the canonical plan means an existing plan bundle is present, whether or not older sidecars
exist. Preserve the existing **Resume remaining tasks** / **Regenerate plan** gate: resume retains
the plan, sidecars, skeleton, and stable task IDs unchanged; regenerate rebuilds the normalized
model while carrying forward matched task IDs. The procedure must not silently regenerate an
existing plan bundle or backfill a legacy plan. Legacy plans without sidecars or `Graph context:`
remain valid inputs to downstream consumers.

## Completion gate boundary

Do not present execution, tickets, or stop choices until model validation and the coordinated
bundle emission have succeeded. A failed or partial emission does not reach the completion gate.
