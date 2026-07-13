# Pipeline chaining (interview -> plan -> execute/tickets) - implementation plan

Goal: Chain the ideas pipeline so spec approval flows into plan generation by default and every completed plan ends at one completion gate offering plan-runner execution (when installed), inline execution, subagent execution, GitHub tickets, or stop.
Source spec: docs/specs/2026-07-12-pipeline-chaining.md
Flagged constraints (unconfirmed): None

### Task 1: Add re-entry check and completion gate to the plan skill
Task ID: pipeline-chaining-t01
Owned files: skills/plan/SKILL.md
Interfaces: consumes docs/specs/2026-07-12-pipeline-chaining.md (requirements 2-4, 8c); produces the completion-gate contract (option list, detection rule, routing targets) that Tasks 2-4 build against, including the route "execution modes read skills/plan/references/execution.md" (Task 2) and "Create GitHub tickets runs /ideas:tickets with a one-time re-offer" (Task 4)
Acceptance criteria:
- WHEN /ideas:plan finishes writing and committing a plan file THE SYSTEM SHALL present exactly one completion-gate AskUserQuestion before ending the run
- WHILE /plan-runner:run is present in the session's available-skills list THE SYSTEM SHALL show "Execute with plan-runner" as the recommended gate option
- WHILE /plan-runner:run is absent from the available-skills list THE SYSTEM SHALL omit the plan-runner option and still offer "Run inline" and "Run with subagents"
- IF the repo has no GitHub remote or gh is not on PATH THEN THE SYSTEM SHALL omit the "Create GitHub tickets" gate option
- IF the completion-gate AskUserQuestion returns an empty answer THEN THE SYSTEM SHALL treat it as "Stop here" and never begin execution
- WHEN /ideas:plan is invoked and docs/plans/YYYY-MM-DD-<slug>.plan.md already exists for the spec THE SYSTEM SHALL ask once whether to resume remaining tasks or regenerate the plan, before any regeneration
- WHEN a non-executing path is taken (plan-runner, tickets, stop) THE SYSTEM SHALL NOT load references/execution.md
Verification: manual: dry-run /ideas:plan against an existing approved spec in sessions with and without plan-runner installed and confirm the gate options; grep skills/plan/SKILL.md for the gate step and re-entry step
Non-goals:
- Does not write the execution procedures themselves (Task 2)
- Does not change the 10-step emission procedure or the plan file format (ADR-0005)
- Does not add a new command surface (ADR-0006)
Blocked by: none
Constraints: Detection is the skill-availability check only - no filesystem probing. Gate and re-entry are procedure prose in SKILL.md; execution semantics stay out of this file (ADR-0006 lazy-reference boundary). No breaking changes to standalone /ideas:plan behavior up to the gate.

### Task 2: Write the execution reference (inline and subagent modes)
Task ID: pipeline-chaining-t02
Owned files: skills/plan/references/execution.md
Interfaces: consumes the completion-gate contract from pipeline-chaining-t01 and the plan-file task format in skills/plan/references/task-format.md; produces the execution procedures, the exec(<slug>-tNN) commit convention, and the done-ness rule that Task 5 pins in contract tests
Acceptance criteria:
- WHEN the user picks "Run inline" THE SYSTEM SHALL read references/execution.md and implement tasks in blocked-by order, running each task's Verification command and committing per task (git-gated)
- WHEN the user picks "Run with subagents" THE SYSTEM SHALL group tasks into file-disjoint waves by blocked-by edges, dispatch one general-purpose agent per task, and commit each completed task's Owned files individually
- WHEN execution commits a task THE SYSTEM SHALL use the commit message exec(<slug>-tNN): <title>
- IF a task fails during execution THEN THE SYSTEM SHALL finish the current wave, revert the failed task's Owned files before any commit includes them, skip dependent tasks, and report every task ID as completed, failed, or skipped
- WHILE resuming THE SYSTEM SHALL treat a task as done only when a matching exec(<slug>-tNN) commit exists, the commit subject's title exactly matches the current plan's task title, AND its Verification command passes
- IF git is absent THEN THE SYSTEM SHALL use verification-only done-ness and state in the report that resume is verification-based
Verification: manual: in a scratch repo, execute a small plan in subagent mode with one task rigged to fail; confirm wave-boundary revert, the completed/failed/skipped report, and that a re-run resumes only not-done tasks; then regenerate the plan with reordered tasks and resume, asserting no task is reported done off a stale commit
Non-goals:
- Does not add verifier agents (that depth is plan-runner's job)
- Does not modify skills/plan/SKILL.md (Task 1 owns it)
- Does not touch the plan file format or add execution-mode fields to it
Blocked by: pipeline-chaining-t01
Constraints: New file - read only after an execution mode is chosen (ADR-0006). Subagent dispatch uses general-purpose agents. File disjointness of Owned files is what guarantees clean per-task staging; state that dependency explicitly in the procedure.

### Task 3: Flip the interview review-gate default to plan generation
Task ID: pipeline-chaining-t03
Owned files: skills/interview/SKILL.md
Interfaces: consumes the completion-gate existence from pipeline-chaining-t01 (approval now flows into a plan run that ends at the gate); produces the review-gate wording Task 6 documents in the README
Acceptance criteria:
- WHEN the interview review gate is presented THE SYSTEM SHALL mark "Approve + generate plan" as the recommended option while still offering plain "Approve"
Verification: grep skills/interview/SKILL.md for the review-gate paragraph showing "Approve + generate plan" as recommended and plain "Approve" still present
Non-goals:
- Does not remove the plain "Approve" (spec-only) exit
- Does not change triage, waves, ledger, audit, or critic behavior
Blocked by: pipeline-chaining-t01
Constraints: Prose-only change to the Review gate section; the two Approve options and their run-ending semantics stay intact (no breaking changes).

### Task 4: Add the one-time execution re-offer to tickets
Task ID: pipeline-chaining-t04
Owned files: skills/tickets/SKILL.md, skills/tickets/references/emission.md
Interfaces: consumes the gate-invocation context from pipeline-chaining-t01 (gate routes "Create GitHub tickets" into /ideas:tickets); produces the post-emission re-offer contract Task 6 documents in the README
Acceptance criteria:
- WHEN the user picks "Create GitHub tickets" at the plan completion gate THE SYSTEM SHALL run /ideas:tickets and, after its emission report, re-offer the execution options exactly once
- WHEN /ideas:tickets is invoked standalone THE SYSTEM SHALL behave exactly as it does today with no re-offer
Verification: grep skills/tickets/SKILL.md for the gate-invoked re-offer paragraph and its standalone-unchanged clause
Non-goals:
- Does not change the Definition-of-Ready gate, upsert lookup, or issue rendering
- Does not re-offer more than once or loop back into tickets
Blocked by: pipeline-chaining-t01
Constraints: The re-offer distinguishes gate-invoked from standalone by invocation context only - no state files, no plan-file changes. gh CLI only, no tokens in files.

### Task 5: Pin the new surface in contract tests
Task ID: pipeline-chaining-t05
Owned files: tests/contract.test.js
Interfaces: consumes skills/plan/references/execution.md (pipeline-chaining-t02) and the gate step in skills/plan/SKILL.md (pipeline-chaining-t01); produces the passing suite Task 6's release rides on, including the 0.6.0 version pin
Acceptance criteria:
- WHEN node --test tests/contract.test.js runs THE SYSTEM SHALL fail if skills/plan/references/execution.md is absent
- WHEN node --test tests/contract.test.js runs THE SYSTEM SHALL fail if skills/plan/SKILL.md lacks the completion-gate step or the re-entry (resume vs regenerate) step
- WHEN node --test tests/contract.test.js runs THE SYSTEM SHALL fail if execution.md's commit convention does not match exec(<slug>-tNN): <title>
- WHEN node --test tests/contract.test.js runs THE SYSTEM SHALL fail if the version pin does not equal the plugin.json version (0.6.0)
Verification: node --test tests/contract.test.js
Non-goals:
- Does not test runtime gate behavior (that is the manual/integration dry run)
- Does not modify any skill prose
Blocked by: pipeline-chaining-t02
Constraints: Additive tests alongside the existing suite; keep the existing pin style used for prior releases.

### Task 6: Document the chained pipeline and bump the version
Task ID: pipeline-chaining-t06
Owned files: README.md, CHANGELOG.md, .claude-plugin/plugin.json, package.json
Interfaces: consumes the final behavior of pipeline-chaining-t01/t03/t04; produces the 0.6.0 release surface (the git tag automates on merge; the qa-claude-market pin moves after, per the six-place release protocol)
Acceptance criteria:
- WHEN the release lands THE SYSTEM SHALL show version 0.6.0 in .claude-plugin/plugin.json and package.json and a CHANGELOG entry describing the completion gate, execution modes, resume, and tickets re-offer
- WHEN a user reads the README's pipeline section THE SYSTEM SHALL describe the flipped review-gate default, the completion gate with its five options and hiding rules, and the plan-to-tickets-then-execute path
- IF the README still claims /ideas:plan ends at a written file with no next step THEN THE SYSTEM SHALL be corrected before release
Verification: claude plugin validate .; grep README.md for the completion-gate description; grep both manifests for 0.6.0
Non-goals:
- Does not move the qa-claude-market marketplace pin (post-merge step in that repo)
- Does not edit any skill file
Blocked by: pipeline-chaining-t01, pipeline-chaining-t03, pipeline-chaining-t04
Constraints: Version bump is four in-repo places (plugin.json, package.json, CHANGELOG.md, contract-test pin - the pin itself is Task 5's file); README keeps the existing plan-runner how-it-fits section accurate (execute-plan migration stays roadmap).
