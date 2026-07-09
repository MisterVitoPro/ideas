# Interview Ledger: payment-retry
slug: payment-retry
started: 2026-07-09
scope: M
status: awaiting-review

## Decided
| # | Question | Decision | Wave |
|---|----------|----------|------|
| 1 | Retry strategy? | Exponential backoff, max 5 attempts | 1 |
| 2 | Dead-letter behavior? | Queue to DLQ after final failure | 2 |

## Assumed (unconfirmed)
| # | Topic | Assumed default | Why unasked/unanswered |
|---|-------|-----------------|------------------------|
| 3 | Metrics emission | Emit retry counters to existing telemetry | Draft-now escape chosen in wave 2 |

## Open
| # | Question | Why it matters |
|---|----------|----------------|
| 4 | Idempotency keys upstream? | Duplicate charges if retries are not idempotent |
