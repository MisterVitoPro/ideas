# Task-format Contract Reference

This document specifies the canonical task-section format produced by the Ideas plan skill and
consumed by the Ideas tickets and plan-runner skills.

## Task Structure

Every task section in a plan file SHALL follow this structure with field lines in this exact order:

```
### Task N: <title>
Task ID: <slug>-t<NN>
Owned files: <comma-separated paths>
Interfaces: <producer/consumer contracts>
Acceptance criteria:
- <criterion text>
Verification: <command or procedure>
Non-goals: <bullets of what this task does NOT do>
Blocked by: <task ID list or "none">
Constraints: <constraints text>
```

## Field Definitions

### `### Task N: <title>`
Markdown heading level 3 with sequential task number and short imperative title.
- **Example:** `### Task 1: Implement user authentication`
- Required: Yes
- Position: First line of task section

### `Task ID: <slug>-t<NN>`
Unique stable identifier assigned at first plan write, never renumbered across plan edits.
- **Format:** `<slug>` is derived from the plan filename (YYYY-MM-DD-<slug>); `<NN>` is zero-padded task number (t01, t02, ..., t99)
- **Example:** For plan `2026-07-12-plan-stage.plan.md`, Task 1 has ID `plan-stage-t01`
- Required: Yes
- Stability: Once assigned, this ID SHALL NOT change across plan re-emissions

### `Owned files: <comma-separated paths>`
List of file paths this task is allowed to create or modify. Other tasks cannot write to these files.
- **Example:** `Owned files: src/auth.ts, tests/auth.test.ts`
- Required: Yes
- Format: Relative to repository root, comma-separated with no leading/trailing spaces around paths

### `Interfaces: <producer/consumer contracts>`
Specification of what this task consumes from previous tasks and produces for subsequent tasks.
- Describes data contracts (file formats, field schemas, API shapes)
- References other tasks by Task ID when establishing dependencies
- **Example:** `Interfaces: consumes task-format.md (Task 1); produces plan-generation procedure (Task 2)`
- Required: Yes

### `Acceptance criteria:`
EARS-format (Event-Action-Result Schema) acceptance criteria specifying testable outcomes.
- Each criterion starts with `WHEN`, `IF`, or no keyword prefix (reference-only, which SHALL cause plan write refusal)
- Must include conditional branches (`IF`/`THEN`) for error cases
- Must specify `SHALL` or `SHALL NOT` outcomes
- **Format:** `- WHEN <condition> THEN THE SYSTEM SHALL <outcome>` or `- IF <condition> THEN THE SYSTEM SHALL <outcome>`
- Reference-only criteria (numbered but no WHEN/IF/SHALL) are invalid and SHALL cause the plan write to refuse, naming the offending task and criterion
- Required: Yes
- Minimum: One criterion

### `Verification: <command or procedure>`
How to verify the task is complete. May be a shell command, manual procedure, or test invocation.
- **Examples:**
  - `Verification: run `npm test -- --testNamePattern="auth"`
  - `Verification: manual: deploy to staging and test SSO flow`
  - `Verification: `gh api graphql -f query='query { repository(name:"ideas") { issues(first:10) { nodes { title } } } }'`
- Required: Yes
- Executable or reproducible by the task owner

### `Non-goals: <bullets>`
Explicit statement of what this task does NOT do. Prevents scope creep and clarifies boundaries.
- **Example:**
  ```
  Non-goals:
  - Does not implement OAuth
  - Does not handle multi-factor authentication
  - Does not modify existing API contracts
  ```
- Required: Yes
- At least one bullet

### `Blocked by: <task ID list or "none">`
Task dependencies. This task cannot start until all listed tasks are complete.
- **Format:** Comma-separated Task IDs, e.g., `Task 1, Task 3, Task 5` or `none` if no blockers
- Required: Yes
- Task 1 (walking skeleton) typically has `Blocked by: none`
- All other tasks with more than one task total SHALL have at least one blocked-by edge

### `Constraints: <constraints text>`
Technical constraints, design decisions, and non-functional requirements.
- Size targets, integration patterns, compatibility requirements
- Interaction rules with other tasks
- **Examples:**
  - `Constraints: Target 30-60 dense lines per task; no code bodies.`
  - `Constraints: Use gh CLI only, no GitHub tokens in files.`
  - `Constraints: SKILL.md must stay within 150-line budget.`
- Required: Yes

## Validation Rules

1. **Field Order**: Fields MUST appear in the order specified above.
2. **Field Completeness**: All nine fields MUST be present in every task.
3. **EARS Format**: Acceptance criteria MUST use proper EARS syntax (`WHEN`, `IF`, `THEN`, `SHALL`/`SHALL NOT`).
4. **Reference Criteria Rejection**: Any acceptance criterion without WHEN/IF prefix SHALL cause the plan write to refuse, naming the task and criterion number.
5. **Task ID Stability**: Once a Task ID is assigned in a plan, it SHALL NOT change in subsequent plan edits or re-emissions.
6. **Task ID Scheme**: Format MUST be `<slug>-t<NN>` where `<NN>` is zero-padded (t01, t02, ..., t99).
7. **Walking Skeleton**: When a plan contains two or more tasks, Task 1 SHALL own all critical/hotspot files and all other tasks SHALL carry at least one blocked-by edge.
8. **File Isolation**: Each task's owned files SHALL be disjoint from all other tasks' owned files.
9. **No Code Bodies**: Task sections contain specification only; executors write the implementation code.

## Plan File Requirements

Plan files that use this task format:
- MUST be named `<root>/plans/YYYY-MM-DD-<slug>.plan.md`, where `<root>` is the resolved docs
  root (see `docs-location.md`)
- MUST contain a header with `Goal:` and `Source spec:` lines
- MUST list `Flagged constraints (unconfirmed):` before task sections
- MUST have a flat task list (no wave groupings in the plan file itself)
- MAY be accepted by `plan-runner:run` unchanged

## Compatibility Notes

This format is a strict superset of plan-runner's expected fields:
- **From plan-runner**: Owned files, Interfaces, Acceptance criteria, Constraints
- **Added fields**: Task N heading, Task ID, Verification, Non-goals, Blocked by
- New fields are additive only and SHALL NOT remove or replace existing fields.
