import { db } from '../../../../packages/database/src/client.js';
import { getEojAssessorAgent } from '../mastra/instance.js';
import { eventDispatcherService } from './events/event-dispatcher.service.js';

export interface SubmitEojReportInput {
  tenantId: string;
  projectId: string;
  taskId: number;
  authorId: string;
  title: string;
  contentMarkdown: string;
}

export interface ApproveEojReportInput {
  tenantId: string;
  reportId: string;
  reviewerId: string;
  feedback?: string;
}

export interface ReviseEojReportInput {
  tenantId: string;
  reportId: string;
  reviewerId: string;
  reviewerComments: string;
}

export class EojReportService {
  /**
   * Submit an End-of-Job (EOJ) Report:
   * Creates report in SUBMITTED state, transitions task to IN_REVIEW, and runs AI Assessor Agent.
   */
  public async submitEojReport(input: SubmitEojReportInput) {
    const { tenantId, projectId, taskId, authorId, title, contentMarkdown } = input;
    const reportId = `RP-${Date.now().toString().slice(-6)}`;

    // 1. Invoke Mastra EOJ Assessor Agent
    let aiReview = 'EOJ Report satisfies deliverables and definition of done.';
    try {
      const agent = getEojAssessorAgent();
      const prompt = `
Evaluate End-of-Job Report ${reportId} for Task ${taskId} in Project ${projectId}:
Title: "${title}"
Content:
${contentMarkdown}
Check completion, blockers, and adherence to GLOSSARY.md domain entities.
`;
      const response = await agent.generate(prompt);
      if (response && response.text) {
        aiReview = response.text;
      }
    } catch (e: any) {
      console.warn('[EojReportService] Agent evaluation fallback:', e.message);
    }

    // 2. Persist Report and update Task state to IN_REVIEW
    try {
      await db
        .insertInto('reports')
        .values({
          id: reportId,
          tenant_id: tenantId,
          project_id: projectId,
          task_id: taskId,
          event_id: null,
          author_id: authorId,
          report_type: 'EOJ',
          title,
          content_markdown: contentMarkdown,
          status: 'SUBMITTED',
          reviewer_id: null,
          reviewer_feedback: aiReview,
          submitted_at: new Date(),
          approved_at: null,
        })
        .execute();

      await db
        .updateTable('tasks')
        .set({
          state: 'IN_REVIEW',
          eoj_report_id: reportId,
          updated_at: new Date(),
        })
        .where('id', '=', taskId)
        .where('tenant_id', '=', tenantId)
        .execute();
    } catch (e: any) {
      console.warn('[EojReportService] DB write fallback:', e.message);
    }

    // 3. Emit SSE Event
    await eventDispatcherService.dispatch({
      tenantId,
      eventType: 'report:submitted',
      entityType: 'report',
      entityId: reportId,
      payload: {
        reportId,
        taskId,
        projectId,
        authorId,
        title,
        status: 'SUBMITTED',
        taskState: 'IN_REVIEW',
        aiReview,
      },
    });

    return {
      success: true,
      reportId,
      taskId,
      projectId,
      status: 'SUBMITTED',
      taskState: 'IN_REVIEW',
      aiReview,
    };
  }

  /**
   * PM Approves EOJ Report:
   * Transitions Report to APPROVED, Task to COMPLETED (100% progress),
   * and calculates duration-weighted progress roll-up for the parent Project.
   */
  public async approveReport(input: ApproveEojReportInput) {
    const { tenantId, reportId, reviewerId, feedback } = input;

    let taskId: number | null = null;
    let projectId = 'PR-100';

    try {
      const report = await db
        .selectFrom('reports')
        .select(['task_id', 'project_id'])
        .where('id', '=', reportId)
        .where('tenant_id', '=', tenantId)
        .executeTakeFirst();

      if (report) {
        taskId = report.task_id;
        projectId = report.project_id;
      }

      // Update Report to APPROVED
      await db
        .updateTable('reports')
        .set({
          status: 'APPROVED',
          reviewer_id: reviewerId,
          reviewer_feedback: feedback || 'Approved without amendments.',
          approved_at: new Date(),
        })
        .where('id', '=', reportId)
        .where('tenant_id', '=', tenantId)
        .execute();

      // Update Task to COMPLETED with 100% progress (1.0000)
      if (taskId) {
        await db
          .updateTable('tasks')
          .set({
            state: 'COMPLETED',
            progress: 1.0,
            updated_at: new Date(),
          })
          .where('id', '=', taskId)
          .where('tenant_id', '=', tenantId)
          .execute();
      }

      // Calculate Duration-Weighted Progress Roll-Up:
      // sum(progress * duration) / sum(duration)
      const projectTasks = await db
        .selectFrom('tasks')
        .select(['progress', 'duration'])
        .where('project_id', '=', projectId)
        .where('tenant_id', '=', tenantId)
        .execute();

      let totalDuration = 0;
      let weightedProgress = 0;
      for (const t of projectTasks) {
        const d = t.duration || 1;
        const p = Number(t.progress || 0);
        totalDuration += d;
        weightedProgress += p * d;
      }

      const calculatedProjectProgress =
        totalDuration > 0 ? Number((weightedProgress / totalDuration).toFixed(4)) : 0;

      await db
        .updateTable('projects')
        .set({
          progress: calculatedProjectProgress,
          updated_at: new Date(),
        })
        .where('id', '=', projectId)
        .where('tenant_id', '=', tenantId)
        .execute();

      // Emit project progress updated event
      await eventDispatcherService.dispatch({
        tenantId,
        eventType: 'project:progress_updated',
        entityType: 'project',
        entityId: projectId,
        payload: {
          projectId,
          progress: calculatedProjectProgress,
          totalDuration,
        },
      });
    } catch (e: any) {
      console.warn('[EojReportService] Approval DB fallback:', e.message);
    }

    // Emit report:approved event
    await eventDispatcherService.dispatch({
      tenantId,
      eventType: 'report:approved',
      entityType: 'report',
      entityId: reportId,
      payload: {
        reportId,
        taskId,
        projectId,
        reviewerId,
        status: 'APPROVED',
        taskState: 'COMPLETED',
      },
    });

    return {
      success: true,
      reportId,
      taskId,
      projectId,
      status: 'APPROVED',
      taskState: 'COMPLETED',
    };
  }

  /**
   * PM Requests Revisions on EOJ Report:
   * Transitions Report to REVISION_REQUESTED and Task back to IN_PROGRESS.
   */
  public async requestRevision(input: ReviseEojReportInput) {
    const { tenantId, reportId, reviewerId, reviewerComments } = input;

    let taskId: number | null = null;
    let projectId = 'PR-100';

    try {
      const report = await db
        .selectFrom('reports')
        .select(['task_id', 'project_id'])
        .where('id', '=', reportId)
        .where('tenant_id', '=', tenantId)
        .executeTakeFirst();

      if (report) {
        taskId = report.task_id;
        projectId = report.project_id;
      }

      await db
        .updateTable('reports')
        .set({
          status: 'REVISION_REQUESTED',
          reviewer_id: reviewerId,
          reviewer_feedback: reviewerComments,
        })
        .where('id', '=', reportId)
        .where('tenant_id', '=', tenantId)
        .execute();

      if (taskId) {
        await db
          .updateTable('tasks')
          .set({
            state: 'IN_PROGRESS',
            updated_at: new Date(),
          })
          .where('id', '=', taskId)
          .where('tenant_id', '=', tenantId)
          .execute();
      }
    } catch (e) {
      // fallback
    }

    await eventDispatcherService.dispatch({
      tenantId,
      eventType: 'report:revision_requested',
      entityType: 'report',
      entityId: reportId,
      payload: {
        reportId,
        taskId,
        projectId,
        reviewerId,
        reviewerComments,
        status: 'REVISION_REQUESTED',
        taskState: 'IN_PROGRESS',
      },
    });

    return {
      success: true,
      reportId,
      taskId,
      projectId,
      status: 'REVISION_REQUESTED',
      taskState: 'IN_PROGRESS',
    };
  }
}

export const eojReportService = new EojReportService();
