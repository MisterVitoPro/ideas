# ADR-0006: Execution gate lives in /ideas:plan with procedures as a lazy reference

Status: accepted
Date: 2026-07-12

## Context

The pipeline needs a completion gate after /ideas:plan writes the plan file: execute with
plan-runner when installed, otherwise run inline or with subagents, or project to GitHub
tickets. The execution procedures (waved subagent dispatch, per-task inline verify+commit,
wave-boundary failure handling) are substantial prose that most runs never need - a user who
picks plan-runner or tickets should not pay their token cost.

## Options

1. All inline in skills/plan/SKILL.md - one file, but always-loaded prose roughly doubles.
2. Gate in SKILL.md, procedures in skills/plan/references/execution.md, read only when an
   execution mode is chosen.
3. New /ideas:execute command owning gate and execution - front-runs the planned plan-runner
   migration but adds a command surface and marketplace copy churn now.

## Decision

Option 2. The gate (plan-runner detection via skill-availability, one unified AskUserQuestion,
option hiding) is procedure in skills/plan/SKILL.md; execution semantics live in
skills/plan/references/execution.md, following the lazy-reference convention set by ADR-0002
and tickets' references/emission.md.

## Consequences

- Per-run token cost stays flat for users who route to plan-runner or tickets.
- The plan file format is untouched (ADR-0005 holds); chaining is skill prose only.
- When the plan-runner migration (/ideas:execute-plan) ships, execution.md is the natural seed
  for it; the gate's option list changes, not its location.
