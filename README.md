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
the run survives /clear and resumes from the file alone. An elicitation floor sweeps the ambiguity
taxonomy before drafting - the interview spends its remaining question budget on unprobed critical
ground rather than closing early.

Before you review the draft, two read-only agents run in parallel:
- `ideas:spec-auditor` (binding): every claim in the spec must trace to a decided ledger row or
  sit in the Assumptions/Open questions sections. Unbacked claims get demoted, not defended.
- `ideas:spec-critic` (advisory): calls out the single biggest miss in the plan with 2-3
  mitigations, shown to you verbatim at the review gate.

Output: a committed spec (`docs/specs/YYYY-MM-DD-<slug>.md`) with EARS acceptance criteria,
change deltas for brownfield work, mandatory Assumptions and Open questions sections, and
optionally 1-2 MADR-lite ADRs in `docs/adr/`. The ledger itself is gitignored.

After approval, "Approve + generate plan" (or `/ideas:interview --plan-runner <spec-path>` later)
emits a plan-runner-ready plan: a flat task list where every task carries owned files, interfaces,
and the full text of its EARS criteria - contracts only, plan-runner's TDD agents write the code.
Unresolved assumptions carry into the plan header as flagged constraints, never dropped.

Not for typos, renames, or one-line fixes - invoke it when the thing could reasonably be built
two different ways.

## Honesty invariants

- A model guess is never recorded as a user decision.
- The orchestrator cannot override the auditor.
- Failed audit or critic runs are announced ("unaudited" / "no critique available"), never hidden.

## Roadmap

- 0.2.0 (shipped): plan-runner output adapter - single structured plan file, contracts not code.
- 0.3.x: plan-runner's run/pr migrate in as /ideas:execute-plan and /ideas:pr.
- Benchmark harness: lives in its own repo, [ideas-bench](https://github.com/MisterVitoPro/ideas-bench),
  so this plugin ships lean. Paired, blind, simulated-user comparison against
  superpowers:brainstorming (6-scenario pilot, paired statistics, pre-declared success bar);
  its results are a prerequisite for the superpowers removal decision.

## Development

Design spec: `docs/specs/2026-07-08-ideas-design.md`. Verification:

    node --test tests/contract.test.js
    claude plugin validate .
