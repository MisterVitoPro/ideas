# spec-interview — design spec

Date: 2026-07-08
Status: awaiting user approval
Author: MisterVitoPro

## 1. Problem

Interview-style elicitation tools (superpowers:brainstorming, spec-kit `/clarify`, Kiro Spec Mode, Cursor Plan Mode) all converge on the same convention — small question batches, a hard gate before implementation, a durable Markdown spec — but share three unsolved failure modes, documented across their issue trackers and reviews:

1. **No scope calibration.** The same heavyweight interview fires for a one-line tweak and a new subsystem, so users skip the ceremony and eat the rework.
2. **Invisible assumptions.** When the user doesn't answer something, every tool silently bakes the model's guess into the spec as if the user decided it.
3. **Context bloat, no resumability.** The interview lives entirely in conversation context; nothing survives `/clear`, and long interviews thrash the prompt cache (one-question-per-turn plus a >5-minute human pause forces a full cache re-write per turn).

spec-interview is a Claude Code plugin that runs a token-conscious elicitation interview and fixes all three.

## 2. Goals

- Interview the user to turn a raw idea into a standalone, tool-agnostic design spec.
- Size the interview to the task: one wave for small scopes, descending-count waves for large ones.
- Track every requirement in an on-disk ledger with exactly three statuses — `decided`, `open`, `assumed` — and never present an assumption as a decision.
- Stay cheap: batched multiple-choice questions, state in a file instead of conversation, lean always-resident skill body, zero subagents in the interactive loop.
- Be resumable: after `/clear` (or days later), re-invoking the skill picks the interview up from the ledger alone.
- Make honesty structural, not promised: a non-interactive ledger audit verifies the drafted spec against the ledger before the user ever sees it (section 5) — the same separation-of-roles principle as plan-runner's verifier, avoiding the self-scored-quality-loop pattern this design criticizes in competitors.
- Fully replace superpowers:brainstorming (section 12): everything its interview achieves, at lower token cost, scope-sized, resumable, and honest by construction.

## 3. Non-goals

- No implementation, planning, or code generation. The terminal state is an approved spec plus a pointer at possible next tools (plan-runner; or superpowers:writing-plans while superpowers is still installed — see section 12 for the replacement path). It invokes neither.
- No coupling to plan-runner's wave format. The spec is plain Markdown any planner can consume. (A plan-runner-native output adapter is a possible future minor version.)
- No mock-interview / job-interview-prep features. Different product; out of scope permanently for this plugin.
- No visual companion, browser UI, or multi-model routing in v1.

## 4. Plugin shape

Repo: `D:\claude_plugins\spec-interview`. One skill, mirroring plan-runner's layout and test culture:

```
spec-interview/
  .claude-plugin/plugin.json      name: spec-interview, version 0.1.0
  skills/run/SKILL.md             the interviewer (lean; target <= 150 lines)
  skills/run/references/
    question-craft.md             wave-design guidance + ambiguity taxonomy (lazy-loaded)
    spec-template.md              output spec skeleton incl. mandatory Assumptions section
  tests/contract.test.js          pins load-bearing phrases in SKILL.md (node --test)
  README.md  CHANGELOG.md  package.json  LICENSE
```

Command surface: `/spec-interview:run [idea]`. One skill only — skill descriptions compete in a ~2K-token session-wide listing budget, so the plugin ships a single keyword-dense description (<= 350 chars, third person, states what + when).

Token rules baked into the skill's own structure (from Anthropic's skill-authoring guidance):
- SKILL.md body <= 150 lines, load-bearing flow in the first screenful (compaction keeps only the front ~5K tokens of a skill).
- References exactly one level deep, split by concern, read only when needed. `question-craft.md` is consulted when designing waves; `spec-template.md` only at drafting time.
- No subagents anywhere in the interactive loop (4–7x token multiplier, and subagents cannot relay AskUserQuestion to the user). One deliberate exception: the post-draft ledger audit (section 5) is non-interactive, read-only, and runs exactly once — the isolation is the point, not a cost.

## 5. Interview flow

```
invoke -> resume check -> context scan -> triage batch -> waves (scope-sized)
       -> approach checkpoint [GATE 1] -> draft spec from ledger -> self-review
       -> ledger audit (read-only, structural) -> user reviews spec [GATE 2]
       -> done (suggest next tools)
```

**Resume check.** If a ledger matching the idea's slug exists and has `open` items or a non-`complete` status, offer: resume from ledger / start over. On resume, the ledger is the only state read — not the old transcript.

**Context scan.** Lightweight look at the target repo (README, docs/, recent commits) before asking anything, so no question wastes the user's time on facts the repo already answers. Read-only.

**Triage batch.** One AskUserQuestion call (up to 4 questions) establishing: scope size (S/M/L, model recommends one), who consumes the spec, hard constraints, greenfield vs. existing code. Scope sets the depth budget:

| Scope | Waves after triage | Max MC questions per wave |
|-------|--------------------|---------------------------|
| S     | 1                  | 4                         |
| M     | 2                  | 4, then 3                 |
| L     | 3                  | 4, then 3, then 2         |

Descending counts are deliberate: early waves cover ground, later waves probe contradictions and blind spots. Hard cap: no more than 5 AskUserQuestion calls total before the approach checkpoint, ever.

**Waves.** Each wave is one AskUserQuestion batch of 2–4 related multiple-choice questions (each with a recommended default), plus at most one open-ended prose question per wave reserved for the genuinely fuzzy heart of the idea. Every wave from the second onward includes a "Draft the spec now" escape option — choosing it ends questioning immediately and downgrades all unasked planned questions to `assumed` or `open`. After each wave the ledger file is updated; the conversation does not re-summarize answers.

**Scope resize.** Users are unreliable at self-assessing scope, so triage's S/M/L is provisional. If answers in any wave reveal the scope was miscalled (an "S" sprouting subsystems, an "L" collapsing to a config change), the model proposes resizing as the first question of the *next* wave's batch — it never spends an extra AskUserQuestion call on it, and the resize decision lands in the ledger like any other.

**Ledger audit (structural honesty).** After self-review, a read-only audit verifies the draft against the ledger with fresh eyes: every normative claim in the spec must trace to a `decided` row, or appear under Assumptions (matching an `assumed` row) or Open questions (matching an `open` row). Anything unbacked is a violation: the claim is demoted to the Assumptions section and, if material, flagged to the user at gate 2. The audit runs as a read-only subagent whose only inputs are the ledger file and the draft spec — deliberately isolated from the interview conversation so it cannot "remember" justifications that were never recorded. The orchestrating skill never overrides an audit finding (plan-runner's no-self-verify rule, ported). If the audit cannot run (subagent failure), the spec is presented with an explicit "unaudited" banner — never silently.

**Approach checkpoint (gate 1).** The model presents 2–3 candidate approaches with trade-offs and a recommendation in one message, and the user picks via one AskUserQuestion call. Recorded in the ledger as `decided`.

**Draft.** The spec is generated from the ledger plus `spec-template.md` — not from conversational memory. Then a self-review pass (placeholder scan, internal consistency, scope check, ambiguity check) with inline fixes.

**Spec review (gate 2).** The user is asked to review the written spec file. Changes loop back to the draft step. On approval the run is complete; the skill suggests — but does not invoke — follow-on tools.

## 6. Ledger format

Path in the target repo: `docs/specs/YYYY-MM-DD-<slug>.ledger.md`, next to the eventual spec `docs/specs/YYYY-MM-DD-<slug>.md`. Human-readable, diff-friendly Markdown with fixed headings so the skill (and contract tests) can parse it:

```markdown
# Interview Ledger: <topic>
slug: payment-retry
started: 2026-07-08
scope: M
status: in-progress   # in-progress | drafting | awaiting-review | complete

## Decided
| # | Question | Decision | Wave |

## Assumed (unconfirmed)
| # | Topic | Assumed default | Why unasked/unanswered |

## Open
| # | Question | Why it matters |
```

Status rules (the honesty invariant, modeled on plan-runner's):
- An entry is `decided` only if the user actually selected or typed an answer.
- Empty, skipped, timed-out, or never-asked items are `assumed` (model supplies a labeled default) or `open` (no sane default exists). The model never promotes its own guess to `decided`.
- The drafted spec must carry every `assumed` entry in a mandatory **Assumptions (unconfirmed)** section and every `open` entry under **Open questions**. A spec with an empty Assumptions section when the ledger has assumed rows is a bug — and the ledger audit (section 5) exists to catch exactly this class of bug structurally.

Commit policy: the **spec is committed**; the **ledger is gitignored** (appended to the target repo's `.gitignore` on first write, gated on git availability — plan-runner's pattern for run artifacts). The ledger is interview exhaust: essential during elicitation and for resume, but it doesn't belong in anyone's PR. The spec's Assumptions and Open questions sections preserve the honesty information durably, so nothing auditable is lost when a ledger is cleaned up.

## 7. Spec output template (summary)

`spec-template.md` defines: Problem, Goals, Non-goals, Users/consumers, Requirements, Chosen approach (+ alternatives considered and why rejected), Data & interfaces, Edge cases & error handling, Acceptance criteria, **Assumptions (unconfirmed)**, **Open questions**. Sections scale to scope; S-scope specs may be under a page. The Assumptions and Open questions sections are structurally mandatory even when empty ("None").

## 8. Error handling

- **Empty AskUserQuestion answers** (known plugin-skill bug, claude-code #29547): an empty or missing answer is never treated as consent to the recommended option. Re-ask once as plain numbered prose questions; if still unanswered, record as `assumed`.
- **User bails mid-interview** ("just draft it", interrupt, timeout): draft immediately from whatever the ledger holds; honesty statuses make the resulting spec safe rather than silently overconfident.
- **git absent in the target repo:** all git operations (committing the spec) are gated on git availability, plan-runner style. The ledger and spec are still written; committing is skipped with a note.
- **No docs/ directory:** created on first write.
- **Ledger hand-edited between sessions:** treated as authoritative — the file is the source of truth, by design.

## 9. Testing & verification

- `tests/contract.test.js` (node --test) pins the load-bearing prose in SKILL.md, plan-runner style: the hard gate sentence; the 4-questions-per-batch cap; the 5-call pre-checkpoint cap; descending wave counts; the three ledger statuses and the never-promote rule; the empty-answer fallback; the mandatory Assumptions section; the "Draft now" escape; the ledger-audit step, its never-override rule, and the "unaudited" banner fallback; the scope-resize rule; the ledger gitignore policy; SKILL.md line count <= 150 and frontmatter description <= 350 chars.
- `claude plugin validate .` must pass.
- A fixture ledger in `test-fixtures/` with decided/assumed/open rows, used by a contract test asserting the template maps every ledger status to its required spec section.

## 10. Versioning & release

SemVer from 0.1.0. Same four-place bump protocol as plan-runner (plugin.json, contract test pin, package.json, CHANGELOG.md). Marketplace listing in `MisterVitoPro/qa-claude-market` is a post-v0.1.0 follow-up, reusing the existing marketplace-pin workflow pattern if desired.

## 11. Future enhancements (explicitly deferred)

- Split-model economics: post-interview synthesis on a cheaper model (interview stays in the main loop; only non-interactive drafting can be delegated). Pattern proven by OpenAI Deep Research's cheap-clarifier/expensive-executor split; unclaimed in the Claude Code ecosystem.
- A `--plan-runner` output adapter emitting the spec pre-shaped for `/plan-runner:run`.
- Coverage-taxonomy audit mode: a closing check that walks `question-craft.md`'s ambiguity taxonomy and lists uncovered categories as `open` entries (Kiro-style machine-checked coverage, without spec-kit's rigidity).

## 12. Superpowers replacement path

The strategic goal is to retire superpowers from this ecosystem once spec-interview (plus the existing plan-runner and qa-swarm) covers what it actually gets used for. That reframes positioning: spec-interview is not a peaceful neighbor of `brainstorming` — it is its successor, and the design must win the same triggers brainstorming wins today.

**What this design does better than brainstorming, per the findings:**

| brainstorming (superpowers) | spec-interview |
|---|---|
| One question per turn — worst case for the 5-minute prompt cache; a slow interview re-writes full context every turn | Batched AskUserQuestion waves, hard call caps |
| Unconditional full ceremony "regardless of perceived simplicity" — the exact rigidity users abandon in spec-kit | Scope-sized depth (S/M/L) with mid-flight resize |
| State lives in the transcript; a `/clear` kills the interview | On-disk ledger; resume from the file alone |
| Assumptions invisible — unanswered questions become spec content indistinguishable from decisions | Three-status ledger + audited Assumptions section |
| Honesty by self-review only | Read-only ledger audit, never overridden |
| Skill body rides the whole session; enforcement via a heavyweight always-injected meta-skill | Lean front-loaded body, lazy references, one description in the listing budget |

**Trigger strategy (transition, then takeover):**
- *Phase 1 — coexistence (superpowers still installed):* superpowers' meta-skill mandates brainstorming for any "let's build X", so ambient invocation is unwinnable. spec-interview is honest about being command-first: `/spec-interview:run`. Its description claims the adjacent, non-colliding vocabulary — spec, requirements, elicitation, interview, resumable, token-lean — so "interview me about this idea" or "write a spec" reaches it even now.
- *Phase 2 — takeover (superpowers removed):* the description alone carries ambient triggering: "Use when the user wants to build, design, plan, or spec a feature or project" plus the phase-1 keywords, within the <= 350-char budget. No always-injected meta-skill: the findings show that pattern costs every session to enforce ceremony users resent. If ambient trigger reliability proves insufficient in practice, a minimal SessionStart hint (one sentence, plan-runner's inlined-hook pattern) is the fallback — measured against its per-session token cost, not adopted by default.

**What replacing superpowers does NOT require this plugin to do:** execution discipline (plan-runner), verification and bug-hunting (qa-swarm), and git workflow skills are already covered in this ecosystem. The one genuine gap left is `writing-plans` — and superpowers' own issue tracker (#512) shows its monolithic `plan.md` output is a ~45–60K-token liability when re-read during execution. The successor there is the deferred `--plan-runner` adapter above, emitting per-wave/per-task files shaped as `/plan-runner:run` input rather than one monolith. When that lands (target: 0.2.x), the superpowers dependency can be dropped entirely.

---

## Appendix A — Research basis

Findings from a three-agent research sweep (2026-07-08/09): interview-style elicitation tools, token/context-efficiency guidance, and the adjacent job-interview-prep space.

### A.1 Landscape: the settled convention

Every mature tool converges on: small multiple-choice question batches -> hard gate before implementation -> durable Markdown spec -> separate execution stage. spec-interview keeps this convention and does not innovate on it.

- **superpowers `brainstorming`** (the reference implementation): 9-step gated flow, one question per message, multiple-choice preferred, unconditional hard gate, dated spec doc, handoff to `writing-plans`. https://github.com/obra/superpowers
- **Harper Reed's "idea honing"** (the seed pattern): one-question-at-a-time prompt -> `spec.md` -> `prompt_plan.md` -> `todo.md`. https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/
- **AskUserQuestion-native skills**: neonwatty `feature-interview` (5–10 rounds, assumption-revealing questions, approval gate); Jekudy `grillme-skill` (Socratic waves with *descending* question counts and between-wave state summaries — the direct ancestor of this design's wave table and ledger). https://neonwatty.com/posts/interview-skills-claude-code/ · https://github.com/Jekudy/grillme-skill
- **PRD/spec-writer band** (crowded, template-driven): Requirements Elicitation ("elicit, don't invent"), Product Requirements (self-scored 90+ quality loop), prd-writer, prd-taskmaster (the only tool emitting executor-native output: interview -> graded PRD -> dependency-ordered task DAG). https://github.com/anombyte93/prd-taskmaster
- **Cross-ecosystem**: Cursor Plan Mode 2.1 (auto-fired 3–5 clarifying questions at detected ambiguity); AWS Kiro Spec Mode (EARS-notation requirements + automated-reasoning gap detection); GitHub spec-kit `/speckit.clarify` (coverage-taxonomy questioning recorded into a `## Clarifications` spec section); OpenAI Deep Research (cheap intermediate model asks clarifying questions, expensive model executes). https://cursor.com/blog/plan-mode · https://kiro.dev/docs/specs/feature-specs/ · https://github.com/github/spec-kit

### A.2 Documented pain points -> design responses

| Pain point (source) | Design response |
|---|---|
| Same heavyweight interview for a typo fix and a subsystem; users skip ceremony, eat rework (Scott Logic spec-kit review; spec-kit #2496) | Triage batch sets S/M/L depth budget (section 5) |
| Fixed question caps frustrate complex specs, walls of questions overwhelm simple ones (spec-kit #617) | Scope-scaled wave counts + "Draft now" escape, instead of one static cap |
| Unanswered questions silently baked into specs as decisions (only grillme flags verified vs. unverified) | Three-status ledger; never-promote rule; mandatory Assumptions section (section 6) |
| Interview state lives only in conversation; nothing survives `/clear` | On-disk ledger is the sole source of truth; resume reads the file, not the transcript |
| Token cost accrues in the downstream artifact, re-read 3–4x (~45–60K tokens, superpowers #512) | Spec generated from the compact ledger; sections scale to scope |
| AskUserQuestion returns empty answers inside plugin skills (claude-code #29547) | Empty-answer fallback: one prose re-ask, then `assumed` — never silent consent (section 8) |
| Generic, inflated feedback is the universal complaint in the adjacent interview-AI space | Honesty invariants ported from plan-runner (no self-verify, no fabrication) |

### A.3 Token-efficiency evidence behind the budgets

Sources: Anthropic skill-authoring best practices (platform.claude.com), the "Equipping agents for the real world" engineering post, prompt-caching/pricing docs, and community measurements (claudefa.st, madewithlove, youcanbuildthings).

| Fact | Number | Consequence in this design |
|---|---|---|
| Skill loading is 3-level: only name+description always resident; SKILL.md body loads on use and stays for the session | body budget < 500 lines official | SKILL.md capped harder, at 150 lines |
| Skill-listing budget ~1% of context (~2K tokens, ~15–25 skills) before silent truncation; per-description cap 1024/1536 chars | 200–400 chars ≈ 50–100 tokens typical | One skill per plugin; description <= 350 chars, keyword-dense |
| Compaction re-attaches only the front of each used skill | first ~5K tokens/skill, ~25K combined | Load-bearing flow front-loaded in SKILL.md |
| References nested two levels deep get partially read (`head -100`) | one level only | `references/` files linked directly from SKILL.md |
| Prompt cache TTL 5 min (write 1.25x, read 0.10x); a slow one-question-per-turn interview re-writes full context each turn | worst case for interactive flows | Batched AskUserQuestion (up to 4/call) collapses round-trips |
| Subagents re-load context fresh; measured ~4x for 3 agents, 4–7x for multi-agent flows | throughput, not savings | No subagents in the interactive loop |
| Session-start overhead is already ~20–30K tokens before the first keystroke | plugins compound it | Minimal always-resident surface: one description |

### A.4 Adjacent space (job-interview prep) — deliberately out of scope

The other reading of "interviewing plugin" is a crowded commercial space (Final Round AI, Verve, Exponent) with several single-author Claude Code skills already public (interview-mentor-skill, Claude-interview-coach-skill, pm-interview-prep). Its loudest lesson — users hate generic, score-inflated feedback — reinforces this design's honesty invariants, but the domain itself stays out of scope (section 3).

### A.5 Positioning

The elicitation-interview space has no polished, marketplace-distributed, token-conscious plugin. The field's open problems are calibration and honesty: sizing depth to scope, separating user decisions from model assumptions, resumable state, and artifact shape. spec-interview claims exactly those four; everything else follows the settled convention.
