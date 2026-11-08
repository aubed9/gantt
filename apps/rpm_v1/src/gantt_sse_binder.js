// apps/rpm_v1/src/gantt_sse_binder.js
// Surgical, Non-Destructive DHTMLX Gantt SSE Binder for rpm_V1
import { emit } from './emit.js';

export function calculateProjectProgressRollup(gantt, parentId) {
  if (!gantt) return 0;
  
  let totalDuration = 0;
  let weightedProgressSum = 0;

  // Iterate over child tasks of parentId
  gantt.eachTask((task) => {
    if (task.parent === parentId || (String(task.parent) === String(parentId))) {
      const duration = Number(task.duration) || 1;
      const progress = Number(task.progress) || 0;
      totalDuration += duration;
      weightedProgressSum += (duration * progress);
    }
  }, parentId);

  if (totalDuration === 0) return 0;
  const rollup = Math.round((weightedProgressSum / totalDuration) * 100) / 100;
  return rollup;
}

export function bindGanttToSse(gantt, state, sseStore, onUiPatch) {
  const metrics = {
    fullDomReRenderCount: 0,
    fineGrainedUpdateCount: 0,
    lastUpdatedTaskId: null,
    projectRollupProgress: 0.68
  };

  // Helper to safely find task in Gantt store
  const getGanttTask = (taskId) => {
    try {
      if (gantt.isTaskExists(taskId)) {
        return gantt.getTask(taskId);
      }
    } catch (e) {
      // fallback
    }
    return null;
  };

  // 1. Task Claim Created
  sseStore.on('task_claim:created', (payload) => {
    const taskId = Number(payload.task_id || payload.taskId);
    const task = getGanttTask(taskId);
    if (task) {
      if (task.state === 'OPEN_FOR_CLAIM') {
        task.state = 'CLAIM_REVIEW';
      }
      task.claims = task.claims || [];
      const newClaim = {
        id: payload.claim_id || `CLM-${Date.now()}`,
        human_id: payload.human_id,
        human_name: payload.human_name || payload.human_id,
        match_score: payload.match_score || '۸۵٪',
        workload: payload.workload || '۱ وظیفه فعال',
        prior_eoj_rating: payload.prior_eoj_rating || 'عالی',
        status: 'PENDING'
      };
      task.claims.push(newClaim);

      gantt.updateTask(taskId);
      metrics.fineGrainedUpdateCount++;
      metrics.lastUpdatedTaskId = taskId;
      emit.signal('gantt:task_updated', { taskId, state: task.state, fineGrained: true });
    }

    if (typeof onUiPatch === 'function') {
      onUiPatch('task_claim:created', payload, metrics);
    }
  });

  // 2. Task Claim Approved (ADR 0001)
  sseStore.on('task_claim:approved', (payload) => {
    const taskId = Number(payload.task_id || payload.taskId);
    const task = getGanttTask(taskId);
    if (task) {
      task.state = 'ASSIGNED';
      task.assignee_id = payload.human_id;
      task.assignee_name = payload.human_name || payload.human_id;

      if (task.claims) {
        task.claims.forEach(c => {
          if (c.id === payload.claim_id || c.human_id === payload.human_id) {
            c.status = 'APPROVED';
          } else {
            c.status = 'REJECTED';
          }
        });
      }

      // Surgical DOM update: updates only this row & timeline bar
      gantt.updateTask(taskId);
      metrics.fineGrainedUpdateCount++;
      metrics.lastUpdatedTaskId = taskId;
      emit.signal('task:assigned', { taskId, humanId: payload.human_id });
      emit.signal('gantt:task_updated', { taskId, state: 'ASSIGNED', fineGrained: true });
    }

    if (typeof onUiPatch === 'function') {
      onUiPatch('task_claim:approved', payload, metrics);
    }
  });

  // 3. EOJ Report Submitted (ADR 0002)
  sseStore.on('report:submitted', (payload) => {
    const taskId = Number(payload.task_id || payload.taskId);
    const task = getGanttTask(taskId);
    if (task) {
      task.state = 'IN_REVIEW';
      gantt.updateTask(taskId);
      metrics.fineGrainedUpdateCount++;
      metrics.lastUpdatedTaskId = taskId;
      emit.signal('gantt:task_updated', { taskId, state: 'IN_REVIEW', fineGrained: true });
    }

    if (typeof onUiPatch === 'function') {
      onUiPatch('report:submitted', payload, metrics);
    }
  });

  // 4. EOJ Report Approved -> 100% Progress & Project Progress Rollup
  sseStore.on('report:approved', (payload) => {
    const taskId = Number(payload.task_id || payload.taskId);
    const task = getGanttTask(taskId);
    if (task) {
      task.state = 'COMPLETED';
      task.progress = 1.0;
      gantt.updateTask(taskId);
      metrics.fineGrainedUpdateCount++;
      metrics.lastUpdatedTaskId = taskId;

      // Calculate and update duration-weighted roll-up on parent project
      const parentId = task.parent || 100;
      const projectTask = getGanttTask(parentId);
      if (projectTask) {
        const rollupProgress = calculateProjectProgressRollup(gantt, parentId);
        projectTask.progress = rollupProgress;
        metrics.projectRollupProgress = rollupProgress;
        gantt.updateTask(parentId);
        metrics.fineGrainedUpdateCount++;
        emit.signal('gantt:progress_rolled_up', { parentId, progress: rollupProgress });
      }

      emit.signal('eoj:approved', { taskId, reportId: payload.report_id });
      emit.signal('gantt:task_updated', { taskId, state: 'COMPLETED', fineGrained: true });
    }

    if (typeof onUiPatch === 'function') {
      onUiPatch('report:approved', payload, metrics);
    }
  });

  // 5. Gregorian Date Shift Invariant Test
  sseStore.on('task:dates_updated', (payload) => {
    const taskId = Number(payload.task_id || payload.taskId);
    const task = getGanttTask(taskId);
    if (task) {
      // Invariant: start_date and end_date are kept as Gregorian dates / ISO strings
      if (payload.start_date) {
        task.start_date = new Date(payload.start_date);
      }
      if (payload.end_date) {
        task.end_date = new Date(payload.end_date);
      }
      if (payload.duration !== undefined) {
        task.duration = Number(payload.duration);
      }

      gantt.updateTask(taskId);
      metrics.fineGrainedUpdateCount++;
      metrics.lastUpdatedTaskId = taskId;
      emit.signal('gantt:task_updated', { taskId, datesUpdated: true, fineGrained: true });
    }

    if (typeof onUiPatch === 'function') {
      onUiPatch('task:dates_updated', payload, metrics);
    }
  });

  return metrics;
}
