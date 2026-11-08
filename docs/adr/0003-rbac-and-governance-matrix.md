# 0003: Role-Based Granular Access Control (RBAC), Governance Matrix, and Autonomous Agent Boundaries

## Status
Accepted

## Context
In `rpm_V1`, multiple internal and external Humans collaborate within isolated Tenants across Projects, Tasks, and Reports. The platform requires a deterministic, granular permission and governance matrix defining who can submit Task Claims, evaluate candidate claims during Claim Review Windows, approve End-of-Job (EOJ) Reports, and re-open Tasks, alongside explicit architectural boundaries preventing autonomous AI agents from self-authorizing state mutations.

## Decision
1. **Canonical Roles & Tenant Boundaries**:
   - Every `Human` entity belongs to a single `Tenant` and is assigned a discrete `Role` enum: `ENGINEER`, `PROJECT_MANAGER`, `PRODUCT_OWNER`, `CTO`, or `EXTERNAL_STAKEHOLDER`.
   - Baseline capabilities are determined by `Role`, while administrative project execution requires contextual assignment:
     - **Project Manager (PM)**: Primary decision-maker for the assigned project (`project.manager_id === human.id`).
     - **Product Owner (PO) & CTO**: Retain supervisory, administrative override, and veto rights (`project.owner_id`, `project.cto_id`).
     - **Unassigned PM Fallback**: If `project.manager_id` is null, governance authority seamlessly falls back to the project's PO and CTO.

2. **Task Claiming & Concurrency Governance**:
   - Only internal humans (`is_internal = true`) can claim tasks. External stakeholders are strictly blocked.
   - Any internal human may claim an open task to encourage stretch assignments and cross-skilling; `skills_needed` remains an advisory signal for AI ranking.
   - A concurrency cap of 3 active tasks per internal human is strictly enforced.
   - Concurrency counting includes only `ASSIGNED` and `IN_PROGRESS` tasks. When a task transitions to `IN_REVIEW` (upon EOJ Report submission), its slot is freed to allow claiming the next task. If revisions are requested (`REVISION_REQUESTED`), the task reverts to `IN_PROGRESS` and re-occupies an active slot.

3. **Claim Review Window Authority & Confidentiality**:
   - Evaluating and approving/rejecting claims during the Claim Review Window is reserved for the assigned PM (or PO/CTO override).
   - Self-approval is strictly forbidden: a PM or PO claiming a task cannot approve their own claim.
   - Mastra AI candidate rankings and match scores (`ai_candidate_assessment`, `match_score`) are confidential to governance roles (PM, PO, CTO). Candidates only observe discrete state transitions (`PENDING` -> `APPROVED` / `REJECTED`).

4. **EOJ Report Review & Task Re-opening**:
   - Only the assigned PM (or PO/CTO override) can approve an EOJ Report or request revisions (`REVISION_REQUESTED`).
   - Re-opening an already `COMPLETED` task requires PM, PO, or CTO authorization.
   - Historical approved EOJ reports and pgvector chunks remain immutable in institutional memory. Re-opening a task emits a `TASK_REOPENED` event, resets task state to `IN_PROGRESS` with progress set by the PM (e.g. 80%), and mandates a subsequent EOJ report submission upon re-completion.

5. **Enforcement Seam & Agent Guardrails**:
   - **Express API Gateway**: Declarative route middleware (`requireTenantRole` and `requireProjectAuthority`) enforces tenant isolation and role/project authority using verified caller claims (`x-tenant-id`, `x-human-id`).
   - **Mastra Agent Tools & Services**: Service layer (`taskClaimService`, `eojReportService`) and Mastra tools validate caller authority in their execution context, preventing privilege escalation.
   - **Agent Boundaries**: Mastra AI agents function exclusively as advisory copilots. All authoritative state mutations (`approveClaim`, `rejectClaim`, `approveReport`, `reopenTask`) require an authenticated Human ID.

## Consequences
- Guarantees bulletproof multi-tenant isolation and role segregation across all project workflows.
- Eliminates bottlenecking by automatically falling back to PO/CTO if a PM assignment is missing.
- Protects candidate psychological safety by keeping AI ranking rationale strictly accessible to managerial roles.
- Prevents rogue autonomous agent state mutations or prompt-injection privilege escalation by enforcing human-in-the-loop sign-off on all state-changing endpoints.
