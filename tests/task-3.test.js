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

const AUDITOR = "agents/spec-auditor.md";

test("auditor: violation JSON pins claim/location/reason/classification/suggested_fix", () => {
  const { body } = fm(read(AUDITOR));
  assert.ok(body.includes('"claim"'), "claim field present");
  assert.ok(body.includes('"location"'), "location field present");
  assert.ok(body.includes('"reason": "unbacked | missing-row"'), "reason field with existing values");
  assert.ok(body.includes('"classification": "feature | parameter"'),
    "classification field valued feature or parameter");
  assert.ok(
    body.includes('"suggested_fix": "demote to Assumptions | add to Open questions | confirm-or-remove"'),
    "suggested_fix gains the confirm-or-remove option alongside the v1 values"
  );
});

test("auditor: classification present specifically on unbacked violations", () => {
  const { body } = fm(read(AUDITOR));
  assert.ok(body.includes("classification") && body.includes("present on"),
    "prose ties the classification field to unbacked violations");
  assert.ok(body.includes("`unbacked`"), "unbacked reason value referenced when introducing classification");
});

test("auditor: feature means the claim adds capability or user-visible surface", () => {
  const { body } = fm(read(AUDITOR));
  assert.ok(body.includes("adds capability or user-visible surface"),
    "feature definition present verbatim");
});

test("auditor: parameter means the claim fills in a value for something already decided", () => {
  const { body } = fm(read(AUDITOR));
  assert.ok(body.includes("fills in a value for something already decided"),
    "parameter definition present verbatim");
});

test("auditor: ambiguous unbacked claims default to feature classification", () => {
  const { body } = fm(read(AUDITOR));
  assert.ok(body.includes("cannot classify"), "cannot-classify trigger present");
  assert.ok(body.includes("classify it as feature"), "ambiguous-defaults-to-feature rule present");
});

test("auditor: Verification strategy tags classify as parameter, never feature", () => {
  const { body } = fm(read(AUDITOR));
  assert.ok(body.includes("Verification strategy"), "Verification strategy section named");
  assert.ok(body.includes("classify them as parameter, never feature"),
    "Verification strategy tags are always parameter, never feature");
});

test("auditor: Architecture & components claims backed by approach-checkpoint decided row or linked ADRs", () => {
  const { body } = fm(read(AUDITOR));
  assert.ok(body.includes("Architecture & components"), "Architecture & components section named");
  assert.ok(
    body.includes("tracing to the approach-checkpoint decided row or linked ADRs as backed"),
    "approach-checkpoint decided row and linked ADRs both count as backing"
  );
});

test("auditor: existing v1 rules preserved verbatim alongside the new classification verdict", () => {
  const { body } = fm(read(AUDITOR));
  assert.match(read(AUDITOR).match(/^---\n([\s\S]*?)\n---/)[1], /^tools: Read, Grep, Glob$/m);
  assert.ok(body.includes("report every violation; do not soften findings"), "no-softening rule preserved");
  assert.ok(body.includes("demote it to Assumptions"), "fills-in-a-value claims still demote to Assumptions as in v1");
});
