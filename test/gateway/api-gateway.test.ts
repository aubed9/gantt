import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../chatbot/server/src/app.js';
import { pgListenerService } from '../../chatbot/server/src/services/events/pg-listener.service.js';

describe('Express Real-Time API Gateway & Mastra Seam Tests', () => {
  const app = createApp();

  beforeAll(async () => {
    // Start listener in local mode
    await pgListenerService.start();
  });

  afterAll(async () => {
    await pgListenerService.shutdown();
  });

  it('GET /api/health returns gateway health and registered agents', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('rpm-v1-api-gateway');
    expect(res.body.mastra.registeredAgents).toContain('rpm-assistant-agent');
    expect(res.body.mastra.registeredAgents).toContain('task-claim-ranking-agent');
    expect(res.body.mastra.registeredAgents).toContain('eoj-assessor-agent');
  });

  it('POST /api/tasks/:id/claim submits a claim, invokes Mastra ranking, and emits task_claim:created', async () => {
    const res = await request(app)
      .post('/api/tasks/102/claim')
      .send({
        tenant_id: 'TN-1',
        human_id: 'HM-3',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.taskId).toBe(102);
    expect(res.body.humanId).toBe('HM-3');
    expect(res.body.status).toBe('PENDING');
    expect(res.body.matchScore).toBeGreaterThanOrEqual(0);
    expect(res.body.aiAssessment).toBeDefined();
    expect(res.body.claimId).toBeDefined();
  });

  it('POST /api/tasks/:id/claim/:claimId/approve approves claim and transitions task to ASSIGNED', async () => {
    // First submit a claim to get an ID
    const claimRes = await request(app)
      .post('/api/tasks/102/claim')
      .send({
        tenant_id: 'TN-1',
        human_id: 'HM-2',
      });

    const claimId = claimRes.body.claimId;

    const approveRes = await request(app)
      .post(`/api/tasks/102/claim/${claimId}/approve`)
      .send({
        tenant_id: 'TN-1',
        reviewer_id: 'HM-1',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.taskState).toBe('ASSIGNED');
    expect(approveRes.body.approvedHumanId).toBe('HM-2');
  });

  it('POST /api/reports/eoj submits EOJ report, moves task to IN_REVIEW, and runs AI assessor', async () => {
    const res = await request(app)
      .post('/api/reports/eoj')
      .send({
        tenant_id: 'TN-1',
        project_id: 'PR-100',
        task_id: 102,
        author_id: 'HM-2',
        title: 'گزارش پایان کار پیاده‌سازی گیت‌وی',
        content_markdown: 'تمامی سرویس‌های مورد نیاز با موفقیت مستقر و تست شدند.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.reportId).toBeDefined();
    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.taskState).toBe('IN_REVIEW');
    expect(res.body.aiReview).toBeDefined();
  });

  it('POST /api/reports/:id/approve approves EOJ, marks task COMPLETED (100%), and rolls up progress', async () => {
    // Submit report first
    const submitRes = await request(app)
      .post('/api/reports/eoj')
      .send({
        tenant_id: 'TN-1',
        project_id: 'PR-100',
        task_id: 102,
        author_id: 'HM-2',
        title: 'تأییدیه نهایی تسک ۱۰۲',
        content_markdown: 'تکمیل صد در صدی تست‌ها.',
      });

    const reportId = submitRes.body.reportId;

    const approveRes = await request(app)
      .post(`/api/reports/${reportId}/approve`)
      .send({
        tenant_id: 'TN-1',
        reviewer_id: 'HM-1',
        feedback: 'مورد تأیید است.',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.status).toBe('APPROVED');
    expect(approveRes.body.taskState).toBe('COMPLETED');
  });

  it('POST /api/reports/:id/revise requests revisions and transitions task back to IN_PROGRESS', async () => {
    const submitRes = await request(app)
      .post('/api/reports/eoj')
      .send({
        tenant_id: 'TN-1',
        project_id: 'PR-100',
        task_id: 103,
        author_id: 'HM-2',
        title: 'گزارش ناقص',
        content_markdown: 'برخی کارها باقی مانده است.',
      });

    const reportId = submitRes.body.reportId;

    const reviseRes = await request(app)
      .post(`/api/reports/${reportId}/revise`)
      .send({
        tenant_id: 'TN-1',
        reviewer_id: 'HM-1',
        reviewer_comments: 'لطفاً لاگ‌های پرفورمنس ضمیمه شود.',
      });

    expect(reviseRes.status).toBe(200);
    expect(reviseRes.body.status).toBe('REVISION_REQUESTED');
    expect(reviseRes.body.taskState).toBe('IN_PROGRESS');
  });

  it('POST /api/audio/transcribe processes voice dictation with Persian ZWNJ normalization and entity code retention', async () => {
    const res = await request(app)
      .post('/api/audio/transcribe')
      .send({
        tenant_id: 'TN-1',
        simulated_transcript: 'تسک TS-102 تمام شد و ما گزارش ها را ارسال می کنیم به مدیر پروژه HM-1',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.detectedLanguage).toBe('fa-IR');
    // Normalized text must enforce ZWNJ for می کنیم -> می‌کنیم and گزارش ها -> گزارش‌ها
    expect(res.body.normalizedText).toContain('\u200C');
    expect(res.body.zwnjCount).toBeGreaterThan(0);
    // Entity codes TS-102 and HM-1 must be retained exactly
    expect(res.body.entityCodes).toContain('TS-102');
    expect(res.body.entityCodes).toContain('HM-1');
  });

  it('GET /api/events/stream connects to SSE and sends unbuffered headers', async () => {
    let initialChunk = '';
    let responseHeaders: any = {};
    let statusCode = 0;

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const address = server.address() as any;
        const port = address.port;
        const http = await import('http');
        const req = http.get(`http://127.0.0.1:${port}/api/events/stream?tenant_id=TN-1`, (res) => {
          statusCode = res.statusCode || 0;
          responseHeaders = res.headers;
          res.on('data', (chunk) => {
            initialChunk += chunk.toString();
            if (initialChunk.includes(':connected')) {
              res.destroy();
              server.close(() => resolve());
            }
          });
          res.on('error', () => {
            server.close(() => resolve());
          });
        });
        req.on('error', () => {
          server.close(() => resolve());
        });
      });
    });

    expect(statusCode).toBe(200);
    expect(responseHeaders['content-type']).toContain('text/event-stream');
    expect(responseHeaders['cache-control']).toContain('no-cache');
    expect(responseHeaders['x-accel-buffering']).toBe('no');
    expect(initialChunk).toContain(':connected');
    expect(initialChunk).toContain('retry: 5000');
  });

  it('serves the interactive prototype demo at GET / and GET /prototype', async () => {
    const rootRes = await request(app).get('/');
    expect(rootRes.status).toBe(200);
    expect(rootRes.text).toContain('rpm-prototype-container');
    expect(rootRes.text).toContain('current-state-panel');
    expect(rootRes.text).toContain('btn-claim-task');

    const protoRes = await request(app).get('/prototype/');
    expect(protoRes.status).toBe(200);
    expect(protoRes.text).toContain('rpm-prototype-container');
  });
});
