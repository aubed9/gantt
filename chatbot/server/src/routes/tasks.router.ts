import { Router, Request, Response } from 'express';
import { taskClaimService } from '../services/task-claim.service.js';
import { db } from '../../../../packages/database/src/client.js';

export const tasksRouter = Router();

/**
 * POST /api/tasks/:id/claim
 * Submit a Task Claim by a Human and run AI ranking.
 */
tasksRouter.post('/:id/claim', async (req: Request, res: Response) => {
  const taskId = parseInt(req.params.id, 10);
  const tenantId = (req.body.tenant_id || req.headers['x-tenant-id'] || 'TN-1') as string;
  const humanId = (req.body.human_id || req.headers['x-human-id'] || 'HM-3') as string;

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task id' });
  }

  try {
    const result = await taskClaimService.submitClaim({
      tenantId,
      taskId,
      humanId,
    });
    return res.status(201).json(result);
  } catch (err: any) {
    console.error('[TasksRouter] Claim submission failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tasks/:id/claim/:claimId/approve
 * PM Approves a Task Claim.
 */
tasksRouter.post('/:id/claim/:claimId/approve', async (req: Request, res: Response) => {
  const taskId = parseInt(req.params.id, 10);
  const { claimId } = req.params;
  const tenantId = (req.body.tenant_id || req.headers['x-tenant-id'] || 'TN-1') as string;
  const reviewerId = (req.body.reviewer_id || req.headers['x-human-id'] || 'HM-1') as string;
  const humanId = req.body.human_id as string | undefined;

  if (isNaN(taskId) || !claimId) {
    return res.status(400).json({ error: 'Invalid taskId or claimId' });
  }

  try {
    const result = await taskClaimService.approveClaim({
      tenantId,
      taskId,
      claimId,
      reviewerId,
      humanId,
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[TasksRouter] Claim approval failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tasks
 * List tasks for tenant.
 */
tasksRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = (req.query.tenant_id || req.headers['x-tenant-id'] || 'TN-1') as string;
  const projectId = req.query.project_id as string | undefined;

  try {
    let query = db.selectFrom('tasks').selectAll().where('tenant_id', '=', tenantId);
    if (projectId) {
      query = query.where('project_id', '=', projectId);
    }
    const tasks = await query.execute();
    return res.json({ tasks });
  } catch (e: any) {
    return res.json({
      tasks: [
        {
          id: 101,
          tenant_id: tenantId,
          project_id: 'PR-100',
          text: 'Fallback Task 101',
          state: 'OPEN_FOR_CLAIM',
          progress: 0,
        },
      ],
    });
  }
});
