"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const MATERIALIZER = path.join(ROOT, "skills/plan/scripts/materialize-bundle.mjs");

async function loadMaterializer() {
  return import(pathToFileURL(MATERIALIZER).href);
}

function temporaryRepository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ideas-materialization-"));
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
  return fs.readFileSync(path.join(root, ...relativePath.split("/")));
}

function entry(relativePath, strategyId, content = "") {
  return {
    path: relativePath,
    strategyId,
    content,
    connections: [],
  };
}

function makeBundle(root, entries, overrides = {}) {
  const request = {
    schemaVersion: 1,
    plan: "plan:test-materialization",
    repositoryRoot: root,
    manifestPath: "docs/plans/test-materialization.skeleton.json",
    graphPath: "docs/plans/test-materialization.graph.json",
    entries,
    graph: {
      schemaVersion: 1,
      plan: "plan:test-materialization",
      nodes: entries.map((candidate, index) => ({
        id: `file:${index}`,
        type: "file",
        path: candidate.path,
      })),
      edges: [],
    },
    ...overrides,
  };
  const requestPath = write(root, ".ideas-test.bundle.json", `${JSON.stringify(request, null, 2)}\n`);
  return { request, requestPath };
}

function byPath(entries) {
  return new Map(entries.map((candidate) => [candidate.path, candidate]));
}

test("preflight classifies every path before making any source or sidecar mutation", async (t) => {
  const root = temporaryRepository(t);
  const compatible = "'use strict';\n\nmodule.exports = {};\n";
  const opaque = Buffer.from([0, 255, 13, 10, 65]);
  write(root, "lib/compatible.cjs", compatible);
  write(root, "native/opaque.rs", opaque);
  write(root, "src/conflict.mjs", "console.log('not the planned module');\n");
  const { requestPath } = makeBundle(root, [
    entry("src/missing.mjs", "javascript-esm-mjs", "export {};\n"),
    entry("lib/compatible.cjs", "javascript-commonjs-cjs", compatible),
    entry("native/opaque.rs", null, ""),
    entry("src/conflict.mjs", "javascript-esm-mjs", "export {};\n"),
  ]);
  const beforeConflict = read(root, "src/conflict.mjs");
  const { materializeBundle } = await loadMaterializer();

  const report = await materializeBundle(requestPath, { preflightOnly: true });
  const classifications = byPath(report.entries);
  assert.equal(classifications.get("src/missing.mjs").classification, "missing");
  assert.equal(classifications.get("lib/compatible.cjs").classification, "verified-compatible");
  assert.equal(classifications.get("native/opaque.rs").classification, "opaque-preserved");
  assert.equal(classifications.get("src/conflict.mjs").classification, "conflicting");
  assert.equal(exists(root, "src/missing.mjs"), false);
  assert.equal(exists(root, "docs/plans/test-materialization.skeleton.json"), false);
  assert.equal(exists(root, "docs/plans/test-materialization.graph.json"), false);
  assert.deepEqual(read(root, "src/conflict.mjs"), beforeConflict);
  assert.deepEqual(read(root, "native/opaque.rs"), opaque);
});

test("apply reports all conflicts together and leaves the repository unmodified", async (t) => {
  const root = temporaryRepository(t);
  const conflicts = {
    "src/first.mjs": "export const unexpected = true;\n",
    "lib/second.cjs": "module.exports = { unexpected: true };\n",
  };
  for (const [relativePath, content] of Object.entries(conflicts)) write(root, relativePath, content);
  const { requestPath } = makeBundle(root, [
    entry("src/first.mjs", "javascript-esm-mjs", "export {};\n"),
    entry("lib/second.cjs", "javascript-commonjs-cjs", "'use strict';\n\nmodule.exports = {};\n"),
    entry("src/would-be-created.ts", "typescript-esm-ts", "export {};\n"),
  ]);
  const { materializeBundle } = await loadMaterializer();

  let failure;
  await assert.rejects(() => materializeBundle(requestPath), (error) => {
    failure = error;
    return /conflict/i.test(error.message);
  });
  assert.deepEqual([...failure.conflicts].sort(), Object.keys(conflicts).sort());
  for (const [relativePath, content] of Object.entries(conflicts)) {
    assert.equal(read(root, relativePath).toString(), content);
  }
  assert.equal(exists(root, "src/would-be-created.ts"), false);
  assert.equal(exists(root, "docs/plans/test-materialization.skeleton.json"), false);
  assert.equal(exists(root, "docs/plans/test-materialization.graph.json"), false);
});

test("apply creates approved missing artifacts while preserving compatible and opaque bytes", async (t) => {
  const root = temporaryRepository(t);
  const compatible = Buffer.from("'use strict';\n\nmodule.exports = {};\n");
  const opaque = Buffer.from([239, 187, 191, 112, 117, 98, 32, 120, 59, 13, 10]);
  write(root, "lib/compatible.cjs", compatible);
  write(root, "native/opaque.rs", opaque);
  const { requestPath } = makeBundle(root, [
    entry("src/new.mjs", "javascript-esm-mjs", "export {};\n"),
    entry("lib/compatible.cjs", "javascript-commonjs-cjs", compatible.toString()),
    entry("native/opaque.rs", null, ""),
  ]);
  const { materializeBundle } = await loadMaterializer();

  const result = await materializeBundle(requestPath);
  assert.equal(read(root, "src/new.mjs").toString(), "export {};\n");
  assert.deepEqual(read(root, "lib/compatible.cjs"), compatible);
  assert.deepEqual(read(root, "native/opaque.rs"), opaque);
  const manifest = JSON.parse(read(root, "docs/plans/test-materialization.skeleton.json"));
  const recorded = byPath(manifest.entries);
  assert.equal(recorded.get("src/new.mjs").classification, "created");
  assert.equal(recorded.get("src/new.mjs").assurance, "syntactically-verified");
  assert.equal(recorded.get("lib/compatible.cjs").classification, "verified-compatible");
  assert.equal(recorded.get("lib/compatible.cjs").assurance, "syntactically-verified");
  assert.equal(recorded.get("native/opaque.rs").classification, "opaque-preserved");
  assert.equal(recorded.get("native/opaque.rs").assurance, "declarative-unverified");
  assert.deepEqual(JSON.parse(read(root, "docs/plans/test-materialization.graph.json")), result.graph);
});

test("rollback removes every artifact created by a successful apply and preserves dirty files", async (t) => {
  const root = temporaryRepository(t);
  const dirty = Buffer.from("local changes must survive\r\n");
  write(root, "notes/dirty.txt", dirty);
  const { requestPath } = makeBundle(root, [
    entry("src/new.mjs", "javascript-esm-mjs", "export {};\n"),
    entry("data/new.unknown", null, ""),
  ]);
  const { materializeBundle } = await loadMaterializer();

  const result = await materializeBundle(requestPath);
  assert.equal(typeof result.rollback, "function");
  assert.equal(exists(root, "src/new.mjs"), true);
  await result.rollback();
  for (const relativePath of [
    "src/new.mjs",
    "data/new.unknown",
    "docs/plans/test-materialization.skeleton.json",
    "docs/plans/test-materialization.graph.json",
  ]) assert.equal(exists(root, relativePath), false, `${relativePath} is rolled back`);
  assert.deepEqual(read(root, "notes/dirty.txt"), dirty);
});

test("an injected mid-apply failure restores source paths and removes new sidecars", async (t) => {
  const root = temporaryRepository(t);
  const opaque = Buffer.from("pre-existing opaque bytes\0\r\n");
  write(root, "native/existing.rs", opaque);
  const { requestPath } = makeBundle(root, [
    entry("src/one.mjs", "javascript-esm-mjs", "export {};\n"),
    entry("src/two.ts", "typescript-esm-ts", "export {};\n"),
    entry("native/existing.rs", null, ""),
  ]);
  const { materializeBundle } = await loadMaterializer();
  const copiedFiles = [];
  const originalCopyFile = fsPromises.copyFile;
  fsPromises.copyFile = async (...args) => {
    const result = await originalCopyFile(...args);
    const target = path.resolve(args[1]);
    if (target.startsWith(`${root}${path.sep}`)) {
      copiedFiles.push({
        path: path.relative(root, target).split(path.sep).join("/"),
        bytes: await fsPromises.readFile(target),
      });
    }
    return result;
  };

  let failure;
  try {
    await assert.rejects(
      () => materializeBundle(requestPath, { injectFailureAfterWrites: 1 }),
      (error) => {
        failure = error;
        return true;
      },
    );
  } finally {
    fsPromises.copyFile = originalCopyFile;
  }
  assert.match(failure.cause?.message ?? "", /injected materialization apply failure after 1 writes/i);
  assert.deepEqual(copiedFiles, [{
    path: "src/one.mjs",
    bytes: Buffer.from("export {};\n"),
  }]);
  for (const relativePath of [
    "src/one.mjs",
    "src/two.ts",
    "docs/plans/test-materialization.skeleton.json",
    "docs/plans/test-materialization.graph.json",
  ]) assert.equal(exists(root, relativePath), false, `${relativePath} is absent after recovery`);
  assert.deepEqual(read(root, "native/existing.rs"), opaque);
});

test("idempotent re-entry performs no writes and preserves the first result byte-for-byte", async (t) => {
  const root = temporaryRepository(t);
  const { requestPath } = makeBundle(root, [
    entry("src/new.mjs", "javascript-esm-mjs", "export {};\n"),
    entry("assets/empty.bin", null, ""),
  ]);
  const { materializeBundle } = await loadMaterializer();
  const tracked = [
    "src/new.mjs",
    "assets/empty.bin",
    "docs/plans/test-materialization.skeleton.json",
    "docs/plans/test-materialization.graph.json",
  ];

  await materializeBundle(requestPath);
  const first = new Map(tracked.map((relativePath) => [relativePath, read(root, relativePath)]));
  const second = await materializeBundle(requestPath);
  assert.deepEqual(second.createdPaths, []);
  for (const relativePath of tracked) assert.deepEqual(read(root, relativePath), first.get(relativePath));
});

test("path validation is cross-platform and rejects POSIX, Windows, and traversal escapes", async (t) => {
  const root = temporaryRepository(t);
  const outsideName = `ideas-materialization-outside-${process.pid}.mjs`;
  const outside = path.join(path.dirname(root), outsideName);
  t.after(() => fs.rmSync(outside, { force: true }));
  const { materializeBundle } = await loadMaterializer();
  const invalidPaths = [
    `../${outsideName}`,
    `..\\${outsideName}`,
    "/tmp/absolute.mjs",
    "C:\\absolute\\outside.mjs",
    "\\\\server\\share\\outside.mjs",
  ];

  for (const invalidPath of invalidPaths) {
    const { requestPath } = makeBundle(root, [entry(invalidPath, "javascript-esm-mjs", "export {};\n")]);
    await assert.rejects(
      () => materializeBundle(requestPath, { preflightOnly: true }),
      /path|repository|outside|absolute|traversal/i,
      invalidPath,
    );
  }
  assert.equal(fs.existsSync(outside), false);
  assert.equal(exists(root, "docs/plans/test-materialization.skeleton.json"), false);
  assert.equal(exists(root, "docs/plans/test-materialization.graph.json"), false);
});

test("materialization remains offline and depends only on Node built-ins", async (t) => {
  const root = temporaryRepository(t);
  const { requestPath } = makeBundle(root, [
    entry("src/offline.mjs", "javascript-esm-mjs", "export {};\n"),
  ]);
  const source = fs.readFileSync(MATERIALIZER, "utf8");
  const imports = [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)]
    .map((match) => match[1]);
  assert.ok(imports.every((specifier) => specifier.startsWith("node:")),
    `all imports are Node built-ins: ${imports.join(", ")}`);
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("network access attempted"); };
  t.after(() => { global.fetch = originalFetch; });
  const { materializeBundle } = await loadMaterializer();

  await materializeBundle(requestPath);
  assert.equal(read(root, "src/offline.mjs").toString(), "export {};\n");
});
