# ADR-0002: Adapter behavior lives in a lazy-loaded reference file

- Status: accepted (2026-07-09)
- Context: SKILL.md is the always-resident skill body (100 of a 150-line budget). The adapter runs only when requested; its procedure and plan template would spend ~20 resident lines on a sometimes-used path.
- Options considered: (1) adapter section inline in SKILL.md; (2) ~4 SKILL.md lines pointing to references/plan-adapter.md holding the full procedure and plan template; (3) a dedicated pipeline agent (rejected earlier: main-loop-inline decomposition, ledger row 6).
- Decision: Lazy reference file, one level deep - the same progressive-disclosure pattern as spec-template.md.
- Consequences: Resident token cost stays near zero when the adapter is unused; the reference is contract-testable like every other prose file; SKILL.md stays well under its line budget.
