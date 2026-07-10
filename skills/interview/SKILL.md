---
name: interview
description: Interviews the user to turn a raw idea into a committed design spec with EARS acceptance criteria. Use when an idea, feature, or project needs requirements gathered, a spec written, or design decisions made - whenever it could reasonably be built two different ways. Not for typos, renames, or one-line fixes.
---

# ideas:interview - from raw idea to audited design spec

Interview the user, record every answer in an on-disk ledger, and draft a spec from that ledger.
The run ends at an approved spec: do not write implementation code, scaffold projects, or invoke
implementation tools from this skill - suggest next tools without invoking them.

Flow: resume check -> context scan -> triage -> waves -> approach checkpoint -> draft
-> audit + critic (parallel) -> review gate.

With `--plan-runner <spec-path>`, skip the interview and run the plan adapter in
`references/plan-adapter.md` against an existing approved spec - the spec alone suffices.

## Resume check
If a `docs/specs/*-<slug>.ledger.md` exists with status other than `complete`, offer: resume or
start over. On resume, read interview state only from the ledger, not from any prior transcript.

## Context scan (read-only)
Read the repo's README, docs/, recent commits, and `docs/adr/` if present, before asking anything.
Existing ADRs are settled ground - do not re-ask them; if the idea conflicts with one, ask
explicitly ("ADR-NNNN chose X - supersede it?"). When re-running against an approved spec, treat
the old spec as context and express the new one as change deltas. If user instructions (CLAUDE.md
or in-chat) conflict with interviewing first, say so in one sentence and ask which wins - silent
stand-down and silent override both betray the user.

## Triage (one AskUserQuestion call, up to 4 questions)
Establish: scope (S/M/L - recommend one), who consumes the spec, hard constraints, greenfield vs
existing code. If the idea spans multiple independent subsystems, propose a decomposition split
first and interview exactly one sub-project; record the others as `open`. Scope sets the wave
budget - max multiple-choice questions per wave:

| Scope | Waves | Questions per wave |
|-------|-------|--------------------|
| S     | 1     | 4                  |
| M     | 2     | 4, then 3          |
| L     | 3     | 4, then 3, then 2  |

Hard cap: at most 5 AskUserQuestion calls before the approach checkpoint.

## Waves
Each wave is one AskUserQuestion batch of 2-4 related multiple-choice questions (each with a
recommended default) plus at most one open-ended question for the genuinely fuzzy core of the
idea. Do not ask obvious questions or anything the context scan already answered - ask questions
that reveal hidden assumptions, expose edge cases the user has not considered, and uncover
trade-offs they will need to make. From wave 2 onward include a "Draft the spec now" escape
option; choosing it ends questioning and downgrades unasked items to `assumed` or `open`.
Scope resize: if answers show the scope was miscalled, propose resizing as the first question of the next wave - it costs no extra call.
After each wave update the ledger file; do not re-summarize answers in conversation (the file is the state).

## Ledger (the source of truth)
Path: `docs/specs/YYYY-MM-DD-<slug>.ledger.md`, beside the future spec. Fixed headings:

    # Interview Ledger: <topic>
    slug / started / scope / status: in-progress | drafting | awaiting-review | complete
    ## Decided
    ## Assumed (unconfirmed)
    ## Open

An entry is `decided` only when the user actually selected or typed the answer. Empty, skipped,
or timed-out answers: re-ask once as plain numbered prose; if still unanswered, record `assumed`
(with a labeled default) or `open` - a model guess is not promoted to `decided`, because the spec
must distinguish what the user chose from what the model filled in. On first write,
append the ledger file to the target repo's .gitignore (git-gated); a hand-edited ledger is authoritative.

## Approach checkpoint
Present 2-3 candidate approaches with trade-offs and a recommendation in one message; the user
picks via one AskUserQuestion call; record it as `decided`. If the decision is architectural
(structure, storage, protocol, dependency) and scope is M or L, also write at most 2 MADR-lite ADRs
(status, context, options, decision, consequences) to `docs/adr/NNNN-<slug>.md`. ADRs are committed;
the spec links them instead of duplicating them.

## Draft
Generate the spec from the ledger plus `references/spec-template.md` - not from conversational
memory. Consult `references/question-craft.md` when planning waves, not at draft time. Then
self-review inline for placeholders, contradictions, scope, and ambiguity.

## Audit + critic (parallel, read-only, non-interactive)
Dispatch both registered agents at once, passing only the ledger and draft paths:
- `ideas:spec-auditor` - binding. Every normative claim must trace to a `decided` row or sit in
  Assumptions/Open questions. Demote unbacked claims to Assumptions; do not override an audit finding.
  If the audit cannot run, present the spec with an explicit "unaudited" banner.
- `ideas:spec-critic` - advisory. Returns the single biggest miss plus 2-3 mitigations.

## Review gate
One AskUserQuestion: Approve / Approve + generate plan / Add more / Modify / Start over - accompanied by the review receipt
("N decided, N assumed, N open; audit clean|unaudited") and the critic's callout presented verbatim
(if the critic failed, state "no critique available"). Record the critic disposition in the ledger:
chosen mitigation -> `decided`; deferred -> `open`; dismissed -> noted. Only Approve ends the run;
any other choice loops back to Draft and re-audit. On approval: commit the spec and ADRs (git-gated -
when git is absent, write files and note that committing was skipped), set the ledger status to `complete`,
and suggest next tools without invoking them (e.g. /plan-runner:run). "Approve + generate plan"
completes approval identically, then runs the plan adapter (`references/plan-adapter.md`) in the same session.

## Known gotchas
- AskUserQuestion can return empty answers inside plugin skills; treat empty as unanswered, not
  as consent to the recommended option.
- The prompt cache expires after ~5 idle minutes; batched waves keep re-writes rare.
- docs/ may not exist in the target repo - create it on first write.
- Native Plan Mode: interviewing and ledger writes are the plan-compatible activity; write the
  spec after plan approval.
