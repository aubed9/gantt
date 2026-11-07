import type { ColumnType, Generated } from 'kysely';

export type GeneratedTimestamp = ColumnType<Date, Date | string | undefined, Date | string | undefined>;
export type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
export type RequiredTimestamp = ColumnType<Date, Date | string, Date | string>;

// Domain Enums strictly conforming to GLOSSARY.md
export type TaskState =
  | 'DRAFT'
  | 'OPEN_FOR_CLAIM'
  | 'CLAIM_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'CANCELLED';

export type ClaimState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export type ReportState = 'DRAFT' | 'SUBMITTED' | 'REVISION_REQUESTED' | 'APPROVED';

export type ReportType = 'EOJ' | 'EVENT' | 'EXECUTIVE';

// 1. Tenants Table (TN)
export interface TenantsTable {
  id: string; // e.g. 'TN-1'
  name: string;
  slug: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

// 2. Humans Table (HM)
export interface HumansTable {
  id: string; // e.g. 'HM-1'
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  is_internal: ColumnType<boolean, boolean | undefined, boolean>;
  skills: ColumnType<string[], string[] | undefined, string[]>;
  active_tasks_count: ColumnType<number, number | undefined, number>;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

// 3. Projects Table (PR)
export interface ProjectsTable {
  id: string; // e.g. 'PR-100'
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  owner_id: string | null;
  cto_id: string | null;
  status: ColumnType<string, string | undefined, string>;
  progress: ColumnType<number, number | undefined, number>;
  rolling_summary_fa: string | null;
  rolling_summary_en: string | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

// 4. Tasks Table (TS)
export interface TasksTable {
  id: Generated<number>;
  tenant_id: string;
  project_id: string;
  parent_id: number | null;
  text: string;
  type: ColumnType<string, string | undefined, string>;
  start_date: RequiredTimestamp;
  duration: ColumnType<number, number | undefined, number>;
  end_date: RequiredTimestamp;
  progress: ColumnType<number, number | undefined, number>;
  state: ColumnType<TaskState, TaskState | undefined, TaskState>;
  assignee_id: string | null;
  skills_needed: ColumnType<string[], string[] | undefined, string[]>;
  eoj_report_id: string | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

// 5. Task Claims Table
export interface TaskClaimsTable {
  id: string; // e.g. 'TC-1'
  tenant_id: string;
  task_id: number;
  human_id: string;
  status: ColumnType<ClaimState, ClaimState | undefined, ClaimState>;
  match_score: number | null;
  ai_candidate_assessment: string | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

// 6. Events Table (EV)
export interface EventsTable {
  id: string; // e.g. 'EV-201'
  tenant_id: string;
  project_id: string;
  title: string;
  description: string | null;
  event_date: RequiredTimestamp;
  is_milestone: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

// 7. Reports Table (RP & EOJ)
export interface ReportsTable {
  id: string; // e.g. 'RP-501'
  tenant_id: string;
  project_id: string;
  task_id: number | null;
  event_id: string | null;
  author_id: string;
  report_type: ReportType;
  title: string;
  content_markdown: string;
  status: ColumnType<ReportState, ReportState | undefined, ReportState>;
  reviewer_id: string | null;
  reviewer_feedback: string | null;
  submitted_at: GeneratedTimestamp;
  approved_at: NullableTimestamp;
}

// 8. Mastra Knowledge Vector Store Table (report_chunks)
export interface ReportChunksTable {
  id: Generated<string>; // UUID
  tenant_id: string;
  report_id: string;
  chunk_index: number;
  content: string;
  embedding: string | null; // pgvector serialized string e.g. '[0.012, -0.045, ...]'
  metadata: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, Record<string, unknown>>;
  created_at: GeneratedTimestamp;
}

// 9. Real-Time Outbox Table (tenant_events) for SSE & LISTEN/NOTIFY
export interface TenantEventsTable {
  id: Generated<string>; // BIGSERIAL as string in JS
  tenant_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, Record<string, unknown>>;
  created_at: GeneratedTimestamp;
}

// Complete Database Schema
export interface Database {
  tenants: TenantsTable;
  humans: HumansTable;
  projects: ProjectsTable;
  tasks: TasksTable;
  task_claims: TaskClaimsTable;
  events: EventsTable;
  reports: ReportsTable;
  'mastra_vectors.report_chunks': ReportChunksTable;
  tenant_events: TenantEventsTable;
}
