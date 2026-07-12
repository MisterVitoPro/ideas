# ideas

A Claude Code plugin that turns a raw idea into an audited design spec through a token-conscious
interview. By MisterVitoPro.

## Install

    claude plugin marketplace add MisterVitoPro/qa-claude-market
    claude plugin install ideas@mistervitopro-plugin-marketplace

## Command

`/ideas:interview [idea]`

The interview sizes itself to the task (a triage batch picks S/M/L depth), asks batched
multiple-choice questions with recommended defaults, and records every answer in an on-disk
ledger with three statuses: `decided` (you chose), `assumed` (a labeled default you did not
confirm), and `open`. The spec is drafted from the ledger - not from conversational memory - so
the run survives /clear and resumes from the file alone. The elicitation floor is a category-coverage gate: every ambiguity-taxonomy category needs a decided row or an explicit waiver before the approach checkpoint, weighted toward the chronic blind spots (Non-functionals, Lifecycle, Interfaces). Unconfirmed items become binding defaults - low-cost ones weld into an acceptance criterion and proceed, high-cost or irreversible ones become blocking open questions instead.

Before you review the draft, two read-only agents run in parallel:
- `ideas:spec-auditor` (binding): every claim in the spec must trace to a decided ledger row or
  sit in the Assumptions/Open questions sections. Unbacked claims get demoted, not defended.
- `ideas:spec-critic` (advisory): calls out the single biggest miss in the plan with 2-3
  mitigations, shown to you verbatim at the review gate.

Output: a committed spec (`docs/specs/YYYY-MM-DD-<slug>.md`) with EARS acceptance criteria,
an Architecture & components section (component names, responsibilities, and interface
boundaries), a Verification strategy section (each criteria group tagged unit, integration, or
manual), change deltas for brownfield work, mandatory Assumptions and Open questions sections, and
optionally 1-2 MADR-lite ADRs in `docs/adr/`. The ledger itself is gitignored.

After approval, "Approve + generate plan" (or `/ideas:plan` run standalone against an approved spec
later) emits a plan-runner-ready plan: a flat task list where every task carries owned files,
interfaces, and the full text of its EARS criteria - contracts only, plan-runner's TDD agents write
the code. Unresolved assumptions carry into the plan header as flagged constraints, never dropped.
`/ideas:tickets` then projects that plan file to GitHub as agent-agnostic issues - a parent tracking
issue plus one linked sub-issue per task that clears a Definition-of-Ready gate.

Not for typos, renames, or one-line fixes - invoke it when the thing could reasonably be built
two different ways.

## How it fits with plan-runner

ideas is the pipeline's front door, not a replacement for
[plan-runner](https://github.com/MisterVitoPro/plan-runner): the interview produces the audited
spec, "Approve + generate plan" shapes it into plan-runner's input, and `/plan-runner:run`
remains the execution engine. Both install side by side from the same marketplace. A future
release is planned to migrate plan-runner's `run`/`pr` commands into this
plugin as `/ideas:execute-plan` and `/ideas:pr`; until that ships and is announced, plan-runner
stays a separate, fully supported plugin.

## Honesty invariants

- A model guess is never recorded as a user decision.
- The orchestrator cannot override the auditor.
- Failed audit or critic runs are announced ("unaudited" / "no critique available"), never hidden.

## Roadmap

- 0.2.0 (shipped): plan-runner output adapter - single structured plan file, contracts not code.
- A future release: plan-runner's run/pr migrate in as /ideas:execute-plan and /ideas:pr.
- Benchmark harness: lives in its own repo, [ideas-bench](https://github.com/MisterVitoPro/ideas-bench),
  so this plugin ships lean. Paired, blind, simulated-user comparison against
  superpowers:brainstorming (6-scenario pilot, paired statistics, pre-declared success bar);
  its results are a prerequisite for the superpowers removal decision.

## Development

Verification:

    node --test tests/contract.test.js
    claude plugin validate .
