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

test("plugin manifests: name, version, author", () => {
  const claude = JSON.parse(read(".claude-plugin/plugin.json"));
  const codex = JSON.parse(read(".codex-plugin/plugin.json"));
  assert.strictEqual(claude.name, "ideas");
  assert.strictEqual(codex.name, claude.name);
  assert.strictEqual(claude.version, "0.7.0");
  assert.strictEqual(codex.version, claude.version);
  assert.strictEqual(claude.author.name, "MisterVitoPro");
  assert.strictEqual(codex.author.name, claude.author.name);
  assert.strictEqual(codex.skills, "./skills/");
});

test("versions agree across plugin.json, package.json, CHANGELOG", () => {
  const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
  const codex = JSON.parse(read(".codex-plugin/plugin.json"));
  const pkg = JSON.parse(read("package.json"));
  assert.strictEqual(codex.version, plugin.version);
  assert.strictEqual(pkg.version, plugin.version);
  assert.ok(read("CHANGELOG.md").includes("## [" + plugin.version + "]"),
    "CHANGELOG has an entry for the current version");
});

test("repo hygiene: .gitignore exists and covers node_modules", () => {
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
  assert.ok(body.includes("one structured question call, up to 4 questions"), "triage batch shape");
  assert.ok(body.includes("interview exactly one sub-project"), "decomposition rule");
  assert.ok(body.includes("at most 5 structured question calls before the approach checkpoint"), "call cap");
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
  assert.ok(body.includes("../../agents/spec-auditor.md") && body.includes("../../agents/spec-critic.md"),
    "Codex can load both bundled agent definitions relative to the skill");
  assert.ok(body.includes("do not override an audit finding"), "no-self-verify");
  assert.ok(body.includes('"unaudited" banner'), "audit fallback");
  assert.ok(body.includes("single biggest miss"), "critic single-miss bound");
  assert.ok(body.includes("no critique available"), "critic fallback");
  assert.ok(body.includes("`ideas:spec-critic` - advisory"), "critic advisory framing");
  assert.ok(body.includes("chosen mitigation -> `decided`; deferred -> `open`; dismissed -> noted"),
    "critic disposition mapping");
  assert.ok(body.includes("architectural"), "ADR trigger: architectural decisions");
  assert.ok(body.includes("scope is M or L"), "ADR trigger: scope bound");
});

test("skill: review gate with receipt and disposition", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("Approve + generate plan (recommended) / Approve / Add more / Modify / Start over"),
    "gate options");
  assert.ok(body.includes("review receipt"), "receipt");
  assert.ok(body.includes("presented verbatim"), "critic callout verbatim");
  assert.ok(body.includes("full rationale stays in the ledger"), "full rationale stays in the ledger, not the chat surface");
  assert.ok(body.includes("Only the two Approve options end the run"), "no self-declared completeness");
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

test("spec template: existing-system section", () => {
  const t = read(TEMPLATE);
  assert.ok(t.includes("## Existing system"), "existing system heading");
  assert.ok(t.includes("greenfield - confirmed by user"), "only allowed empty value");
});

test("spec template: binding defaults replace passive assumptions", () => {
  const t = read(TEMPLATE);
  assert.ok(t.includes("Binding default:"), "binding default label");
  assert.ok(t.includes("reversal"), "reversal-cost weighing");
  assert.ok(t.includes("welded into a matching EARS criterion"), "binding default welded into EARS");
});

test("spec template: definition of done and constraint-conflict check", () => {
  const t = read(TEMPLATE);
  assert.ok(t.includes("## Definition of done"), "definition of done heading");
  assert.ok(t.includes("constraint-conflict check"), "constraint-conflict check line");
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

test("question-craft: standing probes", () => {
  const c = read(CRAFT);
  assert.ok(c.includes("## Standing probes"), "standing probes heading");
  assert.ok(c.includes("air-gap"), "non-functionals air-gap probe");
  assert.ok(c.includes("list every screen"), "interfaces surface-inventory probe");
});

test("question-craft: interviewing rules", () => {
  const c = read(CRAFT);
  assert.ok(c.includes("one requirement type per question"), "one requirement type per question");
  assert.ok(c.includes("paraphrase"), "paraphrase-before-binding rule");
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

test("docs + version reflect the v0.3.0 breadth-floor feature", () => {
  const readme = read("README.md");
  assert.ok(readme.includes("/ideas:interview"), "README documents the command");
  assert.ok(readme.includes("decided"), "README explains ledger statuses");
  assert.ok(readme.includes("spec-auditor") && readme.includes("spec-critic"), "README names both agents");
  assert.ok(readme.includes("MisterVitoPro"), "author credit");
  assert.ok(readme.includes("Approve + generate plan"), "README documents the gate option");
  assert.ok(readme.includes("binding default"), "README documents binding defaults");
  assert.ok(readme.includes("coverage gate"), "README documents floor v2");
});

// --- v0.5.0 plan-stage invariants ---

test("README: pipeline description references /ideas:plan and /ideas:tickets, drops --plan-runner", () => {
  const readme = read("README.md");
  assert.ok(readme.includes("/ideas:plan"), "README documents /ideas:plan");
  assert.ok(readme.includes("/ideas:tickets"), "README documents /ideas:tickets");
  assert.ok(readme.includes("$ideas:interview") && readme.includes("$ideas:plan") && readme.includes("$ideas:tickets"),
    "README documents Codex skill mentions");
  assert.ok(!readme.includes("--plan-runner"), "README no longer documents the retired --plan-runner flag");
});

const PLAN_SKILL = "skills/plan/SKILL.md";
const TASK_FORMAT = "skills/plan/references/task-format.md";
const EXECUTION = "skills/plan/references/execution.md";
const TICKETS_SKILL = "skills/tickets/SKILL.md";

test("ideas:plan skill: frontmatter name and trigger-crafted description", () => {
  const { frontmatter } = fm(read(PLAN_SKILL));
  assert.match(frontmatter, /^name: plan$/m);
  const desc = frontmatter.match(/^description: (.+)$/m)[1];
  assert.ok(desc.includes("docs/plans/YYYY-MM-DD-<slug>.plan.md"), "description names the plan path convention");
  assert.ok(desc.includes("plan-runner run skill"), "description names the plan-runner consumer");
});

test("ideas:plan skill: procedure pins refusal, carry, walking skeleton, task IDs", () => {
  const text = read(PLAN_SKILL);
  assert.ok(text.includes("references/task-format.md"), "points at the task-format reference");
  assert.ok(text.includes("no Acceptance criteria section"), "missing-criteria refusal trigger");
  assert.ok(text.includes("never invent criteria"), "no fabrication");
  assert.ok(text.includes("Flagged constraints (unconfirmed)"), "carried items header");
  assert.ok(text.includes("<slug>-t<NN>"), "task ID scheme");
  assert.ok(text.includes("never renumbered"), "task ID stability");
  assert.ok(text.includes("walking skeleton"), "walking skeleton rule");
  assert.ok(text.includes("flat ordered task list"), "no pre-waving");
  assert.ok(text.includes("accepted by the plan-runner run skill unchanged"), "plan-runner compatibility");
  assert.ok(text.includes("reference-only pattern"), "self-check trigger");
  assert.ok(text.includes("## Known gotchas"), "gotchas section present");
});

test("task-format reference: field lines verbatim and task-ID scheme", () => {
  const t = read(TASK_FORMAT);
  for (const field of [
    "### Task N: <title>",
    "Task ID:",
    "Owned files:",
    "Interfaces:",
    "Acceptance criteria:",
    "Verification:",
    "Non-goals:",
    "Blocked by:",
    "Constraints:",
  ]) {
    assert.ok(t.includes(field), "task-format pins field line " + field);
  }
  assert.ok(t.includes("<slug>-t<NN>"), "task-ID scheme");
  assert.ok(t.includes("never renumbered") || t.includes("SHALL NOT change"), "task-ID stability rule");
});

test("ideas:tickets skill: frontmatter name and trigger-crafted description", () => {
  const { frontmatter } = fm(read(TICKETS_SKILL));
  assert.match(frontmatter, /^name: tickets$/m);
  const desc = frontmatter.match(/^description: (.+)$/m)[1];
  assert.ok(desc.includes("Definition-of-Ready"), "description names the DoR gate");
  assert.ok(desc.includes("Not for drafting or editing the plan itself"), "exclusion clause present");
});

test("ideas:tickets skill: preflight refusals, gh-only, labels, sub-issue linking", () => {
  const text = read(TICKETS_SKILL);
  assert.ok(text.includes("no GitHub remote"), "no-remote refusal phrase");
  assert.ok(text.includes("gh is missing"), "gh-missing refusal phrase");
  assert.ok(text.includes("gh is unauthenticated"), "gh-unauthenticated refusal phrase");
  assert.ok(text.includes("using only the gh CLI, storing no tokens in files"), "gh-only no-tokens rule");
  assert.ok(text.includes("ideas-plan:<slug>") && text.includes("agent-ready"), "issue labels");
  assert.ok(text.includes("addSubIssue"), "sub-issue linking mutation named");
  assert.ok(text.includes("references/emission.md"), "delegates DoR/upsert detail to emission reference");
  assert.ok(text.includes("checklist item under the sub-issue fallback") || text.includes("sub-issue fallback"),
    "sub-issue fallback announced");
});

test("ideas:plan skill: refusals, honesty carry, and task shape", () => {
  const p = read(PLAN_SKILL);
  assert.ok(p.includes("no Acceptance criteria section"), "missing-criteria refusal trigger");
  assert.ok(p.includes("never invent criteria"), "no fabrication");
  assert.ok(p.includes("Flagged constraints (unconfirmed)"), "carried items header");
  assert.ok(p.includes("flat ordered task list"), "no pre-waving");
  assert.ok(p.includes("<slug>-t<NN>"), "task ID scheme");
  assert.ok(p.includes("never renumbered"), "task ID stability");
  assert.ok(p.includes("reference-only pattern"), "self-check trigger");
  assert.ok(p.includes("docs/plans/YYYY-MM-DD-<slug>.plan.md"), "plan path convention");
});

test("skill: elicitation floor v2 - breadth gate", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("## Elicitation floor"), "elicitation floor heading");
  assert.ok(body.includes("flagging a gap is not a substitute for asking about it"),
    "gap flagging is not asking");
  assert.ok(body.includes("Gap waves buy breadth, never depth"), "breadth-over-depth rule");
  assert.ok(body.includes("sweep the empty categories"), "sweep-the-empty-categories rule");
  assert.ok(body.includes("Non-functionals") && body.includes("Lifecycle") && body.includes("Interfaces"),
    "chronic blind spots named");
  assert.ok(body.includes("up to two extra gap waves"), "extra gap wave bound");
  assert.ok(body.includes("still within the 5-call cap"), "gap waves respect the call cap");
  assert.ok(body.includes("Not probed:"), "receipt names unprobed categories");
  assert.ok(body.includes("all categories probed"), "receipt clean-case phrasing");
});

test("skill: existing-system baseline", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("existing-system baseline"), "baseline term");
  assert.ok(body.includes("cannot draft while the baseline is unknown"), "baseline blocks drafting");
});

test("skill: round-trip requirement rule", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("never silently dropped"), "no requirement silently dropped");
});

test("skill: assumption collision rule", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("never self-adjudicated"), "hard-constraint collisions go back to the user");
});

test("skill: review gate routes to the Ideas plan skill, drops --plan-runner", () => {
  const { body } = fm(read(SKILL));
  assert.ok(!body.includes("--plan-runner"), "standalone flag no longer accepted");
  assert.ok(body.includes("runs the Ideas plan skill in the same session"),
    "approve+generate routes to the Ideas plan skill");
});

test("dual-client skill contract: Codex-safe frontmatter and host-neutral tooling", () => {
  const allowed = new Set(["name", "description", "allowed-tools", "license", "metadata"]);
  for (const rel of [SKILL, PLAN_SKILL, TICKETS_SKILL]) {
    const { frontmatter, body } = fm(read(rel));
    const keys = frontmatter.split("\n")
      .filter((line) => line && !/^\s/.test(line) && line.includes(":"))
      .map((line) => line.split(":", 1)[0]);
    assert.ok(keys.every((key) => allowed.has(key)), `${rel} uses only Codex-safe frontmatter`);
    assert.ok(!body.includes("skills/plan/") && !body.includes("skills/tickets/"),
      `${rel} does not assume a repository-root path for bundled cross-skill references`);
  }
  assert.ok(read(SKILL).includes("request_user_input"), "interview maps questions to Codex input tooling");
});

test("skill: token-cost discipline", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("append the new rows to the ledger with a targeted edit"),
    "ledger updates are targeted appends");
  assert.ok(body.includes("whole-file rewrites were measured as the interview's dominant token cost"),
    "measured cost justification");
  assert.ok(body.includes("keep wave prose lean"), "lean wave prose");
  assert.ok(body.includes("re-summarize answers in conversation"), "existing pin still holds");
  assert.ok(body.includes("not the spec body"), "review gate does not echo spec body");
});

// --- v0.4.0 template-v2 invariants ---

test("spec template v2: architecture, verification, and NFR sections", () => {
  const t = read(TEMPLATE);
  assert.ok(t.includes("## Architecture & components"), "Architecture & components heading");
  assert.ok(t.includes("## Verification strategy"), "Verification strategy heading");
  assert.ok(t.includes("### Non-functional requirements"), "Non-functional requirements subheading");
});

test("skill: gate-2 digest cap and overflow phrase", () => {
  const { body } = fm(read(SKILL));
  assert.ok(body.includes("12 lines"), "12-line digest cap phrase");
  assert.ok(body.includes("+N more in the file"), "overflow phrase");
});

// --- v0.6.0 pipeline-chaining invariants ---

test("ideas:plan skill: completion-gate step and re-entry (resume vs regenerate) step present", () => {
  const p = read(PLAN_SKILL);
  assert.ok(p.includes("Completion gate:"), "completion-gate step present");
  assert.ok(p.includes("Re-entry check"), "re-entry check heading present");
  assert.ok(p.includes("Resume remaining tasks") && p.includes("Regenerate plan"),
    "resume vs regenerate options named");
});

test("execution reference: exists and pins the exec() commit convention", () => {
  const e = read(EXECUTION);
  assert.ok(e.includes("exec(<slug>-tNN): <title>"), "commit convention pinned verbatim");
});

test("spec-auditor: classification contract and confirm-or-remove", () => {
  const { body } = fm(read(AUDITOR));
  assert.ok(body.includes('"classification": "feature | parameter"'),
    "classification field valued feature or parameter");
  assert.ok(body.includes("cannot classify") && body.includes("classify it as feature"),
    "ambiguous-defaults-to-feature rule");
  assert.ok(
    body.includes('"suggested_fix": "demote to Assumptions | add to Open questions | confirm-or-remove"'),
    "confirm-or-remove suggested_fix option");
});
