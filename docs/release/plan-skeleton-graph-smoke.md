# Plan skeleton and graph smoke protocol

Use this protocol as the manual release gate for the plan-native skeleton bundle. It verifies the
same shared `ideas:plan` procedure in Claude Code and Codex; it does not require a GitHub write,
network access, or a project-specific generator. Record the release tag, client/version, operating
system, scenario result, and any unexpected file delta in the sign-off table at the end.

## Host-neutral setup

1. Check out the release candidate locally and set `<ideas-plugin-root>` to that checkout. Install
   that same checkout in both clients. Confirm that both manifests report the same plugin name and
   version before continuing.
2. Use Node.js from `PATH`. Run `node --test tests/bundle-contract.test.js` from
   `<ideas-plugin-root>` before the manual scenarios; any failure blocks the release.
3. For every client run, create a fresh disposable Git repository outside the plugin checkout and
   copy in the stated fixture. Do not reuse a repository between scenarios or clients. Capture a
   recursive path listing, file hashes, and `git status --short` immediately before and after each
   action. Treat the repository root as `<scratch>` below.
4. Disable networking for the scratch process (or disconnect the test machine). The procedure may
   use only checked-in strategy data, Node built-ins, and local files. A prompt to install a
   generator, a network attempt, or a result that differs online versus offline is a failure.
5. On Windows use PowerShell and native Windows paths; on macOS and Linux use the default POSIX
   shell and native paths. Do not translate repository-relative artifact identities: sidecars and
   graph/manifest `plan` values always use `/` separators. Run the full protocol at least once on
   each OS, with at least one complete Claude Code run and one complete Codex run per OS. Distribute
   the remaining client/OS pairings so both clients are represented on Windows, macOS, and Linux.

For every new-plan fixture, seed an approved spec at
`docs/specs/2026-08-14-bundle-smoke.md`. It must contain an `## Acceptance criteria (EARS)` section
and explicitly name the planned paths used by that scenario. The expected coordinated bundle is:

- canonical plan: `docs/plans/2026-08-14-bundle-smoke.plan.md`;
- skeleton manifest: `docs/plans/2026-08-14-bundle-smoke.skeleton.json`;
- typed graph: `docs/plans/2026-08-14-bundle-smoke.graph.json`; and
- every source path named by the scenario.

Both sidecars must have `schemaVersion: 1` and the same non-empty `plan` identity as the canonical
plan. `created` and `verified-compatible` checked-in-strategy entries have
`syntactically-verified` assurance. `opaque-preserved` entries, and created zero-byte opaque
fallbacks, have `declarative-unverified` assurance.

When a scenario calls the materializer directly, create a local JSON request shaped as documented
in `skills/plan/references/materialization.md`, point `repositoryRoot` at `<scratch>`, and invoke
the exported `materializeBundle` function from
`<ideas-plugin-root>/skills/plan/scripts/materialize-bundle.mjs` (or its CLI,
`node <that file> <request.json> [--preflight]`, whose `--preflight` flag equals
`{ preflightOnly: true }`). Keep this request under
`<scratch>/.smoke/`; it is test input, not part of the expected bundle. Use
`{ preflightOnly: true }` or `{ injectFailureAfterWrites: 1 }` exactly where stated.

## Offline fixture and verification-layer matrix

| Fixture | Local source | Unit | Integration | Cross-client | Manual |
|---|---|---|---|---|---|
| `supported` | `test-fixtures/skeleton-strategies.json` `supported` array | strategy and materialization tests | bundle contract suite | new-plan emission in both clients | Scenarios 1 and 3 |
| `mixed-language` | `mixed-typescript-and-opaque` | strategy classification tests | materialization apply/preflight | identical plan/sidecars in both clients | Scenario 2 |
| `unsupported` | `unsupported-missing-and-existing` | opaque-fallback tests | materialization and bundle contract suites | same lower-assurance result in both clients | Scenarios 2 and 5 |
| `legacy-plan` | a valid existing nine-field plan with no `Graph context:` or sidecars | downstream-context tests | bundle contract suite | resume and execute in both clients | Scenario 7 |

All four rows run offline. The automated unit/integration layer supplies exhaustive local fixture
coverage; the cross-client and manual layers check that the host surface does not change the shared
contract.

## Scenario: new-plan bundle creation

**Setup:** Create two byte-identical fresh scratch repositories from a `supported` fixture. The
approved spec names `src/feature.mjs` as an owned path, its explicit import connection, and a
verification command that uses only local Node.js. Leave the plan, source path, and sidecars absent.

**Action:** In each client, invoke the plan skill against the approved spec, accept the proposed
plan, wait for emission, and choose `Stop here` at the completion gate.

- Claude Code: run `/ideas:plan docs/specs/2026-08-14-bundle-smoke.md`.
- Codex: run `$ideas:plan docs/specs/2026-08-14-bundle-smoke.md`.

**Expected artifact paths and classifications:** The canonical plan and both adjacent sidecars
exist at the shared paths above. `src/feature.mjs` exists with the checked-in safe content and its
manifest entry is `created` / `syntactically-verified`. The task section contains one compact
`Graph context:` object whose `task`, `owned`, `consumed`, `produced`, `nodes`, and `edges` IDs all
resolve within that object.

**Observable pass/fail:** PASS only if all four bundle components appear before the completion
gate, both client runs produce semantically identical plan/manifest/graph content (ignoring only
documented host report text), and no process attempts network or generator access. FAIL on a
missing/partial bundle, a sidecar version or plan-identity mismatch, a host-specific procedure
branch, or any extra scratch-repository mutation.

## Scenario: created and opaque-preserved paths

**Setup:** Create byte-identical scratch repositories from the `mixed-language` fixture and add
the `unsupported` fixture paths. Pre-create `native/feature.rs` and `cmd/feature.go` with the exact
fixture bytes; leave `src/index.ts` and `scripts/feature.rb` absent. Record hashes of both existing
opaque files. The approved spec explicitly owns all four paths and their declared connections.

**Action:** Run planning in each client, inspect the emitted source bytes and every manifest entry,
then compare pre/post hashes for the pre-existing opaque paths.

- Claude Code: run `/ideas:plan docs/specs/2026-08-14-bundle-smoke.md`, then choose `Stop here`.
- Codex: run `$ideas:plan docs/specs/2026-08-14-bundle-smoke.md`, then choose `Stop here`.

**Expected artifact paths and classifications:** `src/index.ts` is `created` /
`syntactically-verified`; absent `scripts/feature.rb` is a zero-byte `created` /
`declarative-unverified` placeholder. `native/feature.rs` and `cmd/feature.go` are
`opaque-preserved` / `declarative-unverified`, remain byte-for-byte unchanged, and appear alongside
the plan, `.skeleton.json`, and `.graph.json` paths listed in shared setup.

**Observable pass/fail:** PASS only if both clients report the same per-path classifications and
assurances, the created safe files have the expected bytes, both opaque-file hashes are unchanged,
and the run stays offline. FAIL if an opaque file is parsed, edited, upgraded to syntactic
assurance, or replaced; if a missing unsupported path is non-empty; or if any bundle component is
absent.

## Scenario: full-graph validation

**Setup:** Use fresh copies of the successful `supported` new-plan fixture from Scenario 1. Make
the spec declare at least two tasks, one `depends-on` edge, one owned file per task, and one
assured `imports`, `exports`, `produces`, or `consumes` edge. Keep both sidecars absent initially.

**Action:** Generate the bundle in each client. Inspect the full graph and manifest against
`skills/plan/references/graph-schema.json` and `skeleton-schema.json`, then check the identity rules
in `graph-projection.md`: unique node/edge IDs, resolvable endpoints, one manifest entry per planned
path, an `owns` edge for every task-owned file, required assurance, shared plan identity, and a
self-contained deterministic `Graph context:` slice per task.

- Claude Code: run `/ideas:plan docs/specs/2026-08-14-bundle-smoke.md` and stop after inspection.
- Codex: run `$ideas:plan docs/specs/2026-08-14-bundle-smoke.md` and stop after inspection.

**Expected artifact paths and classifications:** The plan, `.skeleton.json`, and `.graph.json`
exist at the shared paths. All supported owned files are `created` or `verified-compatible` with
`syntactically-verified` assurance. Both sidecars are version 1, share the plan identity, and the
graph contains exactly the planned nodes and typed edges referenced by the plan slices.

**Observable pass/fail:** PASS only if every schema and identity check succeeds locally and the two
clients emit the same sorted graph and task slices. FAIL if an endpoint is unresolved, a planned
file is missing its owning edge or manifest entry, an assured edge lacks assurance, IDs duplicate,
sidecar identities diverge, or validation permits any artifact to be written only partially.

## Scenario: conflict refusal with no mutation

**Setup:** In fresh copies of the `supported` fixture, pre-create `src/feature.mjs` with bytes that
differ from the planned checked-in-strategy content. Also seed an unrelated dirty file and record
the complete file list and hashes. Leave both sidecars absent. Prepare the same local request for a
new supported path so direct preflight can expose all classifications.

**Action:** Invoke the plan skill in each client. If the client reports the conflict before
emission, retain that report. Also call `materializeBundle(request, { preflightOnly: true })`, then
call normal apply and capture its `conflicts` array; do not repair or delete the conflicting file.

- Claude Code: run `/ideas:plan docs/specs/2026-08-14-bundle-smoke.md` with the conflicting path.
- Codex: run `$ideas:plan docs/specs/2026-08-14-bundle-smoke.md` with the conflicting path.

**Expected artifact paths and classifications:** Preflight classifies `src/feature.mjs` as
`conflicting` and any absent planned path as `missing`, but creates neither it nor
`docs/plans/2026-08-14-bundle-smoke.skeleton.json` nor
`docs/plans/2026-08-14-bundle-smoke.graph.json`. Normal apply names every conflict and leaves the
canonical plan/bundle incomplete rather than presenting it as successful.

**Observable pass/fail:** PASS only if both hosts refuse completion, the conflict report names the
same repository-relative path, preflight and failed apply leave the before/after file list and
hashes identical, the dirty file survives, and no completion gate appears. FAIL on overwrite,
partial source/sidecar creation, an incomplete conflict list, or any mutation.

## Scenario: injected rollback

**Setup:** Create fresh `unsupported` scratch copies. Pre-create `cmd/feature.go` and an unrelated
dirty file, record both hashes, and prepare a local materialization request with at least two absent
paths before the sidecars. First invoke the client only far enough to establish that the approved
spec and expected bundle paths are the same as in the other scenarios; use a fresh clone for the
fault injection so no output already exists.

**Action:** In each client context, call the local materializer with
`{ injectFailureAfterWrites: 1 }`. Capture the thrown error and inspect the repository after
recovery.

- Claude Code: begin with `/ideas:plan docs/specs/2026-08-14-bundle-smoke.md`; run the faulted local
  apply in its fresh scenario clone.
- Codex: begin with `$ideas:plan docs/specs/2026-08-14-bundle-smoke.md`; run the same faulted local
  apply in its fresh scenario clone.

**Expected artifact paths and classifications:** Preflight identifies the absent entries as
`missing` and `cmd/feature.go` as `opaque-preserved` / `declarative-unverified`. After the injected
failure, every path created by the transaction and both sidecars are absent. Pre-existing
`cmd/feature.go`, the dirty file, their parent directories, and their bytes are preserved.

**Observable pass/fail:** PASS only if both client contexts observe an injected-apply error, zero
transaction-created files remain, no empty transaction-created directory remains, both pre-existing
hashes match, and no completion gate is shown for the failed bundle. FAIL if recovery leaves any
source or sidecar behind, removes pre-existing data, or reports emission complete.

## Scenario: completion-gate routing

**Setup:** Use fresh successful `supported` repositories. Ensure plan-runner is visible in the
client's available-skill list. For a second pass, use a fresh clone without relying on a GitHub
remote. Record the path list just before the coordinated bundle finishes.

**Action:** Complete planning once and select `Execute with plan-runner`; verify that no execution
starts in the same context. Repeat from a fresh clone, select `Stop here` (and separately submit an
empty answer if the client permits it), and verify that execution and tickets do not start.

- Claude Code: run `/ideas:plan docs/specs/2026-08-14-bundle-smoke.md`; the handoff must print
  `/plan-runner:run docs/plans/2026-08-14-bundle-smoke.plan.md` after instructing `/clear`.
- Codex: run `$ideas:plan docs/specs/2026-08-14-bundle-smoke.md`; the handoff must print
  `$plan-runner:run docs/plans/2026-08-14-bundle-smoke.plan.md` after instructing `/clear`.

**Expected artifact paths and classifications:** The complete plan, skeleton paths, manifest, and
graph already exist before the single gate appears; supported paths retain their `created` or
`verified-compatible` / `syntactically-verified` classifications. Selecting a route creates no
additional source path and does not dereference either sidecar.

**Observable pass/fail:** PASS only if each client presents exactly one gate after complete
emission, plan-runner routing prints the client-correct command and ends the run without invoking
it, and `Stop here` or empty input performs no downstream action. FAIL if the gate precedes any
bundle component, appears after failed emission, starts plan-runner in the same context, exposes a
GitHub-only choice without its preconditions, or treats silence as consent.

## Scenario: downstream execution and legacy-plan compatibility

**Setup:** Prepare two fresh fixtures. The new-format fixture is a successful Scenario 1 bundle
whose one task writes a harmless local file and has a passing local verification command. The
`legacy-plan` fixture has an approved spec plus an existing valid nine-field
`docs/plans/2026-08-14-bundle-smoke.plan.md`; omit `Graph context:`, `.skeleton.json`, and
`.graph.json`. Give its one task a different harmless owned path and local verification command.

**Action:** For the new-format fixture, resume the existing plan and choose `Run inline`; observe
the task brief and execution report. Repeat with the legacy fixture, choose `Resume remaining
tasks`, then `Run inline`. Do not create or open sidecars during either downstream run.

- Claude Code: enter through `/ideas:plan docs/specs/2026-08-14-bundle-smoke.md` and select the
  stated resume/execution choices.
- Codex: enter through `$ideas:plan docs/specs/2026-08-14-bundle-smoke.md` and select the same
  choices.

**Expected artifact paths and classifications:** New-format execution consumes only the canonical
plan and copies `Graph context:` verbatim into the task brief; its existing sidecars and manifest
classifications remain unchanged. Legacy execution consumes only the nine-field plan, creates only
its declared owned path, and leaves both adjacent sidecar paths absent.

**Observable pass/fail:** PASS only if both clients complete the harmless task and its verification,
report the task by stable ID, never dereference a graph or manifest sidecar, preserve new-format
bundle bytes, and execute the legacy plan without migration. FAIL if downstream execution requires
a sidecar, backfills the legacy fixture, loses the new-format graph slice, changes classifications,
or behaves differently between clients.

## Operator sign-off

| OS | Client | Scenarios | Bundle contract test | Offline | Result | Notes/evidence |
|---|---|---|---|---|---|---|
| Windows | Claude Code | | | | | |
| Windows | Codex | | | | | |
| macOS | Claude Code | | | | | |
| macOS | Codex | | | | | |
| Linux | Claude Code | | | | | |
| Linux | Codex | | | | | |

Release-gate status: **not yet executed**. Mark it passing only when the automated bundle contract
test passes and every manual scenario has a recorded PASS for both invocation surfaces across the
OS distribution above.
