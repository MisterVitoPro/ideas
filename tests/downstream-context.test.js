"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { read } = require("./contract.test.js");

const EXECUTION = "skills/plan/references/execution.md";
const PLAN_SKILL = "skills/plan/SKILL.md";
const TASK_FORMAT = "skills/plan/references/task-format.md";

function section(text, heading) {
  const start = text.indexOf(heading);
  assert.notStrictEqual(start, -1, `missing section ${heading}`);
  const rest = text.slice(start + heading.length);
  const next = rest.search(/\n##\s/);
  return next === -1 ? rest : rest.slice(0, next);
}

test("plan-only consumers receive complete Graph context from the Markdown task section", () => {
  const execution = read(EXECUTION);
  const plan = read(PLAN_SKILL);
  const format = read(TASK_FORMAT);

  assert.match(format, /Graph context:[\s\S]*owned[\s\S]*consumed[\s\S]*produced[\s\S]*(?:edge|dependenc)/i,
    "the Markdown task section carries the complete projected graph slice");
  assert.match(plan, /plan-runner[\s\S]{0,500}(?:only|solely)[^\n]*plan file/i,
    "the plan-runner handoff remains plan-file-only");
  assert.match(execution, /(?:Markdown )?task section[\s\S]{0,300}Graph context/i,
    "inline and subagent execution consume Graph context from the task section");
  assert.match(execution, /(?:do not|never)[^\n]*(?:graph|manifest) sidecar/i,
    "execution does not require a sidecar lookup");
});

test("inline and subagent task briefs retain graph identities and dependency edges", () => {
  const execution = read(EXECUTION);
  for (const heading of ["## Inline mode", "## Subagent mode"]) {
    const mode = section(execution, heading);
    assert.match(mode, /task brief/i, `${heading} defines its self-contained task brief`);
    assert.match(mode, /Graph context:/i, `${heading} retains the Graph context field`);
    for (const identity of ["owned", "consumed", "produced", "dependenc"]) {
      assert.match(mode, new RegExp(identity, "i"), `${heading} retains ${identity} identities`);
    }
  }
});

test("legacy nine-field plans remain valid for every plan-only consumer without migration", () => {
  const execution = read(EXECUTION);
  const plan = read(PLAN_SKILL);

  assert.match(execution, /(?:legacy|existing) nine-field plan/i,
    "execution explicitly accepts the legacy task contract");
  assert.match(execution, /without (?:migration|Graph context|sidecars?)/i,
    "legacy execution requires no migration or generated graph artifact");
  assert.match(execution, /(?:inline|subagent)[\s\S]{0,300}(?:unchanged|pre-feature|existing behavior)/i,
    "inline and subagent behavior is preserved");
  assert.match(plan, /plan-runner needs only the plan file/i,
    "plan-runner continues to receive the canonical plan directly");
});
