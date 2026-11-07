# Research: Mastra Studio Telemetry Export & Multi-Turn Agent Span Logging (`rpm_V1`)

**Status**: Verified Architectural Specification  
**Issue Reference**: Fixes aubed9/gantt#12 (Part of Wayfinder Map aubed9/gantt#9)  
**Domain Terminology**: Strictly conforms to [`GLOSSARY.md`](../../GLOSSARY.md) (`Tenant`, `Human`, `Project`, `Task`, `Event`, `Report`, `End-of-Job (EOJ) Report`, `Task Claim`, `Task State`, `Task Claim State`, `Claim Review Window`, `Report State`, `Rolling Executive Summary`, `Knowledge Ingestion`).

---

## 1. Executive Summary & Telemetry Topology

In the `rpm_V1` platform, AI agents execute complex, multi-turn interactions: evaluating candidate **Task Claims** during **Claim Review Windows**, verifying structured deliverables in **End-of-Job (EOJ) Reports**, generating **Rolling Executive Summaries**, and orchestrating hybrid database searches (parameterized relational SQL alongside semantic pgvector cosine similarity).

To guarantee end-to-end auditability and performance monitoring, all agent executions, tool calls, and LLM token consumptions must be captured via OpenTelemetry (OTel) and streamed to **PostgreSQL** under the `mastra.mastra_ai_spans` schema on dev host port `5534`. Developers and operators inspect these traces in real time using **Mastra Studio** (`http://localhost:4111`).

```mermaid
flowchart TD
    subgraph ClientLayer ["Client & Frontend (Port 3122)"]
        GanttUI["DHTMLX Gantt RTL Interface"]
        ChatUI["Bilingual Project Chat (Farsi/English)"]
        SSEListener["SSE Stream Listener (Task & Report Events)"]
    end

    subgraph BackendGateway ["Express API Gateway (Port 3120)"]
        SessionRoutes["/api/tenants/:tid/projects/:pid/chat"]
        ClaimsRoutes["/api/tenants/:tid/tasks/:id/claim"]
        EOJRoutes["/api/tenants/:tid/reports/eoj"]
    end

    subgraph MastraRuntime ["Single Mastra Instance (chatbot/server/src/mastra/instance.ts)"]
        Instance["new Mastra({ ... })"]
        ObsEngine["Mastra Observability Engine"]
        StorageExporter["MastraStorageExporter (Insert-Only Strategy)"]
        
        subgraph RegisteredAgents ["First-Class Registered Domain Agents"]
            RpmAgent["rpm-assistant-agent (deepseek-v4.1-flash via AvalAI)"]
            ClaimRanker["task-claim-ranking-agent"]
            EOJAssessor["eoj-assessor-agent"]
        end

        subgraph RegisteredTools ["Instrumented Tools"]
            RelationalTool["query-projects-and-tasks (createTool)"]
            VectorTool["queryReportKnowledge (createVectorQueryTool)"]
        end
    end

    subgraph StorageLayer ["PostgreSQL 16 + pgvector (Dev Host Port 5534 / Container 5532)"]
        SpansTable[("mastra.mastra_ai_spans<br/>Traces, Spans, Tokens, Latency")]
        RelationalDomain[("Relational Tables: tenants, humans, projects, tasks, reports")]
        VectorDomain[("mastra_vectors.report_chunks (HNSW Cosine)")]
    end

    subgraph DeveloperObservability ["Observability Surface (Port 4111)"]
        StudioUI["Mastra Studio UI (http://localhost:4111/traces)"]
        MastraCLI["mastra api trace query / list"]
    end

    GanttUI --> BackendGateway
    ChatUI --> BackendGateway
    BackendGateway --> Instance
    Instance --> ObsEngine
    ObsEngine --> StorageExporter
    StorageExporter -->|INSERT Spans| SpansTable
    RpmAgent --> RelationalTool
    RpmAgent --> VectorTool
    RelationalTool --> RelationalDomain
    VectorTool --> VectorDomain
    StudioUI -->|Reads Spans| SpansTable
    MastraCLI -->|Queries OTel API| ObsEngine
```

### Core Architectural Decisions & Invariants
1. **Single Mastra Instance Invariant**: Exactly one `new Mastra({ ... })` instance must exist across `chatbot/server/src/mastra/instance.ts`. A second instance isolates snapshot memory, bifurcates connection pools, and disarms telemetry tracing. Enforced by unit test in `test/mastra/instance-binding.test.ts`.
2. **Registration Requirement for OTel Tracing**: Every domain agent must be declared in `instance.ts` under `new Mastra({ agents: { ... } })` and accessed exclusively through typed accessor functions (`getRpmAssistantAgent()`). Unregistered `new Agent(...)` instances lack `this.mastra` binding, completely bypassing the OpenTelemetry tracer and emitting zero spans to PostgreSQL or Studio.
3. **Database-Free & Key-Free Unit Boots**: Module imports in `chatbot/server/src/mastra/agents/index.ts` use `getAgentModel()` with a fallback mock model when unconfigured. Dynamic model binding (`agent.model = resolveModel()`) happens at call time inside the `instance.ts` accessors, ensuring test suites boot offline without an active PostgreSQL instance or AvalAI API keys.
4. **Mastra Studio URL Entity Filtering Safety**: Mastra Studio applies strict entity matching (`filterEntityId`). Navigating to `/workflows/<workflowKey>/traces` yields 0 records when the database entity name is actually `rpm-chat-v1`. Traces must be accessed via direct canonical routes (`http://localhost:4111/traces`, `http://localhost:4111/agents/<agent-id>/traces`, or `http://localhost:4111/workflows/<workflow-id>/traces`).
5. **Granular Tool Span Instrumentation**: `createTool` and `createVectorQueryTool` automatically emit child `tool_call` spans nested beneath parent `agent_run` spans, logging input parameters, output schemas, token consumption, and pgvector cosine distance metrics.

---

## 2. Core Architectural Invariants

### 2.1 The Single Mastra Instance Invariant

Mastra's runtime relies on a singular coordination root. When an agent or workflow executes, it resolves telemetry exporters, thread snapshots, and vector stores through its injected `this.mastra` reference. 

If a module creates an ad-hoc Mastra instance:
- OpenTelemetry span exporters are partitioned across connection pools.
- Thread memory states become desynchronized.
- Mastra Studio cannot discover active traces because spans are written to disjoint sinks.

```typescript
// chatbot/server/src/mastra/instance.ts
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';
import { MastraStorageExporter } from '@mastra/observability';
import { postgresStore, pgVector } from './storage';
import { rpmAssistantAgent, taskClaimRankingAgent, eojAssessorAgent } from './agents';
import { rpmChatWorkflow, reportIngestionWorkflow } from './workflows';

/**
 * ARCHITECTURAL INVARIANT: Exactly one Mastra instance per process.
 * Pinned in test/mastra/instance-binding.test.ts
 */
export const mastra = new Mastra({
  storage: postgresStore,
  vectors: { pgVector },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'rpm-v1-platform',
        exporters: [
          new MastraStorageExporter(),
        ],
      },
    },
  }),
  agents: {
    'rpm-assistant-agent': rpmAssistantAgent,
    'task-claim-ranking-agent': taskClaimRankingAgent,
    'eoj-assessor-agent': eojAssessorAgent,
  },
  workflows: {
    'rpm-chat-v1': rpmChatWorkflow,
    'report-ingestion-v1': reportIngestionWorkflow,
  },
});
```

### 2.2 First-Class Agent Registration & Typed Accessors

Standalone `new Agent({ ... })` instances created outside `new Mastra({ agents: { ... } })` possess no telemetry binding. When `agent.generate()` is called on an unregistered agent, no OpenTelemetry tracer interceptor is invoked.

To guarantee span emission:
1. Register every agent in `instance.ts`.
2. Access agents exclusively through typed factory accessors that retrieve the registered instance from `mastra.getAgent(...)`.
3. Bind dynamic models at call time.

```typescript
// chatbot/server/src/mastra/instance.ts (continued)
import { resolveModel } from './models';

export function getRpmAssistantAgent() {
  const agent = mastra.getAgent('rpm-assistant-agent');
  if (!agent) {
    throw new Error('Agent rpm-assistant-agent is not registered in the Mastra instance');
  }
  // Dynamic call-time model binding ensuring live API key evaluation
  agent.model = resolveModel();
  return agent;
}

export function getTaskClaimRankingAgent() {
  const agent = mastra.getAgent('task-claim-ranking-agent');
  if (!agent) {
    throw new Error('Agent task-claim-ranking-agent is not registered in the Mastra instance');
  }
  agent.model = resolveModel();
  return agent;
}

export function getEojAssessorAgent() {
  const agent = mastra.getAgent('eoj-assessor-agent');
  if (!agent) {
    throw new Error('Agent eoj-assessor-agent is not registered in the Mastra instance');
  }
  agent.model = resolveModel();
  return agent;
}
```

---

## 3. Dynamic Model Resolution & Key-Free Unit Boots

### 3.1 The Import-Time Evaluation Trap

In many standard setups, agent models are instantiated statically at top-level import:
```typescript
// ANTI-PATTERN: Fails in CI / Unit Tests without environment variables
const avalai = createOpenAI({
  baseURL: 'https://api.avalai.ir/v1',
  apiKey: process.env.AVALAI_API_KEY!, // Throws immediately if undefined
});

export const myAgent = new Agent({
  model: avalai('deepseek-v4.1-flash'), // Evaluates network provider at import
  // ...
});
```

When running `npm test` or launching unit test suites:
- The runner imports `chatbot/server/src/mastra/instance.ts`.
- The top-level `createOpenAI` evaluates immediately.
- If `AVALAI_API_KEY` is unset (or in an air-gapped CI environment), the entire test runner crashes before executing a single assertion.
- If `PostgresStore` eagerly attempts a TCP handshake, tests fail when PostgreSQL is not running.

### 3.2 The Database-Free Boot Implementation

We resolve this by decoupling static module instantiation from runtime model resolution. Agents are initialized with a stub or mock model via `getAgentModel()`. Dynamic models are bound only when an accessor function is invoked at request runtime.

```typescript
// chatbot/server/src/mastra/models/index.ts
import { createOpenAI } from '@ai-sdk/openai';
import { MockLanguageModelV1 } from 'ai/test';

/**
 * Returns a live AvalAI DeepSeek model if configured, or a mock model during tests.
 */
export function resolveModel() {
  const apiKey = process.env.AVALAI_API_KEY;
  const isTest = process.env.NODE_ENV === 'test' || !apiKey || apiKey === 'mock-key';

  if (isTest) {
    return new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 12, completionTokens: 24 },
        text: JSON.stringify({
          status: 'success',
          decision: 'APPROVED',
          reasoning: 'Unit test mock model response',
        }),
      }),
    });
  }

  const avalai = createOpenAI({
    baseURL: process.env.AVALAI_BASE_URL || 'https://api.avalai.ir/v1',
    apiKey,
  });

  return avalai('deepseek-v4.1-flash');
}

/**
 * Static boot model used strictly during module initialization in agents/index.ts.
 */
export function getAgentModel() {
  if (process.env.NODE_ENV === 'test' || !process.env.AVALAI_API_KEY) {
    return new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
        text: 'Unit test mock fallback',
      }),
    });
  }
  return resolveModel();
}
```

```typescript
// chatbot/server/src/mastra/agents/rpm-assistant.ts
import { Agent } from '@mastra/core';
import { getAgentModel } from '../models';
import { queryProjectsAndTasksTool } from '../tools/relational-query';
import { queryReportKnowledgeTool } from '../tools/vector-query';

export const rpmAssistantAgent = new Agent({
  name: 'rpm-assistant-agent',
  instructions: `
You are the rpm_V1 Resource & Project Management Assistant.
You orchestrate projects, humans, tasks, events, and reports within an isolated Tenant boundary.
Adhere strictly to GLOSSARY.md domain entities.
`,
  model: getAgentModel(), // Boots safely without API keys
  tools: {
    queryProjectsAndTasks: queryProjectsAndTasksTool,
    queryReportKnowledge: queryReportKnowledgeTool,
  },
});
```

---

## 4. OpenTelemetry Span Sink & PostgreSQL Schema

### 4.1 Storage Architecture & Exporter Configuration

Mastra observability captures telemetry via `MastraStorageExporter`. Spans are batched and written to the database using an insert-only strategy to eliminate row-level update lock contention on PostgreSQL.

- **PostgreSQL Host**: `127.0.0.1:5534` (dev host mapped from container port `5532`)
- **Database**: `rpm_v1_db`
- **Schema**: `mastra`
- **Spans Table**: `mastra.mastra_ai_spans`

```typescript
// chatbot/server/src/mastra/storage.ts
import { PostgresStore, PgVector } from '@mastra/pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://rpm_user:rpm_password@localhost:5534/rpm_v1_db';

/**
 * PostgreSQL Storage for Mastra telemetry, memory threads, and workflow snapshots.
 * Connection pool is tuned for concurrent trace writes without starving API queries.
 */
export const postgresStore = new PostgresStore({
  id: 'rpm-storage-store',
  connectionString,
  schema: 'mastra',
  poolConfig: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
});

/**
 * pgvector Vector Store for Report chunks (EOJ Reports, Meeting Minutes).
 */
export const pgVector = new PgVector({
  id: 'rpm-vector-store',
  connectionString,
  schema: 'mastra_vectors',
});
```

### 4.2 PostgreSQL `mastra.mastra_ai_spans` DDL Schema

The spans table is created during `mastra dev` or via database migration. Its schema reflects OpenTelemetry and AI-specific tracing standards:

```sql
-- PostgreSQL DDL for Mastra Observability Spans
CREATE SCHEMA IF NOT EXISTS mastra;

CREATE TABLE IF NOT EXISTS mastra.mastra_ai_spans (
    id VARCHAR(64) PRIMARY KEY,
    "traceId" VARCHAR(64) NOT NULL,
    "spanId" VARCHAR(64) NOT NULL,
    "parentSpanId" VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    "entityName" VARCHAR(255) NOT NULL,
    "entityId" VARCHAR(255),
    "spanType" VARCHAR(50) NOT NULL, -- 'agent_run', 'model_call', 'tool_call', 'workflow_step'
    status VARCHAR(50) NOT NULL,     -- 'success', 'error', 'aborted'
    input JSONB,
    output JSONB,
    error JSONB,
    attributes JSONB DEFAULT '{}'::jsonb, -- Model params, token usage, latency metrics
    "startedAt" TIMESTAMPTZ NOT NULL,
    "endedAt" TIMESTAMPTZ,
    CONSTRAINT mastra_spans_trace_span_unique UNIQUE ("traceId", "spanId")
);

-- Indexes for sub-millisecond trace filtering and Mastra Studio timeline views
CREATE INDEX IF NOT EXISTS idx_mastra_spans_trace_id 
ON mastra.mastra_ai_spans ("traceId");

CREATE INDEX IF NOT EXISTS idx_mastra_spans_entity_started 
ON mastra.mastra_ai_spans ("entityName", "startedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_mastra_spans_type_status 
ON mastra.mastra_ai_spans ("spanType", status);

CREATE INDEX IF NOT EXISTS idx_mastra_spans_attributes_gin 
ON mastra.mastra_ai_spans USING gin (attributes);
```

### 4.3 Span Attributes & Token Count Telemetry

When an agent executes an LLM generation call, Mastra automatically collects token consumption from the model response and serializes it into the `attributes` column:

```json
{
  "llm.model": "deepseek-v4.1-flash",
  "llm.provider": "avalai",
  "llm.temperature": 0.2,
  "llm.usage.prompt_tokens": 842,
  "llm.usage.completion_tokens": 168,
  "llm.usage.total_tokens": 1010,
  "llm.latency_ms": 1420,
  "tenant.id": "TN-101",
  "project.id": "PR-202",
  "human.id": "HM-1"
}
```

---

## 5. Tool Execution Span Emission

### 5.1 Relational Tool Spans (`createTool`)

When `queryProjectsAndTasksTool` is invoked by the `rpm-assistant-agent`, Mastra creates a child span with `"spanType": "tool_call"` linked to the parent `"agent_run"` span via `"parentSpanId"`.

```typescript
// chatbot/server/src/mastra/tools/relational-query.ts
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { postgresStore } from '../storage';

export const queryProjectsAndTasksTool = createTool({
  id: 'query-projects-and-tasks',
  description: 'Execute parameterized read-only SQL queries to inspect projects, tasks, humans, and task claims within a tenant boundary.',
  inputSchema: z.object({
    tenantId: z.string().describe('The Tenant ID enforcing organizational isolation'),
    entityType: z.enum(['projects', 'tasks', 'humans', 'claims']),
    filterId: z.string().optional().describe('Specific Project ID or Task ID'),
    taskState: z.enum(['DRAFT', 'OPEN_FOR_CLAIM', 'CLAIM_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED', 'CANCELLED']).optional(),
  }),
  outputSchema: z.object({
    rowCount: z.number(),
    results: z.array(z.record(z.any())),
  }),
  execute: async ({ context }) => {
    const { tenantId, entityType, filterId, taskState } = context;
    const client = await postgresStore.getClient();

    try {
      let query = '';
      const params: any[] = [tenantId];

      if (entityType === 'tasks') {
        query = 'SELECT id, text, state, start_date, end_date, progress, assignee_id FROM tasks WHERE tenant_id = $1';
        if (taskState) {
          params.push(taskState);
          query += ` AND state = $${params.length}`;
        }
        if (filterId) {
          params.push(filterId);
          query += ` AND project_id = $${params.length}`;
        }
      } else if (entityType === 'projects') {
        query = 'SELECT id, code, name, progress, manager_id FROM projects WHERE tenant_id = $1';
        if (filterId) {
          params.push(filterId);
          query += ` AND id = $${params.length}`;
        }
      }

      const res = await client.query(query, params);
      return {
        rowCount: res.rowCount ?? 0,
        results: res.rows,
      };
    } finally {
      client.release();
    }
  },
});
```

### 5.2 Vector Knowledge Tool Spans (`createVectorQueryTool`)

The `queryReportKnowledgeTool` performs semantic similarity retrieval across chunks in `mastra_vectors.report_chunks`. Mastra's RAG instrumentation emits a span capturing the query string, metadata filter conditions, cosine similarity threshold, and retrieved chunks with their match scores.

```typescript
// chatbot/server/src/mastra/tools/vector-query.ts
import { createVectorQueryTool } from '@mastra/rag';

export const PGVECTOR_PROMPT = `
When searching institutional knowledge from End-of-Job (EOJ) reports, event minutes, or project briefs:
- Provide semantic query keywords describing deliverables, technical blockers, or outcomes.
- Apply exact metadata filters:
  - projectId: Filter by Project ID
  - taskState: Must be COMPLETED for EOJ Reports
  - reportType: 'EOJ' | 'EVENT' | 'EXECUTIVE'
`;

export const queryReportKnowledgeTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'report_chunks',
  options: {
    maxResults: 5,
    minScore: 0.65,
  },
});
```

### 5.3 Multi-Turn Trace Span Hierarchy

In multi-turn conversations (e.g. bilingual chat exploring task dependencies or assessing a task claim), spans form a hierarchical tree correlated by `traceId` and `threadId`:

```mermaid
flowchart TD
    Trace["Root Trace: traceId=c19b-44a1 (threadId=TH-502)"]
    AgentSpan["Span: agent_run (entityName=rpm-assistant-agent)"]
    LLM1["Span: model_call (deepseek-v4.1-flash)<br/>Tokens: 842 In / 45 Out"]
    Tool1["Span: tool_call (query-projects-and-tasks)<br/>Input: { tenantId: 'TN-1', entityType: 'tasks', taskState: 'OPEN_FOR_CLAIM' }"]
    Tool2["Span: tool_call (queryReportKnowledge)<br/>Input: { query: 'Gantt Jalali RTL extension', minScore: 0.65 }"]
    LLM2["Span: model_call (deepseek-v4.1-flash)<br/>Tokens: 1420 In / 185 Out"]

    Trace --> AgentSpan
    AgentSpan --> LLM1
    LLM1 -->|Tool Calls Decided| Tool1
    Tool1 --> Tool2
    Tool2 --> LLM2
    LLM2 -->|Synthesizes Response| AgentSpan
```

---

## 6. Mastra Studio URL Entity Filtering Pitfall

### 6.1 The Filter Trap Explained

Mastra Studio UI runs at `http://localhost:4111`. When developers navigate through the Studio UI, clicking on a workflow or agent automatically generates URL search query parameters:
```text
http://localhost:4111/workflows/chatWorkflow/traces?filterEntityId=chatWorkflow
```

> [!WARNING]
> **The Entity Filter Mismatch Trap**:
> In `chatbot/server/src/mastra/instance.ts`, the workflow key in the object or its internal ID might be `rpm-chat-v1`, but the Studio navigation bar may filter by the code symbol name `chatWorkflow`.
> Because PostgreSQL queries use `WHERE "entityName" = 'chatWorkflow'`, the query returns **0 records**!
> Engineers often assume the OpenTelemetry telemetry sink is broken when, in fact, telemetry is logging perfectly into PostgreSQL and only the UI URL filter is misaligned.

### 6.2 Studio URL Navigation Matrix

To avoid the entity filter trap, developers and operators must access traces using the following canonical routes:

| View | Canonical Studio URL | Entity Name Filter in PostgreSQL |
| :--- | :--- | :--- |
| **All Traces (Global View)** | `http://localhost:4111/traces` | None (Displays all spans across all agents & workflows) |
| **All Registered Agents** | `http://localhost:4111/agents` | Primitive catalog view |
| **`rpm-assistant-agent` Traces** | `http://localhost:4111/agents/rpm-assistant-agent/traces` | `"entityName" = 'rpm-assistant-agent'` |
| **`task-claim-ranking-agent` Traces** | `http://localhost:4111/agents/task-claim-ranking-agent/traces` | `"entityName" = 'task-claim-ranking-agent'` |
| **`eoj-assessor-agent` Traces** | `http://localhost:4111/agents/eoj-assessor-agent/traces` | `"entityName" = 'eoj-assessor-agent'` |
| **Chat Workflow Traces** | `http://localhost:4111/workflows/rpm-chat-v1/traces` | `"entityName" = 'rpm-chat-v1'` |
| **Report Ingestion Traces** | `http://localhost:4111/workflows/report-ingestion-v1/traces` | `"entityName" = 'report-ingestion-v1'` |

### 6.3 Verifying Spans via CLI and Direct SQL

When debugging missing traces in Studio, execute these deterministic diagnostic steps:

#### Step 1: Query Mastra Studio REST API
```bash
# Verify registered agents
curl -s http://localhost:4111/api/agents | jq '.[].name'

# Check recent trace spans directly
curl -s http://localhost:4111/api/observability/traces | jq '.spans[0:5] | .[] | {name, entityName, spanType, status}'
```

#### Step 2: Query PostgreSQL Spans Table Directly
```sql
-- Connect via psql: psql -h localhost -p 5534 -U rpm_user -d rpm_v1_db
SELECT
    id,
    "traceId",
    "spanId",
    "parentSpanId",
    name,
    "entityName",
    "spanType",
    status,
    attributes->>'llm.usage.total_tokens' AS total_tokens,
    "startedAt",
    "endedAt"
FROM mastra.mastra_ai_spans
ORDER BY "startedAt" DESC
LIMIT 10;
```

#### Step 3: Check Tool Execution Errors
```sql
SELECT
    name,
    "entityName",
    error->>'message' AS error_message,
    input,
    "startedAt"
FROM mastra.mastra_ai_spans
WHERE status = 'error'
ORDER BY "startedAt" DESC
LIMIT 5;
```

---

## 7. Automated Verification: Unit Test Specification

To prevent future regression, the single Mastra instance invariant and key-free boot behavior are pinned via automated unit tests in `test/mastra/instance-binding.test.ts`.

```typescript
// test/mastra/instance-binding.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Mastra Architectural Invariants', () => {
  it('enforces exactly one "new Mastra(" instance across the backend codebase', () => {
    const srcDir = path.resolve(__dirname, '../../chatbot/server/src');
    
    // Recursive search for "new Mastra("
    function findMastraInstantiations(dir: string): string[] {
      const results: string[] = [];
      const files = fs.readdirSync(dir, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          results.push(...findMastraInstantiations(fullPath));
        } else if (file.name.endsWith('.ts') || file.name.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('new Mastra(')) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const instances = findMastraInstantiations(srcDir);
    expect(instances.length).toBe(1);
    expect(instances[0].replace(/\\/g, '/')).toContain('chatbot/server/src/mastra/instance.ts');
  });

  it('boots mastra module without environment variables or database connection (database-free boot)', async () => {
    // Delete critical env vars to simulate isolated CI runner
    const originalKey = process.env.AVALAI_API_KEY;
    const originalDb = process.env.DATABASE_URL;
    delete process.env.AVALAI_API_KEY;
    delete process.env.DATABASE_URL;

    try {
      // Must import without throwing network or configuration errors
      const { mastra, getRpmAssistantAgent } = await import('../../chatbot/server/src/mastra/instance');
      expect(mastra).toBeDefined();

      const agent = getRpmAssistantAgent();
      expect(agent).toBeDefined();
      expect(agent.name).toBe('rpm-assistant-agent');
    } finally {
      process.env.AVALAI_API_KEY = originalKey;
      process.env.DATABASE_URL = originalDb;
    }
  });

  it('ensures all domain agents are registered on the central Mastra instance', async () => {
    const { mastra } = await import('../../chatbot/server/src/mastra/instance');
    
    const requiredAgents = [
      'rpm-assistant-agent',
      'task-claim-ranking-agent',
      'eoj-assessor-agent',
    ];

    for (const agentName of requiredAgents) {
      const agent = mastra.getAgent(agentName);
      expect(agent, `Agent ${agentName} must be registered on central Mastra instance`).toBeDefined();
    }
  });
});
```

---

## 8. Summary & Downstream Implementation Handoff

| Topic | Verified Architectural Specification | Downstream Ticket / Seam |
| :--- | :--- | :--- |
| **Instance Invariant** | Exactly one `new Mastra({ ... })` instance in `chatbot/server/src/mastra/instance.ts`. | [#14 (Express Gateway & Mastra Seam)](https://github.com/aubed9/gantt/issues/14) |
| **Telemetry Sink** | `MastraStorageExporter` writes to PostgreSQL schema `mastra.mastra_ai_spans` on port `5534`. | [#10 (PostgreSQL Migrations & DDL)](https://github.com/aubed9/gantt/issues/10) |
| **Key-Free Unit Boots** | Static instantiation with `getAgentModel()` mock fallback; dynamic binding at call time in typed accessors. | [#14 (Express Gateway)](https://github.com/aubed9/gantt/issues/14) |
| **Tool Instrumentation** | Nested `tool_call` spans under parent `agent_run` spans for both relational SQL (`createTool`) and vector queries (`createVectorQueryTool`). | [#14 (Express Gateway)](https://github.com/aubed9/gantt/issues/14) |
| **Studio Navigation** | Avoid entity filter traps by routing to direct URLs: `http://localhost:4111/traces` and `/agents/<id>/traces`. | [#15 (Docker Compose & Studio Orchestration)](https://github.com/aubed9/gantt/issues/15) |
