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

const SKILL = "skills/interview/SKILL.md";
const ADAPTER = "skills/interview/references/plan-adapter.md";

// --- flag removal: --plan-runner is retired in favor of the Ideas plan skill ---

test("skill: --plan-runner flag is no longer mentioned anywhere in SKILL.md", () => {
  const text = read(SKILL);
  assert.ok(!text.includes("--plan-runner"), "SKILL.md no longer references the --plan-runner flag");
});

test("skill: standalone flag-driven adapter entry point sentence is gone", () => {
  const { body } = fm(read(SKILL));
  assert.ok(!/skip the interview and run the plan adapter/i.test(body),
    "the old '--plan-runner <spec-path>' standalone entry point sentence is removed");
});

// --- gate routing: 'Approve + generate plan' runs the Ideas plan skill ---

test("skill: review gate text references the Ideas plan skill", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("Ideas plan skill"), "gate text names the Ideas plan skill");
});

test("skill: 'Approve + generate plan' routes into the Ideas plan logic", () => {
  const { body } = fm(read(SKILL));
  assert.ok(
    /completes approval identically, then runs the Ideas plan skill/i.test(body),
    "gate option 'Approve + generate plan' explicitly runs the Ideas plan logic"
  );
});

test("skill: gate no longer routes through the retired plan-adapter reference", () => {
  const { body } = fm(read(SKILL));
  assert.ok(!body.includes("references/plan-adapter.md"),
    "gate text no longer points at skills/interview/references/plan-adapter.md");
  assert.ok(!/runs the plan adapter/i.test(body), "gate no longer says 'runs the plan adapter'");
});

test("skill: the gate option set itself is unchanged by the routing swap", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("Approve + generate plan (recommended) / Approve / Add more / Modify / Start over"),
    "five gate options still present verbatim");
});

// --- line budget ---

test("skill: SKILL.md stays within its 150-line budget", () => {
  const text = read(SKILL);
  const lines = text.split("\n").length;
  assert.ok(lines <= 150, "SKILL.md <= 150 lines, got " + lines);
});

// --- plan-adapter.md: removed, or reduced to a pointer with no duplicate procedure ---

test("plan-adapter reference: removed entirely, or reduced to a short pointer at /ideas:plan", () => {
  const filePath = path.join(ROOT, ADAPTER);
  if (!fs.existsSync(filePath)) {
    assert.ok(true, "skills/interview/references/plan-adapter.md was removed");
    return;
  }
  const a = read(ADAPTER);
  const lines = a.split("\n").length;
  assert.ok(lines <= 20, "pointer-only file stays short, got " + lines + " lines");
  assert.ok(a.includes("/ideas:plan"), "pointer names the new /ideas:plan command");
});

test("plan-adapter reference: no duplicate procedure text survives if the file remains", () => {
  const filePath = path.join(ROOT, ADAPTER);
  if (!fs.existsSync(filePath)) {
    assert.ok(true, "file removed - nothing to duplicate");
    return;
  }
  const a = read(ADAPTER);
  assert.ok(!a.includes("## Procedure"), "no duplicate Procedure section");
  assert.ok(!a.includes("## Plan template"), "no duplicate Plan template section");
  assert.ok(!/Refuse fast:/.test(a), "no duplicated refusal-procedure text");
  assert.ok(!/Confirm-or-carry:/.test(a), "no duplicated confirm-or-carry procedure text");
  assert.ok(!a.includes("<root>/plans/YYYY-MM-DD-<slug>.plan.md"),
    "no duplicated plan-path/template contract - that now lives only in skills/plan/");
});
