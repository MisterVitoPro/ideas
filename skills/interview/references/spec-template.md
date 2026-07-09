# Spec template

Sections scale to scope: an S-scope spec may be under a page; write "None" rather than deleting a mandatory section.
Specs are contracts: interfaces, file paths, acceptance criteria, constraints - not function bodies, test code, or shell commands.
When execution learns something, a contract survives it; prescribed code does not.

## <Title> - design spec
Date / Status / Author

## Problem
What hurts today, in the user's terms. One paragraph.

## Goals
Bulleted, verifiable outcomes drawn from `decided` ledger rows.

## Non-goals
Explicit exclusions the user chose, each traceable to the ledger.

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
Every `assumed` ledger row appears here with its labeled default and why it went unanswered.
This section and Open questions are structurally mandatory even when empty ("None").

## Open questions
Every `open` ledger row appears here with why it matters.
