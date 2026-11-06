# rpm_V1 Platform

AI-driven Resource and Project Management platform integrating DHTMLX Gantt, Mastra Agent with Knowledge, and AvalAI for bilingual (Farsi/English) organizational orchestration.

## Language

### Core Entities

**Human (HM)**:
An individual interacting with the platform, classified as internal (team member, engineer, designer) or external (stakeholder, customer).
_Avoid_: User, Account, Person

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

**Knowledge Ingestion**:
The automated indexing, embedding, and storage of reports and events into the vector store for semantic recall by the Mastra agent.
_Avoid_: Data sync, Archiving
