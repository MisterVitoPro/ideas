# bench harness - implementation plan

Goal: Build bench/ - the paired, blind, simulated-user benchmark comparing /ideas:interview against superpowers:brainstorming, per the design spec's measurement section.
Source spec: docs/specs/2026-07-08-ideas-design.md (section 13)
Flagged constraints (unconfirmed):
- Simulated-user results are a relative comparison of elicitation skill, not absolute human usability ("Lost in Simulation" caveat, spec A.6); 2-3 scenarios must later be validated with a real human user.
- Judge runs on a Claude model (cross-family judging needs an external API key the harness does not assume); self-preference risk is mitigated by masking + order-swap only. Recorded in every report.
- Ships with 6 pilot scenarios, below the spec's N=15-20; the report generator labels any run at N<15 as PILOT (no silent caps). Scaling to 15-20 is a follow-up authoring task.
- Headless runs cannot answer AskUserQuestion; the driver instructs both workflows to ask in numbered prose. Both sides run the same variant; ideas' batching still shows as fewer turns. Recorded in every report.
- plan-runner-style honesty applies: token counts are best-effort from claude CLI JSON output; missing usage becomes null and is excluded from sums with coverage counters.

This plan uses the ideas contracts format (references/plan-adapter.md): tasks carry owned files, interfaces, full EARS criteria, constraints - never function bodies or test code. Implementers follow TDD (node --test, hermetic: no API calls in tests; fixtures only).

Global constraints: no emojis; author MisterVitoPro; plain Node (CommonJS), zero npm dependencies; bench/ is dev tooling - not plugin payload, no version bump; `bench/runs/` is gitignored; on Windows spawn the claude CLI with shell enabled (claude is claude.cmd); every task ends with `node --test bench/tests/` green plus the repo's existing `node --test tests/contract.test.js` untouched and green; branch feat/bench off main.

### Task 1: Scaffolding, config, scenario schema, 6 pilot scenarios

Owned files: bench/README.md (stub), bench/config.json, bench/scenarios/SCHEMA.md, bench/scenarios/s01-cli-flag/ through s06-game-save/ (each: hidden-doc.md, acceptance.md, meta.json), bench/lib/scenarios.js, bench/tests/scenarios.test.js, .gitignore (append bench/runs/)
Interfaces: produces loadScenarios(dir) -> [{id, title, domain, hiddenDoc, acceptance, meta}] where meta.json = {id, title, domain, facts: [{id, text, weight: "critical"|"nice"}], ambiguities: [string], latent: [string]}; produces config.json = {interviewee_model, simuser_model, judge_model, runs_per_cell: 3, turn_cap: 25, workflows: {ideas: {kickoff}, brainstorming: {kickoff}}}
Acceptance criteria:
- WHEN loadScenarios reads bench/scenarios THE SYSTEM SHALL return exactly 6 scenarios each having 8-12 facts (at least 3 critical), 3-4 ambiguities, and 1-2 latent constraints, and SHALL throw a named error listing every violation when a scenario is malformed.
- WHEN the 6 scenario hidden-docs are read THE SYSTEM SHALL cover 6 distinct domains (CLI feature, schema migration, UI component, auth flow, data pipeline, game feature) with acceptance.md checklists written only from the hidden doc.
- WHEN the repo test suites run THE SYSTEM SHALL pass bench/tests/scenarios.test.js validating all shipped scenarios against the schema.
Constraints: scenario briefs must be realistic and self-contained; latent constraints must be facts a user would only reveal if asked; facts must be individually checkable statements.

### Task 2: Paired statistics module

Owned files: bench/lib/stats.js, bench/tests/stats.test.js
Interfaces: produces wilcoxonSignedRank(pairsA, pairsB) -> {n, w, p, medianDiff}; exactBinomial(wins, losses) -> {p}; mean(xs), median(xs); summarize(pairsA, pairsB) -> {n, meanA, meanB, medianDiff, wilcoxon_p}; all pure functions, null-safe (null entries dropped pairwise with dropped count returned)
Acceptance criteria:
- WHEN wilcoxonSignedRank receives the worked example pairs from a published statistics table THE SYSTEM SHALL return the known W statistic and a two-sided p within 0.01 of the table value.
- WHEN exactBinomial receives (8 wins, 1 loss) THE SYSTEM SHALL return the exact two-sided binomial p for 9 discordant pairs.
- WHEN inputs contain null (missing metric) THE SYSTEM SHALL drop those pairs, report dropped counts, and never substitute fabricated values.
Constraints: dependency-free; exact small-sample computation (no normal approximation below n=20); document formulas in comments only where the code cannot show them.

### Task 3: Simulated user + conversation driver (dry-run testable)

Owned files: bench/lib/simuser.js, bench/lib/driver.js, bench/tests/driver.test.js, bench/fixtures/fake-cli.js, bench/fixtures/transcript-sample.json
Interfaces: consumes loadScenarios, config.json; produces buildSimUserPrompt(scenario, transcript) -> string (protocol: answer only what is asked; reveal a planted fact only when a question targets it; never volunteer critical constraints; never rescue a wrap-up; stay grounded in the hidden doc; concise); produces runSession({scenario, workflow, runIndex, config, exec}) -> transcript object written to bench/runs/<scenario>/<workflow>/run<N>/transcript.json with shape {scenario, workflow, run, turns: [{role: "assistant"|"user", text, usage: {output_tokens}|null}], totals: {output_tokens, output_tokens_complete: boolean, turns, questions_asked}, artifact: {spec_path|null}, ended_by: "spec-detected"|"turn-cap"|"error"}; exec is an injectable command executor (real one spawns the claude CLI with --output-format json and --resume; tests inject a scripted fake)
Acceptance criteria:
- WHEN runSession executes with the fixture fake executor THE SYSTEM SHALL drive the loop kickoff -> assistant -> simuser -> assistant ... and terminate with ended_by "spec-detected" when the fake announces a spec file that exists in the sandbox workspace, and "turn-cap" when config.turn_cap is reached.
- WHEN an assistant turn asks questions THE SYSTEM SHALL obtain the user reply by calling the simuser model through the same injectable executor (never answered by the driver itself).
- WHEN the claude CLI JSON omits usage THE SYSTEM SHALL record usage null for that turn and set totals.output_tokens_complete false (never fabricate counts).
- WHEN a session starts THE SYSTEM SHALL run in a fresh sandbox git workspace under bench/runs/.../workspace and prepend a harness preamble instructing the workflow to ask all questions as numbered prose (AskUserQuestion unavailable headless).
Constraints: real executor uses claude CLI only (no SDK dependency); Windows-safe spawning; every run directory self-contained; tests hermetic via the fake executor - zero network.

### Task 4: Metrics (tiers A and B) + judge (tier C)

Owned files: bench/lib/metrics.js, bench/lib/judge.js, bench/tests/metrics.test.js, bench/fixtures/transcript-pair/ (two fixture transcripts + fixture spec files + a fixture scenario)
Interfaces: consumes transcript shape (Task 3) and scenario meta (Task 1); produces tierA(transcript) -> {output_tokens, output_tokens_complete, turns, questions_asked, user_burden_tokens}; tierB({scenario, transcript, spec, exec}) -> {facts: [{id, elicited: "active"|"passive"|"missed"}], active_pct, critical_coverage, silent_assumptions, flagged_assumptions} (fact matching via one executor-driven judge call per scenario, prompt includes the hidden facts and the transcript); tierC({specA, specB, exec}) -> per-dimension {completeness, unambiguity, testability, consistency, assumption_honesty} each 1-5, sources masked and headers normalized before judging, every pairwise call run in both orders and averaged, judge temperature 0
Acceptance criteria:
- WHEN tierA processes the fixture transcript THE SYSTEM SHALL compute tokens/turns/questions deterministically and mark output_tokens_complete false if any turn's usage is null.
- WHEN tierC judges a pair THE SYSTEM SHALL strip workflow-identifying headers from both specs, randomize A/B order per call, run each judgment order-swapped, and average - and SHALL record both raw orderings in the output for audit.
- WHEN tierB or tierC executor calls fail THE SYSTEM SHALL return null for the affected metric with an error note (never a guessed score).
- WHEN metrics tests run THE SYSTEM SHALL pass hermetically using fixture transcripts and a scripted fake executor.
Constraints: judge prompts instruct that length is not quality; each tier-C dimension is its own isolated call; no metric silently defaults.

### Task 5: Orchestrator CLI, report generator, docs

Owned files: bench/run.js, bench/lib/report.js, bench/tests/report.test.js, bench/README.md (full), README.md (repo - one bench status line), CHANGELOG.md (unreleased-dev note)
Interfaces: consumes everything above; produces CLI `node bench/run.js <run|score|report> [--scenario id] [--workflow name] [--dry-run]`; report.js consumes all per-run metric JSONs and emits bench/runs/report.md containing: per-metric paired tables (tier A/B/C), Wilcoxon/exact-binomial p-values, dropped/null coverage counts, the pre-declared success bar from spec section 13 evaluated as PASS/FAIL/INSUFFICIENT-DATA, and a mandatory Caveats section (pilot N, prose-mode variant, same-family judge, sim-user relativity)
Acceptance criteria:
- WHEN `run --dry-run` executes THE SYSTEM SHALL exercise the full pipeline against the fake executor and fixtures without any network call and exit 0.
- WHEN report.js runs on fixture metrics THE SYSTEM SHALL render every pre-declared metric including ones where brainstorming wins, evaluate the success bar (>=30 percent fewer output tokens AND match-or-beat tier C composite and tier D when present), and label N<15 as PILOT.
- WHEN any metric family is entirely null THE SYSTEM SHALL report INSUFFICIENT-DATA for the bar rather than PASS or FAIL.
- WHEN bench/README.md is read THE SYSTEM SHALL document prerequisites (ideas + superpowers installed, pinned versions recorded into the report), the run matrix, cost expectations, and the tier D downstream-execution step as a documented manual procedure (not automated in this version - stated plainly).
Constraints: the success bar text must quote spec section 13 verbatim; no report field may claim completeness the coverage counters do not support.
