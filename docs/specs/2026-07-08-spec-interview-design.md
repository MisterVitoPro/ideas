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

## 3. Non-goals

- No implementation, planning, or code generation. The terminal state is an approved spec plus a pointer at possible next tools (plan-runner, superpowers:writing-plans). It invokes neither.
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
- No subagents anywhere in the interactive loop (4–7x token multiplier, and subagents cannot relay AskUserQuestion to the user).

## 5. Interview flow

```
invoke -> resume check -> context scan -> triage batch -> waves (scope-sized)
       -> approach checkpoint [GATE 1] -> draft spec from ledger -> self-review
       -> user reviews spec [GATE 2] -> done (suggest next tools)
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
- The drafted spec must carry every `assumed` entry in a mandatory **Assumptions (unconfirmed)** section and every `open` entry under **Open questions**. A spec with an empty Assumptions section when the ledger has assumed rows is a bug.

## 7. Spec output template (summary)

`spec-template.md` defines: Problem, Goals, Non-goals, Users/consumers, Requirements, Chosen approach (+ alternatives considered and why rejected), Data & interfaces, Edge cases & error handling, Acceptance criteria, **Assumptions (unconfirmed)**, **Open questions**. Sections scale to scope; S-scope specs may be under a page. The Assumptions and Open questions sections are structurally mandatory even when empty ("None").

## 8. Error handling

- **Empty AskUserQuestion answers** (known plugin-skill bug, claude-code #29547): an empty or missing answer is never treated as consent to the recommended option. Re-ask once as plain numbered prose questions; if still unanswered, record as `assumed`.
- **User bails mid-interview** ("just draft it", interrupt, timeout): draft immediately from whatever the ledger holds; honesty statuses make the resulting spec safe rather than silently overconfident.
- **git absent in the target repo:** all git operations (committing the spec) are gated on git availability, plan-runner style. The ledger and spec are still written; committing is skipped with a note.
- **No docs/ directory:** created on first write.
- **Ledger hand-edited between sessions:** treated as authoritative — the file is the source of truth, by design.

## 9. Testing & verification

- `tests/contract.test.js` (node --test) pins the load-bearing prose in SKILL.md, plan-runner style: the hard gate sentence; the 4-questions-per-batch cap; the 5-call pre-checkpoint cap; descending wave counts; the three ledger statuses and the never-promote rule; the empty-answer fallback; the mandatory Assumptions section; the "Draft now" escape; SKILL.md line count <= 150 and frontmatter description <= 350 chars.
- `claude plugin validate .` must pass.
- A fixture ledger in `test-fixtures/` with decided/assumed/open rows, used by a contract test asserting the template maps every ledger status to its required spec section.

## 10. Versioning & release

SemVer from 0.1.0. Same four-place bump protocol as plan-runner (plugin.json, contract test pin, package.json, CHANGELOG.md). Marketplace listing in `MisterVitoPro/qa-claude-market` is a post-v0.1.0 follow-up, reusing the existing marketplace-pin workflow pattern if desired.

## 11. Future enhancements (explicitly deferred)

- Split-model economics: post-interview synthesis on a cheaper model (interview stays in the main loop; only non-interactive drafting can be delegated).
- A `--plan-runner` output adapter emitting the spec pre-shaped for `/plan-runner:run`.
- Coverage-taxonomy audit mode: a closing check that walks `question-craft.md`'s ambiguity taxonomy and lists uncovered categories as `open` entries.
