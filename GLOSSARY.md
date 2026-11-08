# rpm_V1 Platform

AI-driven Resource and Project Management platform integrating DHTMLX Gantt, Mastra Agent with Knowledge, and AvalAI for bilingual (Farsi/English) organizational orchestration.

## Language

### Core Entities

**Tenant (TN)**:
An isolated organizational boundary governing projects, humans, tasks, events, and reports with query-level separation.
_Avoid_: Organization, Team, Account, Company, Workspace

**Human (HM)**:
An individual interacting with the platform, classified as internal (team member, engineer, designer) or external (stakeholder, customer).
_Avoid_: User, Account, Person

**Role**:
The canonical organizational classification of a Human within a Tenant (`ENGINEER`, `PROJECT_MANAGER`, `PRODUCT_OWNER`, `CTO`, `EXTERNAL_STAKEHOLDER`), defining baseline platform capabilities and governance eligibility.
_Avoid_: User type, Access level, Group, Permission set

**Project (PR)**:
A high-level organizational initiative governed by a Project Manager (PM), Product Owner (PO), and Chief Technology Officer (CTO).
_Avoid_: Plan, Workspace, Initiative

**Task (TS)**:
A discrete unit of work within a project defining deadlines, required skills, and success criteria.
_Avoid_: Ticket, Issue, Job

**Event (EV)**:
A scheduled or historical company milestone, meeting, or review associated with projects and participants.
_Avoid_: Calendar item, Appointment, Gathering

**Report (RP)**:
A formal, structured assessment emitted for tasks, events, or projects that drives status updates and semantic knowledge.
_Avoid_: Note, Memo, Status update

### Operations & Lifecycle

**End-of-Job (EOJ) Report**:
A mandatory structured report submitted by a team member upon task completion, detailing deliverables against success criteria.
_Avoid_: Completion note, Wrap-up, Final submission

**Task Claim**:
A formal request by a team member to take ownership of an open task matching their skills.
_Avoid_: Task grab, Assignment request, Bid

**Task State**:
The discrete phase of a Task's lifecycle (`DRAFT`, `OPEN_FOR_CLAIM`, `CLAIM_REVIEW`, `ASSIGNED`, `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `BLOCKED`, `CANCELLED`).
_Avoid_: Task status, Task stage

**Task Claim State**:
The discrete phase of an individual Task Claim (`PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`).
_Avoid_: Bid status, Claim phase

**Claim Review Window**:
A pooled period during which all incoming Task Claims on an open Task are gathered for PM evaluation and AI-assisted ranking rather than first-come-first-served assignment.
_Avoid_: Bidding period, Claim queue

**Report State**:
The discrete phase of a formal Report (`DRAFT`, `SUBMITTED`, `REVISION_REQUESTED`, `APPROVED`).
_Avoid_: Report status, Approval stage

**Rolling Executive Summary**:
An AI-generated synthesized project briefing continuously maintained by the Mastra Agent upon report approvals, capturing timeline delta, accomplishments, and risks.
_Avoid_: Project update note, AI summary

**Knowledge Ingestion**:
The automated indexing, embedding, and storage of reports and events into the vector store for semantic recall by the Mastra agent.
_Avoid_: Data sync, Archiving
