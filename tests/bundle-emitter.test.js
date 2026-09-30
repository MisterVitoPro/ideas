"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const MATERIALIZER = path.join(ROOT, "skills/plan/scripts/materialize-bundle.mjs");
const PLAN_PATH = "docs/plans/2026-09-29-emitter.plan.md";

async function loadMaterializer() {
  return import(pathToFileURL(MATERIALIZER).href);
}

function temporaryRepository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ideas-emitter-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, relativePath, content) {
  const target = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

function exists(root, relativePath) {
  return fs.existsSync(path.join(root, ...relativePath.split("/")));
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

function task(overrides = {}) {
  return {
    title: "Walking skeleton",
    taskId: "emitter-t01",
    ownedFiles: ["src/core.mjs", "src/util.ts"],
    interfaces: "produces core module",
    acceptanceCriteria: ["WHEN the module loads THE SYSTEM SHALL export nothing"],
    verification: "node --test",
    nonGoals: ["Does not implement the CLI"],
    blockedBy: [],
    constraints: "No code bodies.",
    ...overrides,
  };
}

function document(tasks) {
  return {
    title: "Emitter",
    goal: "Emit the bundle from one request.",
    sourceSpec: "docs/specs/2026-09-29-emitter.md",
    flaggedConstraints: [],
    tasks,
  };
}

function makeRequest(root, overrides = {}) {
  const request = {
    schemaVersion: 1,
    repositoryRoot: root,
    planPath: PLAN_PATH,
    document: document([
      task(),
      task({
        title: "Add the CLI",
        taskId: "emitter-t02",
        ownedFiles: ["bin/cli.py", "README.md"],
        interfaces: "consumes core module",
        blockedBy: ["emitter-t01"],
      }),
    ]),
    graph: {
      nodes: [{ id: "public-contract:core-api", type: "public-contract", contract: "core-api" }],
      edges: [
        { type: "exports", source: "file:src/core.mjs", target: "public-contract:core-api", assurance: "syntactically-verified" },
        { type: "produces", source: "task:emitter-t01", target: "public-contract:core-api", assurance: "syntactically-verified" },
        { type: "consumes", source: "task:emitter-t02", target: "public-contract:core-api" },
        { type: "imports", source: "file:bin/cli.py", target: "file:src/core.mjs" },
      ],
    },
    ...overrides,
  };
  return write(root, ".emitter-request.json", `${JSON.stringify(request, null, 2)}\n`);
}

function taskSection(plan, number) {
  const start = plan.indexOf(`### Task ${number}:`);
  assert.notEqual(start, -1, `plan has Task ${number}`);
  const rest = plan.slice(start);
  const next = rest.indexOf("\n### Task ", 1);
  return next === -1 ? rest : rest.slice(0, next);
}

test("document mode renders the canonical plan, sidecars, and skeleton from one request", async (t) => {
  const root = temporaryRepository(t);
  write(root, "README.md", "# existing\n");
  const requestPath = makeRequest(root);
  const { materializeBundle } = await loadMaterializer();

  const result = await materializeBundle(requestPath);
  assert.equal(result.planPath, PLAN_PATH);
  assert.deepEqual([...result.createdPaths].sort(), [
    "bin/cli.py",
    "docs/plans/2026-09-29-emitter.graph.json",
    PLAN_PATH,
    "docs/plans/2026-09-29-emitter.skeleton.json",
    "src/core.mjs",
    "src/util.ts",
  ].sort());

  assert.equal(read(root, "src/core.mjs"), "export {};\n", "strategy placeholder is defaulted");
  assert.equal(read(root, "src/util.ts"), "export {};\n");
  assert.equal(read(root, "bin/cli.py"), "__all__ = []\n");
  assert.equal(read(root, "README.md"), "# existing\n", "existing owned file is preserved");

  const manifest = JSON.parse(read(root, "docs/plans/2026-09-29-emitter.skeleton.json"));
  assert.equal(manifest.plan, PLAN_PATH);
  const byPath = new Map(manifest.entries.map((entry) => [entry.path, entry]));
  assert.deepEqual(byPath.get("README.md"), { path: "README.md", classification: "opaque-preserved", assurance: "declarative-unverified" });
  assert.deepEqual(byPath.get("src/core.mjs"), { path: "src/core.mjs", classification: "created", assurance: "syntactically-verified" });
  assert.deepEqual(byPath.get("bin/cli.py"), { path: "bin/cli.py", classification: "created", assurance: "syntactically-verified" });

  const graph = JSON.parse(read(root, "docs/plans/2026-09-29-emitter.graph.json"));
  assert.equal(graph.schemaVersion, 1);
  assert.equal(graph.plan, PLAN_PATH);
  const nodeIds = graph.nodes.map((node) => node.id);
  for (const id of ["task:emitter-t01", "task:emitter-t02", "file:src/core.mjs", "file:README.md", "public-contract:core-api"]) {
    assert.ok(nodeIds.includes(id), `graph derives node ${id}`);
  }
  const edgeIds = graph.edges.map((edge) => edge.id);
  assert.ok(edgeIds.includes("edge:owns:task:emitter-t01->file:src/core.mjs"), "owns edges derive from ownedFiles");
  assert.ok(edgeIds.includes("edge:depends-on:task:emitter-t02->task:emitter-t01"), "depends-on edges derive from blockedBy");
  const consumes = graph.edges.find((edge) => edge.id === "edge:consumes:task:emitter-t02->public-contract:core-api");
  assert.equal(consumes.assurance, "declarative-unverified", "omitted assurance defaults to the honest lower level");
  const key = (node) => `${node.type}\u0000${node.id}`;
  const sortedNodes = [...graph.nodes].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  assert.deepEqual(graph.nodes.map((node) => node.id), sortedNodes.map((node) => node.id), "nodes are sorted by type then id");

  const plan = read(root, PLAN_PATH);
  assert.match(plan, /^# Emitter - implementation plan\nGoal: Emit the bundle from one request\.\nSource spec: docs\/specs\/2026-09-29-emitter\.md\nFlagged constraints \(unconfirmed\): None\nSkeleton manifest: docs\/plans\/2026-09-29-emitter\.skeleton\.json\nDependency graph: docs\/plans\/2026-09-29-emitter\.graph\.json\n/u);
  const first = taskSection(plan, 1);
  const order = ["Task ID:", "Owned files:", "Interfaces:", "Graph context:", "Acceptance criteria:", "Verification:", "Non-goals:", "Blocked by:", "Constraints:"];
  let previous = -1;
  for (const field of order) {
    const current = first.indexOf(`\n${field}`);
    assert.ok(current > previous, `${field} follows the canonical field order`);
    previous = current;
  }
  assert.match(first, /\nBlocked by: none\n/u);
  assert.match(first, /\n- WHEN the module loads THE SYSTEM SHALL export nothing\n/u);
  assert.match(first, /\nNon-goals:\n- Does not implement the CLI\n/u);
  assert.match(taskSection(plan, 2), /\nBlocked by: emitter-t01\n/u);
  assert.match(taskSection(plan, 2), /\nOwned files: bin\/cli\.py, README\.md\n/u);
});

test("Graph context slices are self-contained, deterministic, and follow the projection contract", async (t) => {
  const root = temporaryRepository(t);
  const requestPath = makeRequest(root);
  const { materializeBundle } = await loadMaterializer();
  await materializeBundle(requestPath);
  const plan = read(root, PLAN_PATH);

  const sliceOf = (number) => {
    const line = taskSection(plan, number).split("\n").find((candidate) => candidate.startsWith("Graph context: "));
    assert.ok(line, `Task ${number} has a Graph context line`);
    const slice = JSON.parse(line.slice("Graph context: ".length));
    assert.deepEqual(Object.keys(slice), ["task", "owned", "consumed", "produced", "nodes", "edges"]);
    const ids = new Set(slice.nodes.map((node) => node.id));
    for (const edge of slice.edges) {
      assert.ok(ids.has(edge.source) && ids.has(edge.target), `${edge.id} endpoints resolve inside the slice`);
    }
    return slice;
  };

  const first = sliceOf(1);
  assert.equal(first.task, "emitter-t01");
  assert.deepEqual(first.owned, ["file:src/core.mjs", "file:src/util.ts"]);
  assert.deepEqual(first.produced, ["public-contract:core-api"]);
  assert.deepEqual(first.consumed, []);
  const firstEdgeIds = first.edges.map((edge) => edge.id);
  assert.ok(firstEdgeIds.includes("edge:exports:file:src/core.mjs->public-contract:core-api"), "exports incident to an owned node is included");
  assert.ok(firstEdgeIds.includes("edge:imports:file:bin/cli.py->file:src/core.mjs"), "imports incident to an owned node is included");
  assert.ok(!firstEdgeIds.some((id) => id.startsWith("edge:owns:task:emitter-t02")), "other tasks' owns edges are excluded");

  const second = sliceOf(2);
  assert.deepEqual(second.consumed, ["public-contract:core-api"]);
  assert.ok(second.edges.some((edge) => edge.id === "edge:depends-on:task:emitter-t02->task:emitter-t01"));
  assert.ok(second.nodes.some((node) => node.id === "task:emitter-t01"), "endpoint closure adds the blocker node");

  const before = read(root, PLAN_PATH);
  const again = await materializeBundle(requestPath);
  assert.deepEqual(again.createdPaths, [], "re-running the same request is idempotent");
  assert.equal(read(root, PLAN_PATH), before);
});

test("document mode refuses plan-format violations by naming the offending task", async (t) => {
  const root = temporaryRepository(t);
  const { materializeBundle } = await loadMaterializer();
  const cases = [
    [
      /emitter-t02 acceptance criterion 1 is reference-only/u,
      { document: document([task(), task({ taskId: "emitter-t02", ownedFiles: ["b.txt"], blockedBy: ["emitter-t01"], acceptanceCriteria: ["Criterion 3"] })]) },
    ],
    [
      /both own src\/core\.mjs/u,
      { document: document([task(), task({ taskId: "emitter-t02", blockedBy: ["emitter-t01"] })]) },
    ],
    [
      /blocked by unknown task ID emitter-t09/u,
      { document: document([task(), task({ taskId: "emitter-t02", ownedFiles: ["b.txt"], blockedBy: ["emitter-t09"] })]) },
    ],
    [
      /emitter-t02 needs at least one blocked-by edge/u,
      { document: document([task(), task({ taskId: "emitter-t02", ownedFiles: ["b.txt"], blockedBy: [] })]) },
    ],
    [
      /form a cycle/u,
      { document: document([task({ blockedBy: ["emitter-t02"] }), task({ taskId: "emitter-t02", ownedFiles: ["b.txt"], blockedBy: ["emitter-t01"] })]) },
    ],
    [
      /does not follow the emitter-t<NN> scheme/u,
      { document: document([task({ taskId: "other-t01" })]) },
    ],
    [
      /unfilled placeholder token/u,
      { document: document([task({ constraints: "<...>" })]) },
    ],
    [
      /unowned planned file file:src\/orphan\.mjs/u,
      { document: document([task()]), entries: [{ path: "src/orphan.mjs", strategyId: "javascript-esm-mjs" }] },
    ],
    [
      /references missing target node public-contract:ghost/u,
      { document: document([task()]), graph: { edges: [{ type: "produces", source: "task:emitter-t01", target: "public-contract:ghost" }] } },
    ],
    [
      /invalid assurance maybe/u,
      { document: document([task()]), graph: { nodes: [{ id: "public-contract:x", type: "public-contract" }], edges: [{ type: "produces", source: "task:emitter-t01", target: "public-contract:x", assurance: "maybe" }] } },
    ],
    [
      /planPath must be named YYYY-MM-DD-<slug>\.plan\.md/u,
      { planPath: "docs/plans/emitter.md" },
    ],
  ];
  for (const [pattern, overrides] of cases) {
    const requestPath = makeRequest(root, { graph: { nodes: [], edges: [] }, ...overrides });
    await assert.rejects(() => materializeBundle(requestPath, { preflightOnly: true }), pattern);
  }
  assert.equal(exists(root, PLAN_PATH), false, "no refusal writes the plan");
});

test("an existing plan with different bytes is a conflict, never overwritten", async (t) => {
  const root = temporaryRepository(t);
  write(root, PLAN_PATH, "# hand-edited plan\n");
  const requestPath = makeRequest(root);
  const { materializeBundle } = await loadMaterializer();
  let failure;
  await assert.rejects(() => materializeBundle(requestPath), (error) => {
    failure = error;
    return true;
  });
  assert.deepEqual(failure.conflicts, [PLAN_PATH]);
  assert.equal(read(root, PLAN_PATH), "# hand-edited plan\n");
  assert.equal(exists(root, "src/core.mjs"), false, "conflict leaves the skeleton unwritten");
});

test("CLI prints one JSON report and uses the exit code for refusals and conflicts", async (t) => {
  const root = temporaryRepository(t);
  const requestPath = makeRequest(root);
  const run = (...args) => spawnSync(process.execPath, [MATERIALIZER, ...args], { encoding: "utf8" });

  const preflight = run(requestPath, "--preflight");
  assert.equal(preflight.status, 0, preflight.stderr);
  const preflightReport = JSON.parse(preflight.stdout);
  assert.equal(preflightReport.ok, true);
  assert.equal(preflightReport.mode, "preflight");
  assert.equal(exists(root, PLAN_PATH), false, "preflight writes nothing");

  const apply = run(requestPath);
  assert.equal(apply.status, 0, apply.stderr);
  const applyReport = JSON.parse(apply.stdout);
  assert.equal(applyReport.ok, true);
  assert.equal(applyReport.planPath, PLAN_PATH);
  assert.ok(applyReport.createdPaths.includes(PLAN_PATH));
  assert.equal("graph" in applyReport, false, "CLI report omits the full graph");
  assert.equal(exists(root, PLAN_PATH), true);

  write(root, PLAN_PATH, "# hand-edited plan\n");
  const conflict = run(requestPath);
  assert.equal(conflict.status, 1);
  const conflictReport = JSON.parse(conflict.stdout);
  assert.equal(conflictReport.ok, false);
  assert.deepEqual(conflictReport.conflicts, [PLAN_PATH]);
  assert.match(conflictReport.error, /conflict/iu);
  assert.equal(read(root, PLAN_PATH), "# hand-edited plan\n");

  const invalid = run(makeRequest(root, { planPath: "docs/plans/bad.md" }));
  assert.equal(invalid.status, 1);
  assert.match(JSON.parse(invalid.stdout).error, /planPath must be named/u);

  const missing = run();
  assert.equal(missing.status, 1);
  assert.match(JSON.parse(missing.stdout).error, /usage/u);
});
