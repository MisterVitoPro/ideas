"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}
function fm(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, "file has frontmatter fenced by ---");
  return { frontmatter: m[1], body: m[2] };
}

const DOCS_LOCATION = "skills/interview/references/docs-location.md";
const INTERVIEW_SKILL = "skills/interview/SKILL.md";
const PLAN_SKILL = "skills/plan/SKILL.md";
const TASK_FORMAT = "skills/plan/references/task-format.md";
const EXECUTION = "skills/plan/references/execution.md";
const SPEC_TEMPLATE = "skills/interview/references/spec-template.md";
const TICKETS_SKILL = "skills/tickets/SKILL.md";

// Vocabulary specific to the detection algorithm itself; any file other than
// docs-location.md that restates this vocabulary is restating the algorithm,
// not just citing or deriving from it.
const ALGORITHM_VOCAB = [
  "Docs-bias short-circuit",
  "lexicographically first",
  "artifact pass",
];

test("docs-location.md exists and states the conventional priority order", () => {
  assert.ok(fs.existsSync(path.join(ROOT, DOCS_LOCATION)), "reference file exists");
  const t = read(DOCS_LOCATION);
  assert.ok(t.includes("`docs` > `documentation` > `doc` > `.docs`"),
    "states the conventional priority order docs > documentation > doc > .docs");
});

test("docs-location.md: both passes, artifact runs before conventional", () => {
  const t = read(DOCS_LOCATION);
  assert.ok(t.includes("## Pass 1: artifact pass"), "artifact pass section present");
  assert.ok(t.includes("## Pass 2: conventional pass"), "conventional pass section present");
  assert.ok(/Two passes run in order;\s+the first pass to produce a candidate wins/.test(t),
    "states passes run in order and the first to produce a candidate wins");
  assert.ok(t.includes("Runs only when the artifact pass finds no candidate."),
    "conventional pass explicitly gated on the artifact pass finding nothing");
});

test("docs-location.md: depth-2 artifact-pass boundary", () => {
  const t = read(DOCS_LOCATION);
  assert.ok(t.includes("looks at most one level below each immediate child"),
    "artifact pass bounded to one level below each immediate child");
  assert.ok(t.includes("does not descend further"),
    "artifact pass explicitly does not descend further");
  assert.ok(/Considers only immediate children of the\s+repository root/.test(t),
    "conventional pass bounded to immediate children of the repository root");
});

test("docs-location.md: content-check signal, not filename shape", () => {
  const t = read(DOCS_LOCATION);
  assert.ok(t.includes("`- design spec` title line"),
    "content-check requires the design-spec title line");
  assert.ok(t.includes("`## Acceptance criteria (EARS)` heading"),
    "content-check requires the EARS heading");
  assert.ok(/shape is not\s+itself a signal/.test(t),
    "states the YYYY-MM-DD-<slug>.md filename shape alone is not a signal");
});

test("docs-location.md: docs-bias short-circuit and lexicographic tie-break", () => {
  const t = read(DOCS_LOCATION);
  assert.ok(t.includes("Docs-bias short-circuit"), "docs-bias short-circuit named");
  assert.ok(t.includes("resolve the root to `docs/` in preference to any other"),
    "docs-bias short-circuit resolves to docs/ over other candidates");
  assert.ok(t.includes("select the lexicographically first candidate by directory name."),
    "lexicographic-first tie-break stated");
});

test("docs-location.md: docs/ fallback", () => {
  const t = read(DOCS_LOCATION);
  assert.ok(t.includes("resolve the root to `docs/` and create `<root>/specs`,"),
    "neither-pass fallback resolves to docs/ and creates the artifact tree");
});

test("interview SKILL.md: cites docs-location.md, no hardcoded write paths", () => {
  const { body } = fm(read(INTERVIEW_SKILL));
  assert.ok(body.includes("references/docs-location.md"), "cites docs-location.md");
  assert.ok(!body.includes("docs/specs"), "no hardcoded docs/specs write path in body");
  assert.ok(!body.includes("docs/adr"), "no hardcoded docs/adr write path in body");
});

test("plan SKILL.md: derives root from spec path, no hardcoded docs/plans write path", () => {
  const { body } = fm(read(PLAN_SKILL));
  assert.ok(body.includes("the docs root is the approved spec path's parent directory's parent"),
    "root is derived from the spec path, not detected");
  assert.ok(!body.includes("docs/plans"), "no hardcoded docs/plans write path in body");
});

test("plan SKILL.md: does not restate the detection algorithm", () => {
  const { body } = fm(read(PLAN_SKILL));
  for (const term of ALGORITHM_VOCAB) {
    assert.ok(!body.includes(term), "plan skill does not restate detection vocabulary: " + term);
  }
});

test("task-format.md: root-relative plan-file naming, no hardcoded docs/plans", () => {
  const t = read(TASK_FORMAT);
  assert.ok(t.includes("`<root>/plans/YYYY-MM-DD-<slug>.plan.md`"),
    "plan-file naming expressed relative to the resolved root");
  assert.ok(!t.includes("docs/plans/"), "no hardcoded docs/plans/ artifact path");
  for (const term of ALGORITHM_VOCAB) {
    assert.ok(!t.includes(term), "task-format.md does not restate detection vocabulary: " + term);
  }
});

test("execution.md: root-relative plan file location, no hardcoded docs/plans", () => {
  const e = read(EXECUTION);
  assert.ok(/`<root>\/plans\/YYYY-MM-DD-<slug>\.plan\.md`, where `<root>` is the resolved docs root/.test(e),
    "plan file location expressed relative to the resolved root");
  assert.ok(!e.includes("docs/plans/"), "no hardcoded docs/plans/ artifact path");
  for (const term of ALGORITHM_VOCAB) {
    assert.ok(!e.includes(term), "execution.md does not restate detection vocabulary: " + term);
  }
});

test("spec-template.md: root-relative ADR link, no hardcoded docs/adr", () => {
  const t = read(SPEC_TEMPLATE);
  assert.ok(t.includes("link `<root>/adr/NNNN-<slug>.md` here"),
    "ADR link expressed relative to the resolved root");
  assert.ok(!t.includes("docs/adr/"), "no hardcoded docs/adr/ artifact path");
  for (const term of ALGORITHM_VOCAB) {
    assert.ok(!t.includes(term), "spec-template.md does not restate detection vocabulary: " + term);
  }
});

test("tickets SKILL.md: no detection algorithm, derives slug from the handed plan path, unchanged", () => {
  const text = read(TICKETS_SKILL);
  assert.ok(!text.includes("docs-location"), "no reference to docs-location.md");
  for (const term of ALGORITHM_VOCAB) {
    assert.ok(!text.includes(term), "tickets skill does not contain detection vocabulary: " + term);
  }
  assert.ok(/The slug comes from\s+the plan filename \(`YYYY-MM-DD-<slug>\.plan\.md`\)\./.test(text),
    "slug is derived from the handed plan path");
  assert.ok(text.includes("Reads only the plan file - never the source spec or ledger"),
    "tickets remains plan-file-only, unaffected by docs-location detection");
});
