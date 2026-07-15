"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { read, fm } = require("./contract.test.js");

const TEMPLATE = "skills/interview/references/spec-template.md";
const SKILL = "skills/interview/SKILL.md";
const AUDITOR = "agents/spec-auditor.md";

test("template v2 headings pinned as invariants", () => {
  const t = read(TEMPLATE);
  assert.ok(t.includes("## Architecture & components"), "Architecture & components heading");
  assert.ok(t.includes("## Verification strategy"), "Verification strategy heading");
  assert.ok(t.includes("### Non-functional requirements"), "Non-functional requirements subheading");
});

test("SKILL.md digest cap phrase and overflow phrase pinned as invariants", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("12 lines"), "12-line digest cap phrase present");
  assert.ok(body.includes("+N more in the file"), "overflow phrase '+N more in the file' present");
});

test("SKILL.md line count stays at or under the 150-line budget", () => {
  const text = read(SKILL);
  const lines = text.split("\n").length;
  assert.ok(lines <= 150, "SKILL.md <= 150 lines, got " + lines);
});

test("spec-auditor.md classification contract pinned as invariants", () => {
  const { body } = fm(read(AUDITOR));
  assert.ok(body.includes('"classification": "feature | parameter"'),
    "classification field valued feature or parameter");
  assert.ok(body.includes("cannot classify") && body.includes("classify it as feature"),
    "ambiguous-defaults-to-feature rule present");
  assert.ok(
    body.includes('"suggested_fix": "demote to Assumptions | add to Open questions | confirm-or-remove"'),
    "confirm-or-remove suggested_fix option present"
  );
});

test("release: client manifests are synchronized at 0.7.0", () => {
  const claude = JSON.parse(read(".claude-plugin/plugin.json"));
  const codex = JSON.parse(read(".codex-plugin/plugin.json"));
  assert.strictEqual(claude.version, "0.7.0");
  assert.strictEqual(codex.version, claude.version);
});

test("release: package version is synchronized at 0.7.0", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.strictEqual(pkg.version, "0.7.0");
});

test("release: CHANGELOG.md has a 0.4.0 entry", () => {
  const changelog = read("CHANGELOG.md");
  assert.ok(changelog.includes("## [0.4.0]"), "CHANGELOG has an entry for 0.4.0");
});

test("release: contract-test version pin is 0.7.0", () => {
  const contractSrc = read("tests/contract.test.js");
  assert.ok(contractSrc.includes('"0.7.0"'),
    "tests/contract.test.js pins version 0.7.0");
});

test("release: README documents the template v2 sections", () => {
  const readme = read("README.md");
  assert.ok(readme.includes("Architecture & components"),
    "README documents the Architecture & components section");
  assert.ok(readme.includes("Verification strategy"),
    "README documents the Verification strategy section");
});
