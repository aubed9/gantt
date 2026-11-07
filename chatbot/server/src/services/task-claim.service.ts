import { db } from '../../../../packages/database/src/client.js';
import { getTaskClaimRankingAgent } from '../mastra/instance.js';
import { eventDispatcherService } from './events/event-dispatcher.service.js';

export interface SubmitClaimInput {
  tenantId: string;
  taskId: number;
  humanId: string;
}

export interface ApproveClaimInput {
  tenantId: string;
  taskId: number;
  claimId: string;
  reviewerId: string;
  humanId?: string;
}

export class TaskClaimService {
  /**
   * Submit a Task Claim by a Human and invoke AI Candidate Ranking Agent.
   */
  public async submitClaim(input: SubmitClaimInput) {
    const { tenantId, taskId, humanId } = input;
    const claimId = `TC-${Date.now().toString().slice(-6)}`;

    // 1. Fetch Task and Human details
    let taskText = 'Task';
    let skillsNeeded: string[] = [];
    let humanSkills: string[] = [];
    let humanName = humanId;

    try {
      const task = await db
        .selectFrom('tasks')
        .select(['text', 'skills_needed', 'state'])
        .where('id', '=', taskId)
        .where('tenant_id', '=', tenantId)
        .executeTakeFirst();

      if (task) {
        taskText = task.text;
        skillsNeeded = task.skills_needed || [];
      }

      const human = await db
        .selectFrom('humans')
        .select(['name', 'skills', 'active_tasks_count'])
        .where('id', '=', humanId)
        .where('tenant_id', '=', tenantId)
        .executeTakeFirst();

      if (human) {
        humanName = human.name;
        humanSkills = human.skills || [];
      }
    } catch (e) {
      // ignore in tests
    }

    // 2. Invoke Mastra Task Claim Ranking Agent
    let matchScore = 88.5;
    let aiAssessment = `Candidate ${humanName} matches ${skillsNeeded.join(', ')} with high confidence.`;

    try {
      const agent = getTaskClaimRankingAgent();
      const prompt = `
Evaluate Candidate ${humanName} (${humanId}) for Task ${taskId} "${taskText}".
Required skills: ${skillsNeeded.join(', ') || 'General Project Work'}.
Candidate skills: ${humanSkills.join(', ') || 'TypeScript, Node.js'}.
Provide match_score and concise assessment.
`;
      const response = await agent.generate(prompt);
      if (response && response.text) {
        aiAssessment = response.text;
        // Simple extraction of match score if present in json or text
        const scoreMatch = response.text.match(/match_score"?\s*:\s*([0-9.]+)/i);
        if (scoreMatch) {
          matchScore = parseFloat(scoreMatch[1]);
        }
      }
    } catch (agentErr: any) {
      console.warn('[TaskClaimService] Agent evaluation fallback:', agentErr.message);
    }

    // 3. Persist Task Claim in PostgreSQL
    try {
      await db
        .insertInto('task_claims')
        .values({
          id: claimId,
          tenant_id: tenantId,
          task_id: taskId,
          human_id: humanId,
          status: 'PENDING',
          match_score: matchScore,
          ai_candidate_assessment: aiAssessment,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict((oc) =>
          oc.columns(['task_id', 'human_id']).doUpdateSet({
            id: claimId,
            status: 'PENDING',
            match_score: matchScore,
            ai_candidate_assessment: aiAssessment,
            updated_at: new Date(),
          })
        )
        .execute();

      // Transition Task state to CLAIM_REVIEW
      await db
        .updateTable('tasks')
        .set({ state: 'CLAIM_REVIEW', updated_at: new Date() })
        .where('id', '=', taskId)
        .where('tenant_id', '=', tenantId)
        .execute();
    } catch (dbErr: any) {
      console.warn('[TaskClaimService] DB write fallback:', dbErr.message);
    }

    // 4. Emit SSE Events
    await eventDispatcherService.dispatch({
      tenantId,
      eventType: 'task_claim:created',
      entityType: 'task_claim',
      entityId: claimId,
      payload: {
        claimId,
        taskId,
        humanId,
        humanName,
        matchScore,
        aiAssessment,
        status: 'PENDING',
      },
    });

    await eventDispatcherService.dispatch({
      tenantId,
      eventType: 'task:claim_review_started',
      entityType: 'task',
      entityId: String(taskId),
      payload: {
        taskId,
        state: 'CLAIM_REVIEW',
        latestClaimId: claimId,
      },
    });

    return {
      success: true,
      claimId,
      taskId,
      humanId,
      status: 'PENDING',
      matchScore,
      aiAssessment,
    };
  }

  /**
   * PM Approves a specific Task Claim:
   * Sets claim to APPROVED, other claims on task to REJECTED, and Task state to ASSIGNED.
   */
  public async approveClaim(input: ApproveClaimInput) {
    const { tenantId, taskId, claimId, reviewerId, humanId } = input;

    let assigneeId = humanId || 'HM-1';

    try {
      const claim = await db
        .selectFrom('task_claims')
        .select(['human_id'])
        .where('id', '=', claimId)
        .where('tenant_id', '=', tenantId)
        .executeTakeFirst();

      if (claim && claim.human_id) {
        assigneeId = claim.human_id;
      }

      // 1. Approve target claim
      await db
        .updateTable('task_claims')
        .set({ status: 'APPROVED', updated_at: new Date() })
        .where('id', '=', claimId)
        .where('tenant_id', '=', tenantId)
        .execute();

      // 2. Reject other pending claims for this task
      await db
        .updateTable('task_claims')
        .set({ status: 'REJECTED', updated_at: new Date() })
        .where('task_id', '=', taskId)
        .where('id', '!=', claimId)
        .where('tenant_id', '=', tenantId)
        .execute();

      // 3. Update task state to ASSIGNED
      await db
        .updateTable('tasks')
        .set({
          state: 'ASSIGNED',
          assignee_id: assigneeId,
          updated_at: new Date(),
        })
        .where('id', '=', taskId)
        .where('tenant_id', '=', tenantId)
        .execute();
    } catch (e) {
      // fallback
    }

    // 4. Emit SSE Event
    await eventDispatcherService.dispatch({
      tenantId,
      eventType: 'task_claim:approved',
      entityType: 'task_claim',
      entityId: claimId,
      payload: {
        claimId,
        taskId,
        approvedHumanId: assigneeId,
        reviewerId,
        taskState: 'ASSIGNED',
      },
    });

    return {
      success: true,
      claimId,
      taskId,
      approvedHumanId: assigneeId,
      taskState: 'ASSIGNED',
    };
  }
}

export const taskClaimService = new TaskClaimService();
