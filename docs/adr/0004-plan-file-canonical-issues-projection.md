# ADR-0004: Plan file canonical; GitHub issues are a one-way idempotent projection

Status: accepted (2026-07-12)

## Context
The plan stage gains a second execution backend: tasks recorded as GitHub issues for
outside agents (Claude GitHub Action, Copilot coding agent, humans) to pull and work.
Two artifacts describing the same tasks invite drift, and research on existing tools
flags two-way sync as the dominant source of state corruption in plan/tracker hybrids.

## Options
1. Plan file canonical; issues are a one-way projection.
2. Issues become canonical once the GitHub backend is chosen; plan file secondary.
3. Two-way sync between plan file and issues.

## Decision
Option 1. The committed plan file (docs/plans/) is always generated and always the
source of truth. /ideas:tickets projects it to GitHub as one parent tracking issue
plus one sub-issue per task; emission is an idempotent upsert keyed on a hidden
task-ID marker in each issue body, so re-runs create missing issues and update
changed ones without duplicating. v1 is write-only: no status read-back.

## Consequences
- No sync machinery, no drift reconciliation, no conflict UI.
- Progress tracking after emission lives entirely on GitHub in v1.
- Partial emission failures are recoverable by re-running the projection.
- A future status read-back feature must treat GitHub state as advisory, never
  authoritative, or this decision is superseded.
