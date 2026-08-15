"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PLAN_SKILL = "skills/plan/SKILL.md";
const ARTIFACT_BUNDLE = "skills/plan/references/artifact-bundle.md";
const GRAPH_PROJECTION = "skills/plan/references/graph-projection.md";
const TASK_FORMAT = "skills/plan/references/task-format.md";
const MATERIALIZATION = "skills/plan/references/materialization.md";
const MATERIALIZER = "skills/plan/scripts/materialize-bundle.mjs";
const EXECUTION = "skills/plan/references/execution.md";
const TICKETS_SKILL = "skills/tickets/SKILL.md";
const TICKET_EMISSION = "skills/tickets/references/emission.md";
const SMOKE = "docs/release/plan-skeleton-graph-smoke.md";

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function section(document, heading) {
  const start = document.indexOf(heading);
  assert.notEqual(start, -1, `missing section ${heading}`);
  const remainder = document.slice(start + heading.length);
  const next = remainder.search(/\n##\s/);
  return next === -1 ? remainder : remainder.slice(0, next);
}

test("dual-client bundle contract shares one plan procedure and both invocation surfaces", () => {
  const claude = json(".claude-plugin/plugin.json");
  const codex = json(".codex-plugin/plugin.json");
  const plan = read(PLAN_SKILL);
  const smoke = read(SMOKE);

  assert.equal(claude.name, codex.name, "both clients install the same plugin identity");
  assert.equal(claude.version, codex.version, "both clients install the same plugin version");
  assert.equal(codex.skills, "./skills/", "Codex discovers the shared skill directory");
  assert.match(plan, /AskUserQuestion[\s\S]{0,120}request_user_input/,
    "the shared procedure maps its structured prompt to both hosts");
  assert.match(smoke, /Claude Code[\s\S]*\/ideas:plan/,
    "the operator protocol names the Claude Code invocation surface");
  assert.match(smoke, /Codex[\s\S]*\$ideas:plan/,
    "the operator protocol names the Codex invocation surface");
  assert.match(smoke, /Windows/i);
  assert.match(smoke, /macOS/i);
  assert.match(smoke, /Linux/i);
});

test("offline fixture contract covers supported, mixed, and unsupported repositories", () => {
  const fixtures = json("test-fixtures/skeleton-strategies.json");
  const materializer = read(MATERIALIZER);
  for (const category of ["supported", "mixed", "unsupported"]) {
    assert.ok(fixtures[category].length > 0, `${category} has a local fixture`);
    for (const fixture of fixtures[category]) {
      assert.equal(fixture.expected.requiresNetwork, false, `${fixture.id} is offline`);
      assert.equal(fixture.expected.requiresProjectGenerator, false,
        `${fixture.id} does not invoke a project generator`);
    }
  }
  assert.ok(fixtures.mixed.some((fixture) => {
    const strategies = fixture.paths.map((entry) => entry.strategyId);
    return strategies.some(Boolean) && strategies.some((strategy) => strategy === null);
  }), "a mixed fixture exercises a checked-in strategy and opaque fallback together");

  const imports = [...materializer.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)]
    .map((match) => match[1]);
  assert.ok(imports.length > 0, "the materializer declares its dependencies");
  assert.ok(imports.every((specifier) => specifier.startsWith("node:")),
    `materializer imports only Node built-ins: ${imports.join(", ")}`);
  assert.doesNotMatch(materializer, /\b(?:fetch|https?\.request|child_process)\s*\(/,
    "materialization has no network or project-generator call site");
});

test("sidecar names, versions, and plan identity link the plan, manifest, and graph", () => {
  const bundle = read(ARTIFACT_BUNDLE);
  const projection = read(GRAPH_PROJECTION);
  const manifest = json("skills/plan/references/skeleton-schema.json");
  const graph = json("skills/plan/references/graph-schema.json");

  assert.match(bundle, /<plan-stem>\.skeleton\.json/);
  assert.match(bundle, /<plan-stem>\.graph\.json/);
  for (const [label, schema] of [["manifest", manifest], ["graph", graph]]) {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.properties.schemaVersion.const, 1, `${label} schema is version 1`);
    assert.ok(schema.required.includes("plan"), `${label} requires the shared plan identity`);
    assert.equal(schema.properties.plan.minLength, 1, `${label} rejects an empty plan identity`);
  }
  assert.match(manifest.$id, /plan-skeleton-v1\.schema\.json$/);
  assert.match(graph.$id, /plan-graph-v1\.schema\.json$/);
  assert.match(projection, /graph and manifest[\s\S]{0,100}version 1 schemas/i,
    "full validation binds both sidecars to their schemas");
  assert.match(projection, /graph and manifest `plan` values[\s\S]{0,120}shared plan identity/i,
    "cross-artifact validation binds both sidecars to one plan");
});

test("manifest and graph preserve the same honest assurance distinctions", () => {
  const manifest = json("skills/plan/references/skeleton-schema.json");
  const graph = json("skills/plan/references/graph-schema.json");
  const fixtures = json("test-fixtures/skeleton-strategies.json");
  const expected = ["syntactically-verified", "declarative-unverified"];
  const graphAssurance = graph.$defs.edge.properties.assurance;
  const manifestEntry = manifest.$defs.entry;
  const fixturePaths = ["supported", "mixed", "unsupported"]
    .flatMap((category) => fixtures[category])
    .flatMap((fixture) => fixture.paths);
  const fixtureAssurances = new Set([
    fixtures.opaqueFallback.connectionAssurance,
    ...fixturePaths.map((entry) => entry.expected.assurance),
    ...fixturePaths.flatMap((entry) => entry.connections.map((connection) => connection.assurance)),
  ]);
  const assuredEdgeTypes = graph.$defs.edge.allOf
    .filter((candidate) => candidate.then?.required?.includes("assurance"))
    .map((candidate) => candidate.if?.properties?.type?.const);

  assert.deepEqual([...graphAssurance.enum].sort(), [...expected].sort(),
    "graph edges use the two assurance levels");
  assert.ok(manifestEntry.properties.assurance,
    "the manifest schema describes the assurance emitted for each entry");
  assert.deepEqual([...manifestEntry.properties.assurance.enum].sort(), [...expected].sort(),
    "manifest entries use the graph-v1 assurance vocabulary");
  assert.ok(manifestEntry.required.includes("assurance"),
    "every classified manifest entry reports its assurance");
  assert.deepEqual([...fixtureAssurances].sort(), [...expected].sort(),
    "fixtures use exactly the manifest and graph assurance vocabulary");
  assert.deepEqual(assuredEdgeTypes.sort(), ["imports", "exports", "produces", "consumes"].sort(),
    "all connection edge types, and only connection edge types, require assurance");
  for (const entry of fixturePaths) {
    assert.ok(expected.includes(entry.expected.assurance),
      `${entry.path} classification uses a declared assurance`);
    for (const connection of entry.connections) {
      assert.ok(assuredEdgeTypes.includes(connection.type),
        `${entry.path} ${connection.type} is an assured edge type`);
      assert.ok(expected.includes(connection.assurance),
        `${entry.path} ${connection.type} uses a declared assurance`);
    }
  }
});

test("task graph slices remain self-contained for all four plan-only consumers", () => {
  const format = read(TASK_FORMAT);
  const projection = read(GRAPH_PROJECTION);
  const plan = read(PLAN_SKILL);
  const execution = read(EXECUTION);
  const tickets = read(TICKETS_SKILL);

  assert.match(format, /Graph context:[\s\S]*owned[\s\S]*consumed[\s\S]*produced[\s\S]*(?:edge|dependenc)/i);
  assert.match(projection, /Graph context:[^{]*\{"task"[^\n]*"owned"[^\n]*"consumed"[^\n]*"produced"[^\n]*"nodes"[^\n]*"edges"/i,
    "the rendered task slice carries resolvable node and edge identities");

  assert.match(plan, /plan-runner needs only the plan file/i,
    "plan-runner consumes the canonical plan without a sidecar");
  for (const heading of ["## Inline mode", "## Subagent mode"]) {
    const mode = section(execution, heading);
    assert.match(mode, /task brief[\s\S]*Graph context:/i, `${heading} retains the task slice`);
    assert.match(mode, /owned[\s\S]*consumed[\s\S]*produced[\s\S]*dependenc/i,
      `${heading} retains all graph identities and dependency edges`);
  }
  assert.match(tickets, /Reads only the plan file/i, "tickets is plan-only");
  assert.match(tickets, /copy `Graph context:` verbatim/i, "tickets retains the task slice");
  assert.match(`${execution}\n${tickets}`, /(?:do not|never) dereference a graph sidecar or manifest sidecar/i,
    "plan-only consumers never resolve the full sidecars");
});

test("legacy nine-field plans retain behavior across every plan-only consumer", () => {
  const bundle = read(ARTIFACT_BUNDLE);
  const plan = read(PLAN_SKILL);
  const execution = read(EXECUTION);
  const emission = read(TICKET_EMISSION);

  assert.match(bundle, /Legacy plans without sidecars or `Graph context:`[\s\S]{0,100}valid inputs/i);
  assert.match(plan, /plan-runner needs only the plan file/i,
    "the plan-runner handoff does not impose a sidecar migration");
  assert.match(execution, /existing nine-field plan without `Graph context:` remains valid without migration/i);
  assert.match(execution, /inline and subagent execution retain their unchanged pre-feature behavior/i);
  assert.match(emission, /existing nine-field plan without this additive field remains valid and follows legacy behavior/i,
    "tickets preserves legacy plan behavior");
});

test("completion waits for atomic preflight and rollback-capable bundle materialization", () => {
  const plan = read(PLAN_SKILL);
  const bundle = read(ARTIFACT_BUNDLE);
  const materialization = read(MATERIALIZATION);
  const materializer = read(MATERIALIZER);

  for (const artifact of ["canonical plan", "planned skeleton", "skeleton manifest", "typed graph"]) {
    assert.match(bundle, new RegExp(artifact, "i"), `bundle includes ${artifact}`);
  }
  assert.match(bundle, /emission complete[\s\S]{0,180}all been created successfully/i);
  assert.match(bundle, /failed or partial emission does not reach the completion gate/i);
  assert.match(plan, /Emit the complete bundle[\s\S]{0,220}completion gate/i);
  assert.match(materialization, /Preflight reads and classifies every source target before any[\s\S]{0,80}created/i);
  assert.match(materialization, /reports every conflicting source or incompatible existing sidecar[\s\S]{0,100}untouched/i);
  assert.match(materialization, /Recovery unlinks every file created by the transaction in reverse order/i);
  assert.match(materializer, /preflightOnly/);
  assert.match(materializer, /injectFailureAfterWrites/);
  assert.match(materializer, /const rollback = async \(\) =>/);
});

test("manual smoke protocol covers the release matrix with observable results for both clients", () => {
  const smoke = read(SMOKE);
  const scenarios = [
    /new-plan bundle creation/i,
    /created and opaque-preserved paths/i,
    /full-graph validation/i,
    /conflict refusal with no mutation/i,
    /injected rollback/i,
    /completion-gate routing/i,
    /downstream execution/i,
  ];
  for (const scenario of scenarios) assert.match(smoke, scenario);
  for (const fixture of ["supported", "mixed-language", "unsupported", "legacy-plan"]) {
    assert.match(smoke, new RegExp(fixture, "i"), `${fixture} fixture is assigned to a verification layer`);
  }

  const scenarioBlocks = smoke.split(/\n(?=## Scenario:)/).filter((block) => /^## Scenario:/m.test(block));
  assert.ok(scenarioBlocks.length >= scenarios.length, "each required smoke scenario has its own block");
  for (const block of scenarioBlocks) {
    const name = block.match(/^## Scenario:\s*(.+)$/m)?.[1] || "unnamed scenario";
    assert.match(block, /Setup:/i, `${name} states setup`);
    assert.match(block, /Action:/i, `${name} states the action`);
    assert.match(block, /Expected artifact paths and classifications:/i,
      `${name} states expected artifacts and classifications`);
    assert.match(block, /Observable pass\/fail:/i, `${name} states an observable result`);
    assert.match(block, /Claude Code[\s\S]*\/ideas:plan/i, `${name} covers Claude Code`);
    assert.match(block, /Codex[\s\S]*\$ideas:plan/i, `${name} covers Codex`);
  }
});
