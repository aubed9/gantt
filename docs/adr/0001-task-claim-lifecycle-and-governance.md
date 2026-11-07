# 0001: Task Claim Lifecycle, Governance, and AI-Assisted Candidate Ranking

## Status
Accepted

## Context
In `rpm_V1`, open Tasks must be assigned to qualified internal Humans while supporting stretch goals, multi-candidate demand, and executive oversight without manual bottlenecking or opaque automated assignment.

## Decision
We separate the Task lifecycle (`DRAFT`, `OPEN_FOR_CLAIM`, `CLAIM_REVIEW`, `ASSIGNED`, `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `BLOCKED`, `CANCELLED`) from the Task Claim lifecycle (`PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`). Any internal Human may submit a Task Claim; `skills_needed` serves as an advisory qualification match rather than a hard block. Claims are collected in a pooled Claim Review Window rather than assigned first-come-first-served. The assigned Project Manager (PM) is the primary approval authority, while Product Owners (PO) and CTO maintain administrative override and veto rights. To assist PM selection, the Mastra Agent automatically ranks claimants by combining skill fit, current bandwidth, and semantic retrieval of past End-of-Job (EOJ) Reports from pgvector.

## Consequences
- Prevents premature auto-rejection of team members pursuing cross-skilling while giving PMs full transparency into candidate readiness.
- Approving one claim automatically transitions other pending claims on that task to `REJECTED` and advances the Task to `ASSIGNED`.
- Direct assignment remains supported for urgent or pre-allocated Tasks by bypassing `OPEN_FOR_CLAIM` directly into `ASSIGNED`.
- Downstream notification pipelines and UI components can rely on deterministic, discrete state enums.
