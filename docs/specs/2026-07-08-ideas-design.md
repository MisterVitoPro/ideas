# ideas — design spec

Date: 2026-07-08
Status: awaiting user approval
Author: MisterVitoPro

## 1. Problem

Interview-style elicitation tools (superpowers:brainstorming, spec-kit `/clarify`, Kiro Spec Mode, Cursor Plan Mode) all converge on the same convention — small question batches, a hard gate before implementation, a durable Markdown spec — but share three unsolved failure modes, documented across their issue trackers and reviews:

1. **No scope calibration.** The same heavyweight interview fires for a one-line tweak and a new subsystem, so users skip the ceremony and eat the rework.
2. **Invisible assumptions.** When the user doesn't answer something, every tool silently bakes the model's guess into the spec as if the user decided it.
3. **Context bloat, no resumability.** The interview lives entirely in conversation context; nothing survives `/clear`, and long interviews thrash the prompt cache (one-question-per-turn plus a >5-minute human pause forces a full cache re-write per turn).

ideas is a Claude Code plugin that runs a token-conscious elicitation interview and fixes all three.

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

Repo: `D:\claude_plugins\ideas`. The plugin is the long-term home of the whole idea-to-PR pipeline (`/ideas:interview` -> `/ideas:execute-plan` -> `/ideas:pr`), but v0.1.0 ships exactly one skill — the interview — mirroring plan-runner's layout and test culture:

```
ideas/
  .claude-plugin/plugin.json      name: ideas, version 0.1.0
  skills/interview/SKILL.md             the interviewer (lean; target <= 150 lines)
  skills/interview/references/
    question-craft.md             wave-design guidance + ambiguity taxonomy (lazy-loaded)
    spec-template.md              output spec skeleton incl. mandatory Assumptions section
  tests/contract.test.js          pins load-bearing phrases in SKILL.md (node --test)
  bench/                          brainstorming benchmark harness (section 13; dev tooling, not plugin payload)
  README.md  CHANGELOG.md  package.json  LICENSE
```

Command surface in v0.1.0: `/ideas:interview [idea]`, and nothing else. Skill descriptions compete in a ~2K-token session-wide listing budget, so the plugin ships a single keyword-dense description (<= 350 chars, third person, states what + when) and grows to at most three skills at the end-state (`interview`, `execute-plan`, `pr` — section 12), never a grab-bag.

Token rules baked into the skill's own structure (from Anthropic's skill-authoring guidance):
- SKILL.md body <= 150 lines, load-bearing flow in the first screenful (compaction keeps only the front ~5K tokens of a skill).
- References exactly one level deep, split by concern, read only when needed. `question-craft.md` is consulted when designing waves; `spec-template.md` only at drafting time.
- No subagents anywhere in the interactive loop (4–7x token multiplier, and subagents cannot relay AskUserQuestion to the user). Two deliberate exceptions, both non-interactive, read-only, run exactly once and in parallel after the draft: the ledger audit and the biggest-miss critic (section 5) — the isolation is the point, not a cost.

Prose discipline (superpowers' measured bloat, #832: 69% of its skill lines were cuttable with no behavior loss):
- No rationalization tables, red-flag lists, multi-page examples, or redundant negative restatements in SKILL.md.
- Rules explain *why* rather than shouting all-caps MUST/NEVER — Anthropic's own authoring guidance flags rigid imperatives as making the model follow the letter and miss edge cases.
- One short "Known gotchas" section (empty-answer bug, cache TTL, ledger hand-edits) — per Anthropic, the most valuable content of a mature skill.

Description/trigger craft (Claude measurably under-triggers skills):
- The description is deliberately "pushy," third person, keyword-rich — and carries an explicit **exclusion clause**: not for typos, renames, or one-liners; fire when the thing could reasonably be built two different ways.
- Before release, the description is evaluated with ~20 should-trigger / should-not-trigger queries in messy realistic phrasing (Anthropic's `run_loop.py` method), iterated until precision and recall are both acceptable.

## 5. Interview flow

```
invoke -> resume check -> context scan -> triage batch -> waves (scope-sized)
       -> approach checkpoint [GATE 1] -> draft spec from ledger -> self-review
       -> ledger audit + biggest-miss critic (read-only, parallel)
       -> user reviews spec [GATE 2] -> done (suggest next tools)
```

**Resume check.** If a ledger matching the idea's slug exists and has `open` items or a non-`complete` status, offer: resume from ledger / start over. On resume, the ledger is the only state read — not the old transcript.

**Context scan.** Lightweight look at the target repo (README, docs/, recent commits, and `docs/adr/` if present) before asking anything, so no question wastes the user's time on facts the repo already answers. Existing ADRs are treated as already-decided ground: never re-asked; if the new idea conflicts with a standing ADR, that becomes an explicit question ("ADR-NNNN chose X — supersede it?") rather than a silent contradiction. Re-running against an already-approved spec works the same way: the old spec is context, and the new spec is expressed as change deltas against it. Read-only.

**Triage batch.** One AskUserQuestion call (up to 4 questions) establishing: scope size (S/M/L, model recommends one), who consumes the spec, hard constraints, greenfield vs. existing code. If the idea describes multiple independent subsystems, triage flags it for **decomposition** before any detail questions: the model proposes a sub-project split, the user picks the first sub-project to interview, and the rest are recorded in the ledger as `open` (future interviews) — one spec per sub-project, never one sprawling spec. Scope sets the depth budget:

| Scope | Waves after triage | Max MC questions per wave |
|-------|--------------------|---------------------------|
| S     | 1                  | 4                         |
| M     | 2                  | 4, then 3                 |
| L     | 3                  | 4, then 3, then 2         |

Descending counts are deliberate: early waves cover ground, later waves probe contradictions and blind spots. Hard cap: no more than 5 AskUserQuestion calls total before the approach checkpoint, ever.

**Waves.** Each wave is one AskUserQuestion batch of 2–4 related multiple-choice questions (each with a recommended default), plus at most one open-ended prose question per wave reserved for the genuinely fuzzy heart of the idea. Question quality rule (baked into SKILL.md verbatim, from the best-performing community interview skills): never ask obvious questions or anything the context scan already answered — ask questions that reveal hidden assumptions, expose edge cases the user hasn't considered, and uncover trade-offs they'll need to make. Every wave from the second onward includes a "Draft the spec now" escape option — choosing it ends questioning immediately and downgrades all unasked planned questions to `assumed` or `open`. After each wave the ledger file is updated; the conversation does not re-summarize answers.

**Scope resize.** Users are unreliable at self-assessing scope, so triage's S/M/L is provisional. If answers in any wave reveal the scope was miscalled (an "S" sprouting subsystems, an "L" collapsing to a config change), the model proposes resizing as the first question of the *next* wave's batch — it never spends an extra AskUserQuestion call on it, and the resize decision lands in the ledger like any other.

**Ledger audit (structural honesty).** After self-review, a read-only audit verifies the draft against the ledger with fresh eyes: every normative claim in the spec must trace to a `decided` row, or appear under Assumptions (matching an `assumed` row) or Open questions (matching an `open` row). Anything unbacked is a violation: the claim is demoted to the Assumptions section and, if material, flagged to the user at gate 2. The audit runs as a read-only subagent whose only inputs are the ledger file and the draft spec — deliberately isolated from the interview conversation so it cannot "remember" justifications that were never recorded. The orchestrating skill never overrides an audit finding (plan-runner's no-self-verify rule, ported). If the audit cannot run (subagent failure), the spec is presented with an explicit "unaudited" banner — never silently.

**Biggest-miss critic (adversarial completeness).** In parallel with the audit, a second read-only subagent (`ideas:spec-critic`) reads the draft spec plus ledger and answers exactly one question: *what is the single biggest miss in this plan* — the omission, risk, or unexamined assumption most likely to hurt once built — with 2–3 concrete mitigations. One miss, not a list: the bound is what keeps it cheap, forces prioritization, and makes it actionable (superpowers' defenders rank adversarial review as its most valuable behavior; Kiro's automated gap detection is the same instinct; a laundry list would be the "generic feedback" failure the interview-AI space is infamous for). The callout and mitigations are presented **verbatim** at gate 2 — never summarized away. The user's disposition lands in the ledger: a chosen mitigation becomes `decided`, an acknowledged-but-deferred miss becomes `open`, a dismissal is recorded as such. Unlike the audit (binding), the critic is advisory — but it can never be silently dropped; if it fails to run, gate 2 states "no critique available".

**Approach checkpoint (gate 1).** The model presents 2–3 candidate approaches with trade-offs and a recommendation in one message, and the user picks via one AskUserQuestion call. Recorded in the ledger as `decided`.

**Draft.** The spec is generated from the ledger plus `spec-template.md` — not from conversational memory. Then a self-review pass (placeholder scan, internal consistency, scope check, ambiguity check) with inline fixes.

**Spec review (gate 2).** The user is asked to review the written spec file via one AskUserQuestion: Approve / Add more / Modify / Start over — accompanied by a one-line **review receipt** from the ledger ("14 decided, 3 assumed, 2 open; audit clean") and the **biggest-miss callout** with its mitigations, so approval happens with the honesty picture and the sharpest known risk both in view. The agent never self-declares completeness — only Approve ends the run. Changes loop back to the draft step (and re-audit). On approval the run is complete; the skill suggests — but does not invoke — follow-on tools.

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

Commit policy: the **spec is committed** (and any ADRs, section 7); the **ledger is gitignored** (appended to the target repo's `.gitignore` on first write, gated on git availability — plan-runner's pattern for run artifacts). The ledger is interview exhaust: essential during elicitation and for resume, but it doesn't belong in anyone's PR. The spec's Assumptions and Open questions sections preserve the honesty information durably, so nothing auditable is lost when a ledger is cleaned up. Lifecycle: a ledger whose status reaches `complete` is kept (it's gitignored and costs nothing, and it lets a later re-interview see exactly what was decided vs. assumed) but is safe to delete at any time.

## 7. Spec output template (summary)

`spec-template.md` defines: Problem, Goals, Non-goals, Users/consumers, Requirements, Chosen approach (+ alternatives considered and why rejected), Data & interfaces, Edge cases & error handling, Acceptance criteria, **Assumptions (unconfirmed)**, **Open questions**. Sections scale to scope; S-scope specs may be under a page. The Assumptions and Open questions sections are structurally mandatory even when empty ("None").

Two format rules imported from the strongest competing spec systems:
- **Acceptance criteria use EARS notation** (the five Easy-Approach-to-Requirements-Syntax sentence patterns, e.g. "WHEN [condition] THE SYSTEM SHALL [behavior]") — each criterion is unambiguous and directly testable, which is also what makes the ledger audit's claim-tracing mechanical rather than judgmental.
- **Brownfield specs use change deltas** (OpenSpec's ADDED / MODIFIED / REMOVED framing for requirements touching existing behavior) so the spec describes the *change*, not a re-imagined system — the failure mode where spec tools hallucinate new requirements onto existing code.

The spec stays contracts-only: interfaces, file paths, acceptance criteria, constraints — never function bodies, test code, or shell commands. Over-specified plans that freeze implementation detail are superpowers' sharpest unresolved critique (#895); when execution learns something, a contract survives it, prescribed code doesn't.

**ADR emission.** When the approach checkpoint's decision is genuinely architectural (structure, storage, protocol, dependency — not naming or copy) and scope is M or L, the skill also writes at most 1–2 **MADR-lite ADRs** (~15 lines: status, context, options considered, decision, consequences) to `docs/adr/NNNN-<slug>.md`. ADRs are durable record, so they are **committed** (unlike the ledger); the spec's Chosen approach section links the ADR instead of duplicating it, and the ledger audit traces through the link. Decisions compound: the next interview's context scan reads these ADRs and skips every question they already answer — each run makes the next one cheaper. Requirements and preference decisions stay in the spec; they never become ADRs. No ADR tooling (indexes, supersede automation) in v1 — emit and read only.

## 8. Error handling

- **Empty AskUserQuestion answers** (known plugin-skill bug, claude-code #29547): an empty or missing answer is never treated as consent to the recommended option. Re-ask once as plain numbered prose questions; if still unanswered, record as `assumed`.
- **User bails mid-interview** ("just draft it", interrupt, timeout): draft immediately from whatever the ledger holds; honesty statuses make the resulting spec safe rather than silently overconfident.
- **git absent in the target repo:** all git operations (committing the spec) are gated on git availability, plan-runner style. The ledger and spec are still written; committing is skipped with a note.
- **No docs/ directory:** created on first write.
- **Ledger hand-edited between sessions:** treated as authoritative — the file is the source of truth, by design.
- **Conflicting user instructions (the silent-nullification trap):** a CLAUDE.md line like "always start coding immediately" silently defeats superpowers — users believe they installed discipline they don't have. If instructions conflict with the interview gate, the skill says so in one sentence and asks which wins, rather than silently standing down or silently overriding.
- **Native Plan Mode:** compose, don't fight (superpowers' Plan Mode conflict was closed as not-planned). The skill's on-disk spec + review gate reproduces plan mode's entire value independent of the mode; if invoked inside Plan Mode, the interview and ledger writes are the plan-mode-compatible activity, and the spec write happens after plan approval.

## 9. Testing & verification

- `tests/contract.test.js` (node --test) pins the load-bearing prose in SKILL.md, plan-runner style: the hard gate sentence; the 4-questions-per-batch cap; the 5-call pre-checkpoint cap; descending wave counts; the three ledger statuses and the never-promote rule; the empty-answer fallback; the mandatory Assumptions section; the "Draft now" escape; the ledger-audit step, its never-override rule, and the "unaudited" banner fallback; the biggest-miss critic (single-miss bound, verbatim presentation at gate 2, ledger-recorded disposition, advisory-not-binding, "no critique available" fallback); the scope-resize rule; the ledger gitignore policy; SKILL.md line count <= 150 and frontmatter description <= 350 chars.
- `claude plugin validate .` must pass.
- A fixture ledger in `test-fixtures/` with decided/assumed/open rows, used by a contract test asserting the template maps every ledger status to its required spec section.
- Contract tests additionally pin: the no-obvious-questions rule, the EARS acceptance-criteria requirement, the change-delta rule for brownfield specs, the contracts-not-code rule, the decomposition rule for multi-subsystem ideas, the ADR emission bounds (M/L scope only, architectural only, 1–2 max) and the ADR-conflict question, the review receipt at gate 2, the exclusion clause in the frontmatter description, and the absence of all-caps MUST/NEVER/ALWAYS imperatives in the SKILL.md body.
- Trigger eval before each release: ~20 should/should-not-trigger queries in realistic messy phrasing, run 3x each; the description iterates until held-out precision/recall are acceptable. Queries live in `test-fixtures/trigger-queries.md` so the eval is repeatable.

## 10. Versioning & release

SemVer from 0.1.0. Same four-place bump protocol as plan-runner (plugin.json, contract test pin, package.json, CHANGELOG.md). Marketplace listing in `MisterVitoPro/qa-claude-market` is a post-v0.1.0 follow-up, reusing the existing marketplace-pin workflow pattern if desired.

## 11. Future enhancements (explicitly deferred)

- Split-model economics: post-interview synthesis on a cheaper model (interview stays in the main loop; only non-interactive drafting can be delegated). Pattern proven by OpenAI Deep Research's cheap-clarifier/expensive-executor split; unclaimed in the Claude Code ecosystem.
- A `--plan-runner` output adapter emitting the spec pre-shaped for `/plan-runner:run`.
- Coverage-taxonomy audit mode: a closing check that walks `question-craft.md`'s ambiguity taxonomy and lists uncovered categories as `open` entries (Kiro-style machine-checked coverage, without spec-kit's rigidity). A lite version - the elicitation floor in the Waves flow - shipped in 0.2.2 after the benchmark's first live run exposed under-elicitation (ideas-bench: docs/smoke-2026-07-10-s01.md).

## 12. Superpowers replacement path

The strategic goal is to retire superpowers from this ecosystem once ideas (plus the existing plan-runner and qa-swarm) covers what it actually gets used for. That reframes positioning: ideas is not a peaceful neighbor of `brainstorming` — it is its successor, and the design must win the same triggers brainstorming wins today.

**What this design does better than brainstorming, per the findings:**

| brainstorming (superpowers) | ideas |
|---|---|
| One question per turn — worst case for the 5-minute prompt cache; a slow interview re-writes full context every turn | Batched AskUserQuestion waves, hard call caps |
| Unconditional full ceremony "regardless of perceived simplicity" — the exact rigidity users abandon in spec-kit | Scope-sized depth (S/M/L) with mid-flight resize |
| State lives in the transcript; a `/clear` kills the interview | On-disk ledger; resume from the file alone |
| Assumptions invisible — unanswered questions become spec content indistinguishable from decisions | Three-status ledger + audited Assumptions section |
| Honesty by self-review only | Read-only ledger audit, never overridden |
| Skill body rides the whole session; enforcement via a heavyweight always-injected meta-skill | Lean front-loaded body, lazy references, one description in the listing budget |

**Trigger strategy (transition, then takeover):**
- *Phase 1 — coexistence (superpowers still installed):* superpowers' meta-skill mandates brainstorming for any "let's build X", so ambient invocation is unwinnable. ideas is honest about being command-first: `/ideas:interview`. Its description claims the adjacent, non-colliding vocabulary — spec, requirements, elicitation, interview, resumable, token-lean — so "interview me about this idea" or "write a spec" reaches it even now.
- *Phase 2 — takeover (superpowers removed):* the description alone carries ambient triggering: "Use when the user wants to build, design, plan, or spec a feature or project" plus the phase-1 keywords, within the <= 350-char budget. No always-injected meta-skill: the findings show that pattern costs every session to enforce ceremony users resent. If ambient trigger reliability proves insufficient in practice, a minimal SessionStart hint (one sentence, plan-runner's inlined-hook pattern) is the fallback — measured against its per-session token cost, not adopted by default.

**What replacing superpowers does NOT require this plugin to do:** execution discipline (plan-runner), verification and bug-hunting (qa-swarm), and git workflow skills are already covered in this ecosystem. The one genuine gap left is `writing-plans` — and superpowers' own issue tracker shows its two deepest unresolved critiques live exactly there: monolithic `plan.md` files re-read 3–4x for ~45–60K tokens (#512), and plans that embed full function bodies, test files, and shell commands which become *wrong* the moment execution learns something (#895). The successor is the deferred `--plan-runner` adapter above, emitting per-wave/per-task files (execution reads ~2.5K per task, not the whole monolith) that carry interface contracts and EARS acceptance criteria — never implementation code. When that lands (target: 0.2.x), the superpowers dependency can be dropped entirely. The adapter is also the dogfood milestone: it gets specced by running `/ideas:interview` on itself — the plugin's first real trial as its own customer.

**Skill-migration roadmap (the `ideas` end-state):** the plugin's command surface converges on the full pipeline under one name — `/ideas:interview` -> `/ideas:execute-plan` -> `/ideas:pr`. v0.1.0 ships `interview` only. After the benchmark passes and the plan-runner adapter lands (0.2.x), plan-runner's `run` and `pr` skills migrate into this repo as `ideas:execute-plan` and `ideas:pr` (a later minor, ~0.3.x), carrying their tests, schemas, and invariants with them; plan-runner is then deprecated with a pointer, and the marketplace entry swaps over. Until that migration, plan-runner stays untouched at its own release cadence — ideas must prove itself before absorbing a working v1.10.0 plugin.

**The removal decision is gated on evidence, not vibes:** phase 2 (uninstalling superpowers) happens only after the benchmark in section 13 shows ideas matching or beating brainstorming on spec quality and downstream success at materially lower cost. The critique research is encouraging — superpowers' maintainer concedes the cost problem ("tokens are expensive and Superpowers uses a ton of them"; v6 cut token spend 60%), independent measurement puts its full loop at ~3x bare Claude Code and *net-negative on simple tasks*, and the community verdict is "the methodology survives, the monolith doesn't" — but encouraging research is not a measurement of *this* plugin.

## 13. Measurement — the brainstorming benchmark

"Better than superpowers" must be a number before it's a claim. The repo ships `bench/` (dev tooling, not plugin payload): a paired, blind, simulated-user benchmark comparing `/ideas:interview` against `superpowers:brainstorming` head-to-head. The design follows the elicitation-eval literature (UserBench, ClarQ-LLM, tau-bench) and Anthropic's eval guidance.

**Scenarios (N = 15–20, paired).** Each scenario is a hidden requirements document: a realistic brief (CLI feature, schema migration, UI component, auth flow, data pipeline — drawn from real work in this ecosystem's repos) with 8–12 planted facts tagged critical vs. nice-to-have, 3–4 seeded ambiguities, and 1–2 latent constraints revealed only if asked. Each scenario also carries a held-out acceptance checklist written from the hidden doc.

**Simulated user.** A fixed, pinned model prompted with the persona plus the hidden doc, under a tight protocol: answer only what is asked; reveal a planted fact only when a question actually targets it; never volunteer critical constraints; never rescue a wrap-up that missed one. Grounding to the doc contains the known sim-user failure modes (over-compliance, drift). Results are reported as a *relative* comparison of elicitation skill between the two workflows — not a claim about human usability — and 2–3 scenarios are validated with a real human user.

**Procedure.** scenario x {ideas, brainstorming} x 3 runs, headless, same orchestrator model+version pinned for both sides, transcripts and final specs captured.

**Metrics (pre-declared, all reported — including where brainstorming wins):**
- *Tier A — cost/burden (deterministic from transcripts):* output tokens per completed spec (primary cost metric — robust to prompt-cache noise), question count, turn count, simulated-user burden tokens, query discrepancy (questions asked vs. minimum needed).
- *Tier B — elicitation vs. ground truth:* **Active Elicited %** (planted facts surfaced because the workflow asked — the headline interview-skill metric), information gain per question, critical-fact coverage (weighted), and assumption honesty: facts the spec silently assumed vs. explicitly flagged. Tier B is where the ledger design should show up or be shown up.
- *Tier C — spec quality (LLM judge):* completeness, unambiguity, testability, consistency, assumption honesty; each scored 1–5 in a separate judge call with anchored rubric levels, sources masked and headers normalized, order swapped and averaged, judge at temperature 0 and from a different model family than the generators.
- *Tier D — downstream outcome (subset of 6–8 scenarios):* the same fixed executor implements from each spec with no access to the hidden doc; the held-out acceptance suite decides. **Pass rate is the primary metric of the whole benchmark.**

**Analysis.** Per-scenario means across the 3 runs, then paired statistics: t-test or Wilcoxon signed-rank for tiers A–C, McNemar/exact binomial for tier D wins; minimum detectable effect reported at the chosen N so "no difference" is an honest statement.

**Judge calibration gate.** Before trusting the judge: hand-label ~12 spec pairs; the judge must agree with the human labels >= 75% or the rubric gets fixed (never the scores).

**Pre-declared success bar (the phase-2 gate from section 12):** ideas must match or beat brainstorming on tier D pass rate and the tier C composite, while spending at least 30% fewer output tokens per spec and imposing lower user burden. If it misses, the spec's claims are revised — never the numbers. (The plan-runner honesty invariants apply to our own benchmark first.)

**Timing.** The harness lands in 0.1.x alongside the plugin; results are a prerequisite for the superpowers removal decision, not a post-hoc justification of it. Bench prerequisite: a pinned superpowers version installed for the comparison runs (recorded in the results alongside the pinned model IDs), so the numbers name exactly what they beat.

## 14. Acceptance criteria (v0.1.0, EARS)

This spec eats its own dog food — the criteria writing-plans must satisfy, in the notation section 7 mandates:

1. WHEN `/ideas:interview` is invoked with an idea in a repo containing no matching ledger, THE SKILL SHALL complete triage in exactly one AskUserQuestion call.
2. WHEN triage sets scope S, M, or L, THE SKILL SHALL ask no more than 1, 2, or 3 post-triage waves respectively, and SHALL make no more than 5 AskUserQuestion calls before the approach checkpoint.
3. WHEN a wave answer is empty, skipped, or timed out, THE SKILL SHALL re-ask once in prose, and IF still unanswered SHALL record the item as `assumed` or `open` — never as `decided`.
4. WHEN the spec is drafted, THE SKILL SHALL generate it from the ledger file and the template, and every `assumed` and `open` ledger row SHALL appear in the spec's Assumptions or Open questions section.
5. WHEN the draft is complete, THE SKILL SHALL run the read-only ledger audit before gate 2, and IF the audit cannot run THE SKILL SHALL present the spec with an explicit "unaudited" banner.
6. WHEN the audit flags a claim with no `decided` backing, THE SKILL SHALL demote the claim to Assumptions and SHALL NOT override the finding.
7. WHEN gate 2 is presented, THE SKILL SHALL include the review receipt (decided/assumed/open counts and audit status), and THE SKILL SHALL end the run only on explicit Approve.
8. WHEN a matching in-progress ledger exists at invocation, THE SKILL SHALL offer resume, and on resume SHALL read interview state only from the ledger.
9. WHEN git is available, THE SKILL SHALL commit the spec (and any ADRs) and SHALL gitignore the ledger; WHEN git is unavailable, THE SKILL SHALL write all artifacts and skip git operations with a note.
10. WHEN the approach decision is architectural and scope is M or L, THE SKILL SHALL write at most 2 MADR-lite ADRs to `docs/adr/`; WHEN existing ADRs conflict with the idea, THE SKILL SHALL raise the conflict as a question before proceeding.
11. WHEN the idea spans multiple independent subsystems, THE SKILL SHALL propose decomposition at triage and interview exactly one sub-project.
12. WHEN the draft is complete, THE SKILL SHALL dispatch the biggest-miss critic alongside the audit, SHALL present its single callout and mitigations verbatim at gate 2, and SHALL record the user's disposition in the ledger; IF the critic cannot run THE SKILL SHALL state "no critique available" at gate 2.
13. THE PLUGIN SHALL pass `node --test tests/contract.test.js` and `claude plugin validate .`, with SKILL.md <= 150 lines and its description <= 350 characters including an exclusion clause.

---

## Appendix A — Research basis

Findings from a three-agent research sweep (2026-07-08/09): interview-style elicitation tools, token/context-efficiency guidance, and the adjacent job-interview-prep space.

### A.1 Landscape: the settled convention

Every mature tool converges on: small multiple-choice question batches -> hard gate before implementation -> durable Markdown spec -> separate execution stage. ideas keeps this convention and does not innovate on it.

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
| Skill-listing budget ~1% of context (~2K tokens, ~15–25 skills) before silent truncation; per-description cap 1024/1536 chars | 200–400 chars ≈ 50–100 tokens typical | One skill in v0.1.0, max three at end-state; descriptions <= 350 chars, keyword-dense |
| Compaction re-attaches only the front of each used skill | first ~5K tokens/skill, ~25K combined | Load-bearing flow front-loaded in SKILL.md |
| References nested two levels deep get partially read (`head -100`) | one level only | `references/` files linked directly from SKILL.md |
| Prompt cache TTL 5 min (write 1.25x, read 0.10x); a slow one-question-per-turn interview re-writes full context each turn | worst case for interactive flows | Batched AskUserQuestion (up to 4/call) collapses round-trips |
| Subagents re-load context fresh; measured ~4x for 3 agents, 4–7x for multi-agent flows | throughput, not savings | No subagents in the interactive loop |
| Session-start overhead is already ~20–30K tokens before the first keystroke | plugins compound it | Minimal always-resident surface: one description |

### A.4 Adjacent space (job-interview prep) — deliberately out of scope

The other reading of "interviewing plugin" is a crowded commercial space (Final Round AI, Verve, Exponent) with several single-author Claude Code skills already public (interview-mentor-skill, Claude-interview-coach-skill, pm-interview-prep). Its loudest lesson — users hate generic, score-inflated feedback — reinforces this design's honesty invariants, but the domain itself stays out of scope (section 3).

### A.5 Positioning

The elicitation-interview space has no polished, marketplace-distributed, token-conscious plugin. The field's open problems are calibration and honesty: sizing depth to scope, separating user decisions from model assumptions, resumable state, and artifact shape. ideas claims exactly those four; everything else follows the settled convention.

### A.6 Round-2 research: superpowers critique, alternatives, and eval methodology (2026-07-09)

A second three-agent sweep informing sections 4, 5, 7, 8, 12, and 13.

**Superpowers criticism catalog.** The #1 complaint is token cost, conceded by the maintainer (v6 blog: "tokens are expensive and Superpowers uses a ton of them"; v6 cut runtime 50%/tokens 60%). Measured: ~22K tokens of skills preloaded at startup, 15.7x over true progressive disclosure (#190); 69% of skill prose cuttable with no behavior loss — rationalization tables, red-flag lists, long examples (#832); monolithic plans re-read for 45–60K tokens (#512, unanswered); plans embedding full implementation code (#895, unanswered); native Plan Mode conflict closed as not-planned (#1667); CLAUDE.md lines silently nullifying the framework; the forced meta-skill experienced as hijacking — a bootstrap the maintainer himself was "low-key excited" to abandon. Defenders' must-preserve list: the intent-before-code gate, scope-check-then-decompose, adversarial review, deliberate one-at-a-time questioning. Verdict quote: "The methodology survives. The monolith doesn't." https://github.com/obra/superpowers/issues/190 · /832 · /512 · /895 · /1667 · https://blog.fsck.com/2026/06/15/Superpowers-6/

**What works instead.** Instruction-following budget is real (~150–200 instructions; non-linear degradation; adherence visibly drops past ~150 lines) — the empirical basis for this design's prose discipline. Enforcement belongs in tooling (hooks/linters/tests), not prose. The highest signal-to-overhead technique in the field is exactly interview -> spec-on-disk + review gate (reproducing native plan mode's entire value, per Ronacher's teardown of what plan mode actually is). Transferable format ideas adopted in section 7: EARS acceptance criteria (Kiro) and change deltas (OpenSpec). Trigger craft: pushy descriptions with exclusion clauses, evaluated with should/should-not query suites (Anthropic skill-creator method). Head-to-head economics: full superpowers SDLC ~3x bare Claude Code tokens, net-negative on simple tasks; AI-Workflow-Benchmark's "Workflow Lift" shows structure helps hard tasks (+12 bug diagnosis) while hurting cost discipline — a workflow earns its keep only if it caps its own overhead. https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/ · https://nizar.se/lean-claude-code-for-production/ · https://chenguangliang.com/en/posts/claude-code-workflow-plugins-comparison/ · https://github.com/xmpuspus/ai-workflow-benchmark · https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md

**Eval methodology.** Section 13's design descends from: UserBench (hidden-preference simulated users; Active Elicited %; top models surface <30% of preferences by asking — real headroom), ClarQ-LLM (success rate + query discrepancy), tau-bench (simulated-user loop architecture), judge-bias literature (position/verbosity/self-preference biases and their mitigations: order-swap-and-average, length instructions, masked sources, cross-family judges), Anthropic's eval guidance (20–50 tasks suffice at hobbyist scale; paired designs; calibrate judge to >= 75% human agreement), and the "Lost in Simulation" caveat that sim-user results are relative, not absolute. https://arxiv.org/html/2507.22034v1 · https://arxiv.org/abs/2409.06097 · https://arxiv.org/pdf/2506.07982 · https://arxiv.org/pdf/2601.17087 · https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents · https://arxiv.org/html/2406.07791v5
