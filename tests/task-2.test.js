"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { read, fm } = require("./contract.test.js");

const SKILL = "skills/interview/SKILL.md";

test("skill: review gate digest capped at 12 lines with overflow phrase", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("12 lines"), "digest line cap of 12 lines is stated");
  assert.ok(body.includes("+N more in the file"), "overflow phrase '+N more in the file' present");
});

test("skill: unrequested feature presented as confirm-or-remove", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("unrequested - confirm or remove"),
    "auditor-flagged unbacked feature claims are presented as 'unrequested - confirm or remove'");
});

test("skill: more than 3 flagged features resolve in exactly one follow-up call", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("exactly one follow-up structured question call"),
    "remainder beyond 3 flagged features is resolved in one structured question call");
});

test("skill body: stays at or under the 150-line budget", () => {
  const text = read(SKILL);
  const lines = text.split("\n").length;
  assert.ok(lines <= 150, "SKILL.md <= 150 lines, got " + lines);
});

test("skill: approach checkpoint requires enumerating chosen approach's components", () => {
  const { body } = fm(read(SKILL));
  assert.ok(/enumerat\w* .*component/i.test(body) || /component\w* .*enumerat/i.test(body),
    "approach-checkpoint prose requires enumerating the chosen approach's components");
});

test("skill: review gate does not echo the full spec body", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("not the spec body"),
    "gate-2 presents the receipt and callout, not the full spec body");
});
