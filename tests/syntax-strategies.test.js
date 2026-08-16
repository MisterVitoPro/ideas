"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const CONTRACT_PATH = "skills/plan/references/syntax-strategies.md";
const FIXTURES_PATH = "test-fixtures/skeleton-strategies.json";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

function loadFixtures() {
  return JSON.parse(read(FIXTURES_PATH));
}

function allFixtures(fixtures) {
  return [...fixtures.supported, ...fixtures.mixed, ...fixtures.unsupported];
}

function allPaths(fixture) {
  assert.ok(Array.isArray(fixture.paths) && fixture.paths.length > 0,
    `${fixture.id} declares at least one path`);
  return fixture.paths;
}

test("strategy matrix: every bounded support row has an exact fixture contract", () => {
  const contract = read(CONTRACT_PATH);
  const fixtures = loadFixtures();

  assert.equal(fixtures.schemaVersion, 1);
  assert.ok(Array.isArray(fixtures.strategyRows) && fixtures.strategyRows.length > 0,
    "the verified support matrix is finite and non-empty");
  const ids = new Set();
  for (const row of fixtures.strategyRows) {
    for (const field of [
      "id", "language", "filePattern", "safePlaceholder", "importRule",
      "exportRule", "compatibilityRule", "nonReplacementRule", "fixtureId",
    ]) {
      assert.equal(typeof row[field], "string", `${row.id || "strategy row"} has ${field}`);
      assert.ok(row[field].trim(), `${row.id || "strategy row"} has non-empty ${field}`);
      assert.ok(contract.includes(row[field]), `${row.id}.${field} is documented exactly`);
    }
    assert.ok(!ids.has(row.id), `strategy id ${row.id} is unique`);
    ids.add(row.id);
    const fixture = fixtures.supported.find((candidate) => candidate.id === row.fixtureId);
    assert.ok(fixture, `${row.id} is paired with supported fixture ${row.fixtureId}`);
    assert.ok(allPaths(fixture).some((entry) => entry.strategyId === row.id),
      `${row.fixtureId} exercises ${row.id}`);
  }
});

test("compatible path: verification proves the planned node and connections without replacement", () => {
  const fixtures = loadFixtures();
  const compatiblePaths = fixtures.supported.flatMap(allPaths)
    .filter((entry) => entry.existing === true && entry.expected?.compatible === true);

  assert.ok(compatiblePaths.length > 0, "at least one supported fixture covers existing compatible content");
  for (const entry of compatiblePaths) {
    assert.equal(entry.expected.action, "verify-compatible", `${entry.path} is verified in place`);
    assert.equal(entry.expected.classification, "verified-compatible");
    assert.equal(entry.expected.plannedNodeVerified, true, `${entry.path} verifies its planned node`);
    assert.equal(entry.expected.requiredConnectionsVerified, true,
      `${entry.path} verifies required connections`);
    assert.equal(entry.expected.replaceExisting, false, `${entry.path} is never replaced`);
    assert.equal(entry.expected.contentAfter, entry.contentBefore,
      `${entry.path} preserves existing content byte-for-byte`);
  }
});

test("opaque fallback: unsupported missing paths are safe and existing paths remain opaque", () => {
  const fixtures = loadFixtures();
  assert.ok(Array.isArray(fixtures.unsupported) && fixtures.unsupported.length > 0,
    "an unsupported fixture is present");
  const paths = fixtures.unsupported.flatMap(allPaths);
  const missing = paths.filter((entry) => entry.existing === false);
  const existing = paths.filter((entry) => entry.existing === true);
  assert.ok(missing.length > 0, "unsupported fixtures cover a missing path");
  assert.ok(existing.length > 0, "unsupported fixtures cover an existing path");

  for (const entry of missing) {
    assert.equal(entry.strategyId, null, `${entry.path} does not guess a syntax strategy`);
    assert.equal(entry.expected.action, "create-safe-placeholder");
    assert.equal(entry.expected.semanticValidation, false);
    assert.equal(entry.expected.assurance, "declarative-unverified");
  }
  for (const entry of existing) {
    assert.equal(entry.strategyId, null, `${entry.path} does not guess a syntax strategy`);
    assert.equal(entry.expected.action, "preserve-opaque");
    assert.equal(entry.expected.classification, "opaque-preserved");
    assert.equal(entry.expected.editExisting, false);
    assert.equal(entry.expected.semanticValidation, false);
    assert.equal(entry.expected.contentAfter, entry.contentBefore,
      `${entry.path} preserves opaque content byte-for-byte`);
    assert.ok(entry.connections.length > 0, `${entry.path} includes declarative connections`);
    for (const connection of entry.connections) {
      assert.equal(connection.assurance, "declarative-unverified",
        `${entry.path} connection ${connection.type} has honest fallback assurance`);
    }
  }
});

test("fixture selection: supported, mixed, and unsupported repositories resolve per path locally", () => {
  const fixtures = loadFixtures();
  const strategyIds = new Set(fixtures.strategyRows.map((row) => row.id));
  for (const category of ["supported", "mixed", "unsupported"]) {
    assert.ok(Array.isArray(fixtures[category]) && fixtures[category].length > 0,
      `${category} fixture set is exercised`);
  }

  for (const fixture of allFixtures(fixtures)) {
    assert.equal(fixture.expected.requiresProjectGenerator, false,
      `${fixture.id} needs no project-specific generator`);
    assert.equal(fixture.expected.requiresNetwork, false, `${fixture.id} needs no network access`);
    for (const entry of allPaths(fixture)) {
      if (entry.strategyId !== null) {
        assert.ok(strategyIds.has(entry.strategyId), `${entry.path} selects a checked-in strategy`);
      }
    }
  }

  for (const fixture of fixtures.mixed) {
    const selected = allPaths(fixture).map((entry) => entry.strategyId);
    assert.ok(selected.some((id) => id !== null), `${fixture.id} selects a supported strategy`);
    assert.ok(selected.some((id) => id === null), `${fixture.id} also selects the opaque fallback`);
  }
});

test("structural outcome: honest schema-valid placeholders may succeed without building", () => {
  const fixtures = loadFixtures();
  const nonBuilding = allFixtures(fixtures).filter((fixture) =>
    fixture.expected.builds === false || fixture.expected.typeChecks === false);
  assert.ok(nonBuilding.length > 0, "a fixture pins the non-goal of build or type-check success");

  for (const fixture of nonBuilding) {
    assert.equal(fixture.expected.structuralGenerationSucceeds, true,
      `${fixture.id} succeeds structurally`);
    assert.equal(fixture.expected.schemaValid, true, `${fixture.id} remains schema-valid`);
    assert.equal(fixture.expected.assuranceHonest, true, `${fixture.id} reports honest assurance`);
    for (const entry of allPaths(fixture)) {
      assert.ok(["syntactically-verified", "declarative-unverified"].includes(entry.expected.assurance),
        `${entry.path} uses an assurance value from graph-v1`);
    }
  }
});

test("strategy verification: matrix rows and fixture strategy coverage match exactly", () => {
  const fixtures = loadFixtures();
  const matrixIds = fixtures.strategyRows.map((row) => row.id).sort();
  const fixtureIds = [...new Set(fixtures.supported.flatMap(allPaths)
    .map((entry) => entry.strategyId)
    .filter(Boolean))].sort();
  assert.deepEqual(fixtureIds, matrixIds,
    "every verified strategy has a fixture and no fixture claims an unlisted strategy");
});
