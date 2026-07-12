# Spec template

Sections scale to scope: an S-scope spec may be under a page; write "None" rather than deleting a mandatory section.
Specs are contracts: interfaces, file paths, acceptance criteria, constraints - not function bodies, test code, or shell commands.
When execution learns something, a contract survives it; prescribed code does not.

## <Title> - design spec
Date / Status / Author

## Problem
What hurts today, in the user's terms. One paragraph.

## Existing system
Language/runtime, current behavior, already-integrated services, and existing data relevant to
this change, pulled from the repo. The only allowed empty value is "greenfield - confirmed by user".

## Goals
Bulleted, verifiable outcomes drawn from `decided` ledger rows.

## Non-goals
Explicit exclusions the user chose, each traceable to the ledger. Every nice-to-have is paired
against the critical constraints in a constraint-conflict check, with the resolution documented inline.

## Users / consumers
Who or what consumes the result (people, pipelines, downstream tools).

## Requirements
Numbered. Each requirement cites its ledger row number in parentheses. For changes to existing
behavior, express requirements as change deltas - ADDED / MODIFIED / REMOVED against the current
system - so the spec describes the change, not a re-imagined system.

## Chosen approach
The approach the user picked at the checkpoint, alternatives considered and why they lost.
If an ADR was written, link `docs/adr/NNNN-<slug>.md` here instead of duplicating it.

## Data & interfaces
Names, shapes, and boundaries only (signatures, file paths, formats).

## Edge cases & error handling
Each edge case paired with its decided-or-assumed handling.

## Acceptance criteria (EARS)
Each criterion uses an EARS pattern and is directly testable, e.g.:
- WHEN <trigger> THE SYSTEM SHALL <behavior>
- WHILE <state> THE SYSTEM SHALL <behavior>
- IF <undesired condition> THEN THE SYSTEM SHALL <response>

## Assumptions (unconfirmed)
Every `assumed` ledger row appears here as one of two tiers. Low-cost, reversible unknowns become
a Binding default: a concrete value the builder uses, welded into a matching EARS criterion so it
is checked like any other requirement. High-cost or irreversible unknowns - weighed by reversal
cost - are never defaulted; they move to Open questions as blocking instead. This section and Open
questions are structurally mandatory even when empty ("None").

## Open questions
Every `open` ledger row appears here with why it matters, including any binding default that was
too high-cost or irreversible to default and was escalated here instead.

## Definition of done
- Tests written and passing.
- Existing behavior preserved outside the described change.
- Stated platform, runtime, and environment floors honored.
- No new network calls unless specified in Data & interfaces.
- Docs updated where user- or operator-visible behavior changed.
- Every acceptance criterion above passes.
