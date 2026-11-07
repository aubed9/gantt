# 0002: End-of-Job (EOJ) Report Review, Status Propagation, and Rolling Executive Summaries

## Status
Accepted

## Context
When work on a Task concludes or an Event occurs in `rpm_V1`, structured Reports (especially End-of-Job Reports) must be submitted and validated. The system requires an unambiguous review flow, explicit remediation mechanisms for unmet success criteria, mathematical progress roll-ups to the parent Project, and automated executive synthesis for stakeholders without manual status updates.

## Decision
1. **Review Lifecycle**: Submitting an EOJ Report transitions the Task from `IN_PROGRESS` to `IN_REVIEW` and creates a Report record in `SUBMITTED` state. Approval by the assigned Project Manager (PM) — with PO and CTO administrative override — transitions the Report to `APPROVED` and the Task to `COMPLETED` (100% progress), while triggering automated vector ingestion.
2. **Dual-Path Remediation**: If success criteria are unmet or revisions are required, the PM can either:
   - Request revisions (`REVISION_REQUESTED`), returning the Task to `IN_PROGRESS` with explicit reviewer comments for the assignee to address.
   - Accept the partial work (`COMPLETED`) while triggering the automatic creation of a linked follow-up Task containing the residual scope.
3. **Progress Roll-Up & Event Association**: The parent Project (`PR`) overall progress percentage rolls up using standard duration-weighted aggregation: $\sum (\text{task.progress} \times \text{task.duration}) / \sum \text{task.duration}$. Event Reports snapshot the status of all Tasks scheduled for that milestone upon submission.
4. **Asynchronous Mastra AI Synthesis**: An asynchronous Mastra workflow triggers upon report approval to ingest markdown chunks into PostgreSQL pgvector, evaluate timeline changes, and update a bilingual (Farsi/English) **Rolling Executive Summary** on the Project entity for real-time stakeholder visibility.

## Consequences
- Every completed Task is guaranteed to possess an approved, indexed EOJ Report in pgvector, forming the permanent institutional memory that powers subsequent Task Claim evaluations.
- Project managers and executives gain instant visibility via rolling AI briefings without requesting manual status meetings.
- Clear state transitions (`IN_REVIEW` -> `COMPLETED` or `IN_PROGRESS`) prevent tasks from getting lost in review queues.
