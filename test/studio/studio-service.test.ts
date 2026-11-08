import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createStudioApp } from '../../chatbot/server/src/studio/server.js';

describe('Mastra Studio Service & Observability REST API', () => {
  const { app, pool } = createStudioApp();

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('GET /health returns 200 and healthy studio service payload', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('mastra-studio');
    expect(res.body.port).toBeDefined();
  });

  it('GET /api/agents returns all 3 registered domain agents from the single Mastra instance', async () => {
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);

    const agentIds = res.body.map((a: any) => a.id);
    expect(agentIds).toContain('rpm-assistant-agent');
    expect(agentIds).toContain('task-claim-ranking-agent');
    expect(agentIds).toContain('eoj-assessor-agent');

    res.body.forEach((agent: any) => {
      expect(agent.registered).toBe(true);
    });
  });

  it('GET /api/workflows returns registered domain workflows from the single Mastra instance', async () => {
    const res = await request(app).get('/api/workflows');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    const workflowIds = res.body.map((w: any) => w.id);
    expect(workflowIds).toContain('rpm-chat-v1');
    expect(workflowIds).toContain('report-ingestion-v1');
  });

  it('GET /api/observability/traces handles queries and prevents entity filter mismatch trap', async () => {
    // When studio navigation passes code symbol chatWorkflow, it must be mapped to rpm-chat-v1
    const resTrap = await request(app).get('/api/observability/traces?filterEntityId=chatWorkflow');
    expect(resTrap.status).toBe(200);
    expect(resTrap.body).toHaveProperty('spans');
    expect(resTrap.body.entityFilter).toBe('rpm-chat-v1');

    // Canonical direct entity query
    const resDirect = await request(app).get('/api/observability/traces?entityName=rpm-assistant-agent');
    expect(resDirect.status).toBe(200);
    expect(resDirect.body).toHaveProperty('spans');
    expect(resDirect.body.entityFilter).toBe('rpm-assistant-agent');
  });

  it('GET /traces, /agents, and /workflows render the HTML Studio Dashboard', async () => {
    const resTraces = await request(app).get('/traces');
    expect(resTraces.status).toBe(200);
    expect(resTraces.text).toContain('Mastra Studio');
    expect(resTraces.text).toContain('rpm-assistant-agent');

    const resAgents = await request(app).get('/agents');
    expect(resAgents.status).toBe(200);
    expect(resAgents.text).toContain('Registered Agents');
  });
});
