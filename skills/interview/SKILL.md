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

A "structured question call" means the host's batched user-input tool: `AskUserQuestion` in
Claude Code or `request_user_input` in Codex when available. If the host has no structured
question tool, ask the same numbered options in concise prose and wait for the answer.

## Resume check
If a `docs/specs/*-<slug>.ledger.md` exists with status other than `complete`, offer: resume or
start over. On resume, read interview state only from the ledger, not from any prior transcript.

## Context scan (read-only)
Read the repo's README, docs/, recent commits, and `docs/adr/` if present, before asking anything.
Existing ADRs are settled ground - do not re-ask them; if the idea conflicts with one, ask
explicitly ("ADR-NNNN chose X - supersede it?"). When re-running against an approved spec, treat
the old spec as context and express the new one as change deltas. If repository instructions
(for example `CLAUDE.md` or `AGENTS.md`) or in-chat instructions conflict with interviewing first,
say so in one sentence and ask which wins - silent
stand-down and silent override both betray the user.
For brownfield work, establish the existing-system baseline first - language/runtime, current behavior, already-integrated services, and existing data pulled from the repo itself - and confirm inferences instead of re-asking known facts; the skill cannot draft while the baseline is unknown, so greenfield is a claim the user confirms, not a default the model assumes.

## Triage (one structured question call, up to 4 questions)
Establish: scope (S/M/L - recommend one), who consumes the spec, hard constraints, greenfield vs
existing code. If the idea spans multiple independent subsystems, propose a decomposition split
first and interview exactly one sub-project; record the others as `open`. Scope sets the wave
budget - max multiple-choice questions per wave:

| Scope | Waves | Questions per wave |
|-------|-------|--------------------|
| S     | 1     | 4                  |
| M     | 2     | 4, then 3          |
| L     | 3     | 4, then 3, then 2  |

Hard cap: at most 5 structured question calls before the approach checkpoint.

## Waves
Each wave is one structured question batch of 2-4 related multiple-choice questions (each with a
recommended default) plus at most one open-ended question for the genuinely fuzzy core of the
idea. Do not ask obvious questions or anything the context scan already answered - ask questions
that reveal hidden assumptions, expose edge cases the user has not considered, and uncover
trade-offs they will need to make. From wave 2 onward include a "Draft the spec now" escape
option; choosing it ends questioning and downgrades unasked items to `assumed` or `open`.
Scope resize: if answers show the scope was miscalled, propose resizing as the first question of the next wave - it costs no extra call.
After each wave, append the new rows to the ledger with a targeted edit anchored on the section
heading - whole-file rewrites were measured as the interview's dominant token cost. Do not
re-summarize answers in conversation (the file is the state), and keep wave prose lean: the
questions themselves, one line of context each.
Every concrete requirement stated in the user's idea lands in the ledger and spec, satisfied or explicitly cut with user confirmation - never silently dropped.

## Elicitation floor
Before the approach checkpoint, every category in the ambiguity taxonomy (`references/question-craft.md`) needs at least one `decided` row or an explicit waiver - flagging a gap is not a substitute for asking about it.
Gap waves buy breadth, never depth: sweep the empty categories before spending a second gap wave deepening one already touched; Non-functionals, Lifecycle, and Interfaces are the chronic blind spots, so weight gap waves toward them first.
Spend up to two extra gap waves on the sharpest gaps (batched as usual, still within the 5-call cap); only when the cap is exhausted or the user chose "Draft the spec now" may a remaining gap become `assumed`, `open`, or an explicit waiver.
The review receipt at gate 2 always states the outcome - "Not probed: Lifecycle, Interfaces" naming every category left unprobed, or "all categories probed" when none remain.

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
An assumed row that touches a stated hard constraint (compliance, downtime, deadline, platform floor) is never self-adjudicated - it goes back to the user at the next gate instead of the spec resolving it alone.

## Approach checkpoint
Present 2-3 candidate approaches with trade-offs and a recommendation in one message; the user
picks via one structured question call; record it as `decided`. If the decision is architectural
(structure, storage, protocol, dependency) and scope is M or L, also write at most 2 MADR-lite ADRs
(status, context, options, decision, consequences) to `docs/adr/NNNN-<slug>.md`. ADRs are committed;
the spec links them instead of duplicating them.
Before recording it as `decided`, enumerate the chosen approach's components - names and one-line responsibilities - so the row backs the spec's Architecture & components section.

## Draft
Generate the spec from the ledger plus `references/spec-template.md` - not from conversational
memory. Consult `references/question-craft.md` when planning waves, not at draft time. Then
self-review inline for placeholders, contradictions, scope, and ambiguity.

## Audit + critic (parallel, read-only, non-interactive)
Read `../../agents/spec-auditor.md` and `../../agents/spec-critic.md` relative to this skill, then
embed each definition in a subagent prompt that receives only the ledger and draft paths. Launch
both subagents in parallel when the runtime supports it; otherwise perform the same two read-only
reviews sequentially before continuing:
- `ideas:spec-auditor` - binding. Every normative claim must trace to a `decided` row or sit in
  Assumptions/Open questions. Demote unbacked claims to Assumptions; do not override an audit finding.
  If the audit cannot run, present the spec with an explicit "unaudited" banner.
- `ideas:spec-critic` - advisory. Returns the single biggest miss plus 2-3 mitigations.

## Review gate
One structured question call: Approve + generate plan (recommended) / Approve / Add more / Modify / Start over - accompanied by the review receipt
("N decided, N assumed, N open; audit clean|unaudited") and the critic's biggest miss and mitigations
presented verbatim; the full rationale stays in the ledger, not the chat surface (if the critic failed,
state "no critique available"). The receipt's digest shows the spec's Goals bullets and numbered requirement titles, capped at 12 lines total, appending "+N more in the file" on overflow.
Auditor violations classified `feature` are presented in this same call as "unrequested - confirm or remove"; the disposition is recorded in the ledger. When more than 3 features are flagged, show the first 3 here and resolve the remainder in exactly one follow-up structured question call.
Record the critic disposition in the ledger:
chosen mitigation -> `decided`; deferred -> `open`; dismissed -> noted. Only the two Approve options end the run;
any other choice loops back to Draft and re-audit. On approval: commit the spec and ADRs (git-gated -
when git is absent, write files and note that committing was skipped), set the ledger status to `complete`,
and suggest next tools without invoking them (for example the plan-runner run skill). "Approve +
generate plan" completes approval identically, then runs the Ideas plan skill in the same session.
Present the receipt and the callout, not the spec body - the file is the deliverable, and echoing
it in conversation doubles its cost.

## Known gotchas
- Structured question tools can return empty answers inside plugin skills; treat empty as unanswered, not
  as consent to the recommended option.
- The prompt cache expires after ~5 idle minutes; batched waves keep re-writes rare.
- docs/ may not exist in the target repo - create it on first write.
- Native Plan Mode: interviewing and ledger writes are the plan-compatible activity; write the
  spec after plan approval.
