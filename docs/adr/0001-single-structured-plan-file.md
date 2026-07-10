# ADR-0001: Single structured plan file for the plan-runner adapter

- Status: accepted (2026-07-09)
- Context: The design spec promises per-task plan files to fix the monolithic-plan re-read tax (superpowers #512), but /plan-runner:run consumes a single free-form Markdown plan today. Emitting per-task files now would require a plan-runner analyzer release before the adapter could ship.
- Options considered: (1) single structured plan file with delimited per-task sections; (2) overview.md + task-N.md requiring plan-runner changes; (3) emit both formats.
- Decision: Emit one plan file with strongly delimited per-task sections. True per-task files arrive with the 0.3.x migration, when plan-runner's run/pr move into this plugin and the analyzer can change in the same release.
- Consequences: Adapter ships with zero plan-runner changes; the #512 fix is deferred, not abandoned - the delimited sections are designed to split mechanically into files at 0.3.x.
