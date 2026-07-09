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
module.exports = { read, fm };

test("plugin manifest: name, version, author", () => {
  const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
  assert.strictEqual(plugin.name, "ideas");
  assert.strictEqual(plugin.version, "0.1.0");
  assert.strictEqual(plugin.author.name, "MisterVitoPro");
});

test("versions agree across plugin.json, package.json, CHANGELOG", () => {
  const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
  const pkg = JSON.parse(read("package.json"));
  assert.strictEqual(pkg.version, plugin.version);
  assert.ok(read("CHANGELOG.md").includes("## [" + plugin.version + "]"),
    "CHANGELOG has an entry for the current version");
});

test("ledger stays out of version control by policy: repo gitignore exists", () => {
  const gi = read(".gitignore");
  assert.ok(gi.includes("node_modules"), ".gitignore covers node_modules");
});

const SKILL = "skills/interview/SKILL.md";

test("skill frontmatter: name and trigger-crafted description", () => {
  const { frontmatter } = fm(read(SKILL));
  assert.match(frontmatter, /^name: interview$/m);
  const desc = frontmatter.match(/^description: (.+)$/m)[1];
  assert.ok(desc.length <= 350, "description <= 350 chars, got " + desc.length);
  assert.ok(desc.includes("Not for typos, renames, or one-line fixes."), "exclusion clause present");
});

test("skill body: line budget and prose discipline", () => {
  const text = read(SKILL);
  const lines = text.split("\n").length;
  assert.ok(lines <= 150, "SKILL.md <= 150 lines, got " + lines);
  assert.ok(!/\b(MUST|NEVER|ALWAYS)\b/.test(text), "no all-caps imperatives");
  assert.ok(text.includes("## Known gotchas"), "gotchas section present");
});

test("skill: hard gate and terminal state", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("The run ends at an approved spec"), "hard gate sentence");
  assert.ok(body.includes("suggest next tools without invoking them"), "suggest-not-invoke");
});

test("skill: triage, decomposition, caps, wave budget", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("one AskUserQuestion call, up to 4 questions"), "triage batch shape");
  assert.ok(body.includes("interview exactly one sub-project"), "decomposition rule");
  assert.ok(body.includes("at most 5 AskUserQuestion calls before the approach checkpoint"), "call cap");
  assert.ok(body.includes("4, then 3, then 2"), "descending wave counts");
});

test("skill: wave rules — batching, quality, escape, resize", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("2-4 related multiple-choice questions"), "batch size");
  assert.ok(body.includes("reveal hidden assumptions, expose edge cases"), "no-obvious-questions rule");
  assert.ok(body.includes("Draft the spec now"), "escape hatch");
  assert.ok(body.includes("first question of the next wave"), "scope resize costs no extra call");
});

test("skill: ledger statuses and honesty invariant", () => {
  const { body } = fm(read(SKILL));
  for (const h of ["## Decided", "## Assumed (unconfirmed)", "## Open"]) {
    assert.ok(body.includes(h), "ledger heading " + h);
  }
  assert.ok(body.includes("`decided` only when the user actually selected or typed"), "decided definition");
  assert.ok(body.includes("a model guess is not promoted to `decided`"), "never-promote rule");
  assert.ok(body.includes("re-ask once as plain numbered prose"), "empty-answer fallback");
  assert.ok(body.includes("append the ledger file to the target repo's .gitignore"), "ledger gitignore policy");
});

test("skill: audit and critic contracts", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("ideas:spec-auditor") && body.includes("ideas:spec-critic"), "both agents dispatched");
  assert.ok(body.includes("do not override an audit finding"), "no-self-verify");
  assert.ok(body.includes('"unaudited" banner'), "audit fallback");
  assert.ok(body.includes("single biggest miss"), "critic single-miss bound");
  assert.ok(body.includes("no critique available"), "critic fallback");
});

test("skill: review gate with receipt and disposition", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("Approve / Add more / Modify / Start over"), "gate options");
  assert.ok(body.includes("review receipt"), "receipt");
  assert.ok(body.includes("presented verbatim"), "critic callout verbatim");
  assert.ok(body.includes("Only Approve ends the run"), "no self-declared completeness");
});

test("skill: context scan, ADRs, conflicts, git gating", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("supersede it?"), "ADR conflict question");
  assert.ok(body.includes("at most 2 MADR-lite ADRs"), "ADR emission bound");
  assert.ok(body.includes("ask which wins"), "conflicting-instructions rule");
  assert.ok(body.includes("git-gated"), "git optionality");
  assert.ok(body.includes("references/question-craft.md") && body.includes("references/spec-template.md"),
    "references linked one level deep");
});

const TEMPLATE = "skills/interview/references/spec-template.md";
const FIXTURE_LEDGER = "test-fixtures/ledger-example.md";

test("spec template: mandatory honesty sections and EARS", () => {
  const t = read(TEMPLATE);
  assert.ok(t.includes("## Assumptions (unconfirmed)"), "assumptions section");
  assert.ok(t.includes("## Open questions"), "open questions section");
  assert.ok(t.includes("structurally mandatory even when empty"), "mandatory-even-empty rule");
  assert.ok(t.includes("## Acceptance criteria (EARS)"), "EARS criteria section");
  assert.ok(/WHEN .*THE SYSTEM SHALL/.test(t), "EARS example pattern");
  assert.ok(t.includes("ADDED / MODIFIED / REMOVED"), "change deltas for brownfield");
  assert.ok(t.includes("interfaces, file paths, acceptance criteria, constraints - not function bodies"),
    "contracts-not-code rule");
});

test("fixture ledger maps every status to a template destination", () => {
  const l = read(FIXTURE_LEDGER);
  const t = read(TEMPLATE);
  assert.ok(l.includes("## Decided") && l.includes("## Assumed (unconfirmed)") && l.includes("## Open"),
    "fixture has all three status sections with rows");
  assert.ok(/\| 1 \|/.test(l), "fixture has at least one numbered row");
  assert.ok(t.includes("Every `assumed` ledger row appears here"), "template routes assumed rows");
  assert.ok(t.includes("Every `open` ledger row appears here"), "template routes open rows");
});

const CRAFT = "skills/interview/references/question-craft.md";

test("question-craft: taxonomy and wave guidance", () => {
  const c = read(CRAFT);
  for (const cat of ["Purpose", "Users", "Data", "Interfaces", "Edge cases", "Non-functionals", "Constraints", "Lifecycle"]) {
    assert.ok(c.includes("## " + cat), "taxonomy category " + cat);
  }
  assert.ok(c.includes("recommended default"), "defaults guidance");
  assert.ok(c.includes("later waves probe contradictions"), "descending-wave intent");
});

const AUDITOR = "agents/spec-auditor.md";

test("spec-auditor: least privilege and binding audit rules", () => {
  const { frontmatter, body } = fm(read(AUDITOR));
  assert.match(frontmatter, /^name: spec-auditor$/m);
  assert.match(frontmatter, /^tools: Read, Grep, Glob$/m);
  assert.ok(body.includes("only inputs are the two file paths"), "isolation from conversation");
  assert.ok(body.includes('"violations"') && body.includes('"clean"'), "JSON return contract");
  assert.ok(body.includes("report every violation; do not soften findings"), "no softening");
  assert.ok(body.includes("empty Assumptions section with assumed rows in the ledger is a violation"),
    "empty-assumptions rule");
});

const CRITIC = "agents/spec-critic.md";

test("spec-critic: least privilege, single-miss bound, honest-when-tight", () => {
  const { frontmatter, body } = fm(read(CRITIC));
  assert.match(frontmatter, /^name: spec-critic$/m);
  assert.match(frontmatter, /^tools: Read, Grep, Glob$/m);
  assert.ok(body.includes("exactly one miss"), "single-miss bound");
  assert.ok(body.includes('"biggest_miss"') && body.includes('"mitigations"'), "JSON return contract");
  assert.ok(body.includes("name the sharpest residual risk rather than inventing a problem"),
    "no fabricated findings");
});

test("trigger queries: at least 20, both polarities, messy phrasing", () => {
  const q = read("test-fixtures/trigger-queries.md");
  const should = q.match(/^SHOULD: /gm) || [];
  const shouldNot = q.match(/^SHOULD-NOT: /gm) || [];
  assert.ok(should.length >= 12, "at least 12 should-trigger queries, got " + should.length);
  assert.ok(shouldNot.length >= 8, "at least 8 should-not-trigger queries, got " + shouldNot.length);
});

test("docs + version reflect the v0.1.0 interview feature", () => {
  const readme = read("README.md");
  assert.ok(readme.includes("/ideas:interview"), "README documents the command");
  assert.ok(readme.includes("decided"), "README explains ledger statuses");
  assert.ok(readme.includes("spec-auditor") && readme.includes("spec-critic"), "README names both agents");
  assert.ok(readme.includes("MisterVitoPro"), "author credit");
});
