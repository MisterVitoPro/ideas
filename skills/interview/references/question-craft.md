# Question craft

How to design waves. Early waves cover ground; later waves probe contradictions and blind spots.
Every multiple-choice question carries a recommended default so an overwhelmed user can accept
and move on. One open-ended question per wave at most, spent on the fuzziest part of the idea.

A good question changes the spec depending on the answer. If every answer leads to the same spec,
cut the question. If the repo, an ADR, or an earlier answer already settles it, cut the question.

## Ambiguity taxonomy

Draw wave questions from whichever categories the idea leaves open:

## Purpose
What problem, for whom, why now; what does success look like; what is explicitly out.

## Users
Who touches it (people, services, agents); skill levels; failure tolerance.

## Data
Sources, shapes, volumes, retention, migrations; what already exists vs invented here.

## Interfaces
Entry points, protocols, file formats; who calls it and what calls it makes.

## Edge cases
Empty/huge inputs, concurrency, partial failure, retries, idempotency, ordering.

## Non-functionals
Performance floors, cost ceilings, security/privacy expectations, observability.

## Constraints
Hard tech choices, versions, platforms, deadlines, things that cannot change.

## Lifecycle
Rollout, rollback, deprecation, who maintains it, how it gets verified in production.
