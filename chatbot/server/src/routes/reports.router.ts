import { Router, Request, Response } from 'express';
import { eojReportService } from '../services/eoj-report.service.js';
import { db } from '../../../../packages/database/src/client.js';

export const reportsRouter = Router();

/**
 * POST /api/reports/eoj
 * Submit an End-of-Job (EOJ) Report.
 */
reportsRouter.post('/eoj', async (req: Request, res: Response) => {
  const tenantId = (req.body.tenant_id || req.headers['x-tenant-id'] || 'TN-1') as string;
  const projectId = (req.body.project_id || 'PR-100') as string;
  const taskId = parseInt(req.body.task_id, 10);
  const authorId = (req.body.author_id || req.headers['x-human-id'] || 'HM-3') as string;
  const title = (req.body.title || 'گزارش پایان کار تسک') as string;
  const contentMarkdown = (req.body.content_markdown || req.body.content || 'تمام تعهدات و اقلام تحویلی طبق زمان‌بندی تکمیل گردید.') as string;

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid or missing task_id' });
  }

  try {
    const result = await eojReportService.submitEojReport({
      tenantId,
      projectId,
      taskId,
      authorId,
      title,
      contentMarkdown,
    });
    return res.status(201).json(result);
  } catch (err: any) {
    console.error('[ReportsRouter] EOJ submission failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/reports/:id/approve
 * PM Approves an EOJ Report -> Task COMPLETED (100%) -> Project progress updated.
 */
reportsRouter.post('/:id/approve', async (req: Request, res: Response) => {
  const reportId = req.params.id;
  const tenantId = (req.body.tenant_id || req.headers['x-tenant-id'] || 'TN-1') as string;
  const reviewerId = (req.body.reviewer_id || req.headers['x-human-id'] || 'HM-1') as string;
  const feedback = req.body.feedback as string | undefined;

  try {
    const result = await eojReportService.approveReport({
      tenantId,
      reportId,
      reviewerId,
      feedback,
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[ReportsRouter] EOJ approval failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/reports/:id/revise
 * PM requests revisions on an EOJ Report -> Task back to IN_PROGRESS.
 */
reportsRouter.post('/:id/revise', async (req: Request, res: Response) => {
  const reportId = req.params.id;
  const tenantId = (req.body.tenant_id || req.headers['x-tenant-id'] || 'TN-1') as string;
  const reviewerId = (req.body.reviewer_id || req.headers['x-human-id'] || 'HM-1') as string;
  const reviewerComments = (req.body.reviewer_comments || 'لطفاً مستندات تکمیلی اضافه شود.') as string;

  try {
    const result = await eojReportService.requestRevision({
      tenantId,
      reportId,
      reviewerId,
      reviewerComments,
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[ReportsRouter] EOJ revision request failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports
 * List reports for tenant.
 */
reportsRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = (req.query.tenant_id || req.headers['x-tenant-id'] || 'TN-1') as string;

  try {
    const reports = await db
      .selectFrom('reports')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .execute();
    return res.json({ reports });
  } catch (e) {
    return res.json({ reports: [] });
  }
});
