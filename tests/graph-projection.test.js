"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const GRAPH_SCHEMA = "skills/plan/references/graph-schema.json";
const SKELETON_SCHEMA = "skills/plan/references/skeleton-schema.json";
const PROJECTION = "skills/plan/references/graph-projection.md";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

function json(relPath) {
  return JSON.parse(read(relPath));
}

function enumIncludes(schema, expected, label) {
  assert.ok(Array.isArray(schema.enum), `${label} is an enum`);
  for (const value of expected) {
    assert.ok(schema.enum.includes(value), `${label} includes ${value}`);
  }
}

test("graph contract: version 1 accepts the required typed nodes and edges", () => {
  const schema = json(GRAPH_SCHEMA);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.properties.nodes.items.$ref, "#/$defs/node");
  assert.equal(schema.properties.edges.items.$ref, "#/$defs/edge");

  const node = schema.$defs.node;
  const edge = schema.$defs.edge;
  for (const field of ["id", "type"]) {
    assert.ok(node.required.includes(field), `node requires ${field}`);
  }
  enumIncludes(node.properties.type, ["task", "file", "module", "public-contract"], "node type");
  for (const field of ["id", "type", "source", "target"]) {
    assert.ok(edge.required.includes(field), `edge requires ${field}`);
  }
  enumIncludes(edge.properties.type,
    ["owns", "depends-on", "imports", "exports", "produces", "consumes"], "edge type");
});

test("graph contract: imports, exports, produces, and consumes carry an explicit assurance", () => {
  const schema = json(GRAPH_SCHEMA);
  const edge = schema.$defs.edge;
  enumIncludes(edge.properties.assurance,
    ["syntactically-verified", "declarative-unverified"], "edge assurance");

  assert.ok(Array.isArray(edge.allOf), "edge schema has conditional assurance rules");
  for (const type of ["imports", "exports", "produces", "consumes"]) {
    const rule = edge.allOf.find((candidate) =>
      candidate.if?.properties?.type?.const === type);
    assert.ok(rule, `${type} has an assurance rule`);
    assert.ok(rule.then?.required?.includes("assurance"), `${type} requires assurance`);
  }
});

test("skeleton contract: manifest identifies its plan and classifies every planned path", () => {
  const schema = json(SKELETON_SCHEMA);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.ok(schema.required.includes("plan"), "manifest requires canonical plan identity");
  assert.equal(schema.properties.plan.type, "string");
  assert.equal(schema.properties.plan.minLength, 1);
  assert.equal(schema.properties.entries.items.$ref, "#/$defs/entry");

  const entry = schema.$defs.entry;
  for (const field of ["path", "classification"]) {
    assert.ok(entry.required.includes(field), `manifest entry requires ${field}`);
  }
  assert.equal(entry.properties.path.minLength, 1);
  enumIncludes(entry.properties.classification,
    ["created", "verified-compatible", "opaque-preserved"], "path classification");
  assert.equal(entry.additionalProperties, false);
});

test("projection contract: each Graph context slice is self-contained and deterministic", () => {
  const contract = read(PROJECTION);
  assert.match(contract, /Graph context:/, "names the rendered field");
  assert.match(contract, /owned nodes?/i, "includes owned nodes");
  assert.match(contract, /consumed nodes?/i, "includes consumed nodes");
  assert.match(contract, /produced nodes?/i, "includes produced nodes");
  assert.match(contract, /relevant dependency edges?/i, "includes relevant dependency edges");
  assert.match(contract, /self-contained/i, "slice does not require the sidecar");
  assert.match(contract, /(?:sort|order)[^\n]*(?:node|edge)|(?:node|edge)[^\n]*(?:sort|order)/i,
    "defines deterministic ordering");
});

test("identity contract: all artifact identities derive from one normalized model", () => {
  const contract = read(PROJECTION);
  assert.match(contract, /normalized model/i, "names the shared identity source");
  assert.match(contract, /stable task IDs?/i, "preserves stable task IDs");
  for (const artifact of ["plan", "manifest", "graph", "skeleton", "slice"]) {
    assert.match(contract, new RegExp(`(?:${artifact}[^\\n]*(?:identit|ID)|(?:identit|ID)[^\\n]*${artifact})`, "i"),
      `${artifact} identity is covered`);
  }
  assert.match(contract, /(?:derive|construct|form)[^\n]*(?:node|edge)[^\n]*ID/i,
    "documents deterministic node or edge ID derivation");
});

test("validation contract: graph errors reject the bundle and name the offending identity", () => {
  const contract = read(PROJECTION);
  const requiredFailures = [
    [/missing (?:source|target|endpoint|node)/i, "edge endpoint referencing a missing node"],
    [/unowned planned (?:file|path)|planned (?:file|path)[^\n]*unowned/i, "task referencing an unowned planned file"],
    [/duplicate (?:node )?ID/i, "duplicate node ID"],
    [/invalid assurance|assurance[^\n]*invalid/i, "invalid assurance"],
  ];
  for (const [pattern, label] of requiredFailures) {
    assert.match(contract, pattern, label);
  }
  assert.match(contract, /reject/i, "invalid model is rejected");
  assert.match(contract, /offending (?:identity|ID)|name[^\n]*offending/i,
    "diagnostic names the offending identity");
});
