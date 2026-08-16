"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { read, fm } = require("./contract.test.js");

const SKILL = "skills/tickets/SKILL.md";

test("tickets skill: frontmatter name and trigger-crafted description", () => {
  const { frontmatter } = fm(read(SKILL));
  assert.match(frontmatter, /^name: tickets$/m);
  const desc = frontmatter.match(/^description: (.+)$/m)[1];
  assert.ok(desc.length <= 350, "description <= 350 chars, got " + desc.length);
  assert.ok(/plan/i.test(desc), "description names the plan file it projects");
});

test("tickets skill: line budget stays at or under 150 lines", () => {
  const text = read(SKILL);
  const lines = text.split("\n").length;
  assert.ok(lines <= 150, "SKILL.md <= 150 lines, got " + lines);
});

test("tickets skill: heavy procedure text deferred to the emission reference", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("references/emission.md"), "lazy pointer to the emission reference");
});

// --- GitHub issue creation: parent + one sub-issue per exported task ---

test("tickets skill: creates one parent tracking issue and one sub-issue per exported task", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("one parent tracking issue"), "parent tracking issue created");
  assert.ok(body.includes("one sub-issue per exported task"), "one sub-issue per exported task");
});

test("tickets skill: requires a GitHub-backed repo before creating issues", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("GitHub-backed repo"), "GitHub-backed repo precondition named");
});

// --- Sub-issue linking and labeling ---

test("tickets skill: sub-issues linked to the parent via gh api graphql addSubIssue", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("gh api graphql"), "gh api graphql invocation named");
  assert.ok(body.includes("addSubIssue"), "addSubIssue mutation named");
  assert.ok(body.includes("gh has no built-in sub-issue command"), "rationale for the graphql mutation");
});

test("tickets skill: every sub-issue labeled ideas-plan:<slug> and agent-ready", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("ideas-plan:<slug>"), "ideas-plan:<slug> label named");
  assert.ok(body.includes("agent-ready"), "agent-ready label named");
});

test("tickets skill: labels are created if absent", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("Labels created if absent"), "label-creation fallback stated");
});

// --- Issue body rendering ---

test("tickets skill: issue body rendered from the task section and flagged constraints alone", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("task section and the plan's flagged constraints alone"),
    "body-source restriction stated verbatim");
});

test("tickets skill: rendered issue body carries no vendor-specific fields", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("no vendor-specific fields"), "no-vendor-fields rule stated");
});

test("tickets skill: rendered issue preserves Graph context from the task section", () => {
  const { body } = fm(read(SKILL));
  const emission = read("skills/tickets/references/emission.md");
  assert.match(body, /Graph context:/i, "rendering names the Graph context field");
  assert.match(body, /task section[\s\S]{0,250}Graph context:/i,
    "Graph context is copied from the canonical Markdown task section");
  assert.match(body + "\n" + emission, /(?:read|use|consult)[^\n]*(?:only )?(?:the )?plan file/i,
    "ticket projection remains plan-file-only");
  assert.match(body + "\n" + emission, /(?:do not|never)[^\n]*(?:graph|manifest) sidecar/i,
    "ticket rendering does not dereference graph artifacts");
});

test("tickets skill: reads only the plan file, never the source spec or ledger", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("Reads only the plan file"), "plan-file-only input rule stated");
  assert.ok(body.includes("never the source spec or ledger"), "spec/ledger exclusion stated");
});

test("tickets Definition-of-Ready treats Graph context as additive", () => {
  const emission = read("skills/tickets/references/emission.md");
  assert.match(emission, /Graph context:[\s\S]{0,250}additive/i,
    "Graph context is an additive field at the gate");
  assert.match(emission, /self-contained/i, "self-containedness remains required");
  assert.match(emission, /full EARS|EARS text/i, "full EARS acceptance text remains required");
  assert.match(emission, /file-isolated/i, "file isolation remains required");
  assert.match(emission, /(?:legacy|existing) nine-field plan/i,
    "the gate retains compatibility with legacy nine-field tasks");
});

test("tickets Definition-of-Ready rejects Graph context sidecar references", () => {
  const emission = read("skills/tickets/references/emission.md");
  assert.match(emission, /Graph context:[\s\S]{0,300}sidecar/i,
    "the gate identifies sidecar-backed Graph context as invalid");
  assert.match(emission, /held back|fails?[^\n]*self-contained/i,
    "the existing self-containedness gate rejects the task");
  assert.match(emission, /(?:do not|never)[^\n]*dereference/i,
    "the tickets consumer never follows the sidecar reference");
});

// --- Error handling: no GitHub remote / missing gh / unauthenticated gh ---

test("tickets skill: refuses in one sentence when the GitHub remote is missing", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("no GitHub remote"), "no-remote trigger named");
});

test("tickets skill: refuses in one sentence when gh is missing", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("gh is missing"), "gh-missing trigger named");
});

test("tickets skill: refuses in one sentence when gh is unauthenticated", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("gh is unauthenticated"), "gh-unauthenticated trigger named");
});

test("tickets skill: refusal names what is missing and writes nothing", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("refuse in one sentence naming what is missing"), "refusal shape stated");
  assert.ok(body.includes("write nothing") || body.includes("writes nothing"),
    "no partial writes on refusal");
});

// --- gh-only, no stored tokens ---

test("tickets skill: GitHub operations use only the gh CLI, storing no tokens in files", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("only the gh CLI"), "gh-CLI-only constraint stated");
  assert.ok(body.includes("no tokens"), "no-stored-tokens constraint stated");
});
