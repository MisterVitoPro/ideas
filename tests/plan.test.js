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

const SKILL = "skills/plan/SKILL.md";
const TASK_FORMAT = "skills/plan/references/task-format.md";

test("plan skill: frontmatter names the command", () => {
  const { frontmatter } = fm(read(SKILL));
  assert.match(frontmatter, /^name: plan$/m);
  const desc = frontmatter.match(/^description: (.+)$/m)[1];
  assert.ok(desc.length <= 350, "description <= 350 chars, got " + desc.length);
});

test("plan skill: writes the canonical plan file at the dated path", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("docs/plans/YYYY-MM-DD-<slug>.plan.md"), "plan path convention");
  assert.ok(body.includes("Goal"), "header carries Goal");
  assert.ok(body.includes("Source spec"), "header carries Source spec");
  assert.ok(body.includes("Flagged constraints (unconfirmed)"), "header carries carried assumptions");
});

test("plan skill: refuses fast when the spec has no Acceptance criteria section", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("Acceptance criteria"), "names the required section");
  assert.ok(/refuse/i.test(body), "refusal path present");
  assert.ok(/one sentence/i.test(body), "refusal is one sentence");
  assert.ok(/writes? nothing|write nothing/i.test(body), "refusal writes nothing");
  assert.ok(/never invents? criteria/i.test(body), "never fabricates criteria to satisfy the gate");
});

test("plan skill: confirm-or-carry routes unresolved spec assumptions into the header", () => {
  const { body } = fm(read(SKILL));
  assert.ok(/confirm-or-carry/i.test(body), "confirm-or-carry step named");
  assert.ok(/carry(ing)? is the (safe )?default/i.test(body) || /carrying is the safe default/i.test(body),
    "carry is the default on an empty answer");
});

test("plan skill: emits a flat ordered task list with no wave groupings", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("flat ordered task list"), "flat ordered task list phrase");
  assert.ok(/no wave grouping/i.test(body), "explicitly rules out wave grouping");
  assert.ok(/plan-runner('s)? analyzer/i.test(body), "waving stays plan-runner's analyzer's job");
  assert.ok(/plan-runner:run.*unchanged|unchanged.*plan-runner:run/is.test(body),
    "file is accepted by /plan-runner:run unchanged");
});

test("plan skill: Task 1 is a walking skeleton and every other task carries a blocked-by edge", () => {
  const { body } = fm(read(SKILL));
  assert.ok(/walking skeleton/i.test(body), "walking skeleton term used");
  assert.ok(/hotspot files/i.test(body), "walking skeleton owns hotspot files");
  assert.ok(/two or more tasks|2\+ tasks|>=\s*2 tasks/i.test(body) || /at least two tasks/i.test(body),
    "rule is scoped to plans with two or more tasks");
  assert.ok(/blocked.by/i.test(body), "blocked-by edges required on every non-skeleton task");
});

test("plan skill: task IDs are assigned once and never renumbered across re-emissions", () => {
  const { body } = fm(read(SKILL));
  assert.ok(/<slug>-t\d\d|<slug>-t<NN>/i.test(body), "task-ID scheme <slug>-tNN referenced");
  assert.ok(/stable/i.test(body), "stability guarantee stated");
  assert.ok(/never renumber/i.test(body), "existing tasks are never renumbered");
  assert.ok(/re-emission|re-emit|re-run/i.test(body), "stability holds across re-emissions, not just first write");
});

test("plan skill: task sections carry full EARS text, never a bare reference number", () => {
  const { body } = fm(read(SKILL));
  assert.ok(/full text of the EARS criteria|full EARS text/i.test(body), "full criterion text rule");
  assert.ok(/never a bare reference number/i.test(body), "no numeric-only references");
  assert.ok(/reference-only pattern/i.test(body), "self-check names the reference-only pattern");
  assert.ok(/refuse to write the plan and name the offending task/i.test(body),
    "self-check refusal names the offending task");
});

test("plan skill: verification commands and non-goals are part of every task section", () => {
  const { body } = fm(read(SKILL));
  assert.ok(/verification command/i.test(body), "verification commands required");
  assert.ok(/non-goals/i.test(body), "non-goals required");
});

test("plan skill: plan commit is git-gated", () => {
  const { body } = fm(read(SKILL));
  assert.ok(/git-gated/i.test(body), "git-gated term used");
  assert.ok(/git is absent|no git|without git/i.test(body), "degrades gracefully without git");
  assert.ok(/committing was skipped|skip(ped)? committing/i.test(body), "notes when committing was skipped");
});

test("plan skill: contracts, not code, in task bodies", () => {
  const { body } = fm(read(SKILL));
  assert.ok(/never function bodies, test code, or shell commands|no code bodies/i.test(body),
    "tasks stay contracts, executors write the code");
});

test("plan skill: lazy pointer to the shared task-format reference", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("references/task-format.md"), "reference linked one level deep");
});

test("plan skill: stays within the lean-skill line budget", () => {
  const text = read(SKILL);
  const lines = text.split("\n").length;
  assert.ok(lines <= 150, "SKILL.md <= 150 lines, got " + lines);
});

// --- shared task-format contract (skills/plan/references/task-format.md) ---
// Owned by a sibling task; asserted here because /ideas:plan's acceptance criteria
// are only meetable if the shared field contract underneath it holds.

test("task-format reference: field lines are pinned verbatim", () => {
  const t = read(TASK_FORMAT);
  assert.ok(/^### Task N: <title>$/m.test(t) || t.includes("### Task N: <title>"), "task heading shape");
  for (const field of [
    "Task ID:", "Owned files:", "Interfaces:", "Acceptance criteria:",
    "Verification:", "Non-goals:", "Blocked by:", "Constraints:",
  ]) {
    assert.ok(t.includes(field), "field line " + field);
  }
});

test("task-format reference: task-ID scheme is <slug>-tNN", () => {
  const t = read(TASK_FORMAT);
  assert.ok(/<slug>-t<?NN>?/i.test(t), "task-ID scheme documented");
});
