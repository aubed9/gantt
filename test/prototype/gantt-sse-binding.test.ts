import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SseEventStore } from '../../apps/rpm_v1/src/sse_store.js';
import { bindGanttToSse, calculateProjectProgressRollup } from '../../apps/rpm_v1/src/gantt_sse_binder.js';

describe('Real-Time SSE Event Store & Gantt Surgical Binding (Issue #20)', () => {
  describe('SseEventStore', () => {
    let store: SseEventStore;

    beforeEach(() => {
      store = new SseEventStore({
        tenantId: 'TN-1',
        autoReconnect: false,
        useSimulatorFallback: true
      });
    });

    it('should register listeners and dispatch typed domain events', () => {
      const handler = vi.fn();
      store.on('task_claim:approved', handler);

      store.dispatch({
        id: 101,
        type: 'task_claim:approved',
        payload: { task_id: 105, human_id: 'HM-1' }
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        { task_id: 105, human_id: 'HM-1' },
        expect.objectContaining({ id: 101, type: 'task_claim:approved' })
      );
      expect(store.lastEventId).toBe(101);
    });

    it('should notify wildcard listeners on any event', () => {
      const wildcard = vi.fn();
      store.on('*', wildcard);

      store.dispatch({ id: 102, type: 'report:submitted', payload: { task_id: 105 } });
      store.dispatch({ id: 103, type: 'report:approved', payload: { task_id: 105 } });

      expect(wildcard).toHaveBeenCalledTimes(2);
      expect(store.eventLog.length).toBe(2);
    });

    it('should track connection status transitions', () => {
      const statusSpy = vi.fn();
      store.on('status_change', statusSpy);

      store.setStatus('CONNECTING');
      store.setStatus('CONNECTED');

      expect(statusSpy).toHaveBeenCalledWith('CONNECTING');
      expect(statusSpy).toHaveBeenCalledWith('CONNECTED');
      expect(store.status).toBe('CONNECTED');
    });
  });

  describe('Duration-Weighted Project Progress Rollup', () => {
    it('should accurately calculate duration-weighted project progress', () => {
      const mockGantt: any = {
        eachTask: vi.fn((callback, parentId) => {
          // Child Task 1: 10 days, 50% completed (5 weighted days)
          callback({ id: 101, parent: parentId, duration: 10, progress: 0.5 });
          // Child Task 2: 20 days, 100% completed (20 weighted days)
          callback({ id: 102, parent: parentId, duration: 20, progress: 1.0 });
          // Child Task 3: 10 days, 0% completed (0 weighted days)
          callback({ id: 103, parent: parentId, duration: 10, progress: 0.0 });
        })
      };

      // Total duration = 40 days. Total weighted progress = 5 + 20 + 0 = 25 days.
      // Expected rollup = 25 / 40 = 0.625 -> 0.63
      const rollup = calculateProjectProgressRollup(mockGantt, 100);
      expect(rollup).toBe(0.63);
    });
  });

  describe('bindGanttToSse Surgical DOM Updates', () => {
    let mockTasks: Map<number, any>;
    let mockGantt: any;
    let sseStore: SseEventStore;

    beforeEach(() => {
      mockTasks = new Map();
      mockTasks.set(100, {
        id: 100,
        text: 'Core Platform Project',
        type: 'project',
        progress: 0.5,
        duration: 30
      });
      mockTasks.set(105, {
        id: 105,
        parent: 100,
        text: 'Task Claim & EOJ System',
        state: 'OPEN_FOR_CLAIM',
        assignee_id: null,
        progress: 0.0,
        duration: 10,
        claims: []
      });
      mockTasks.set(106, {
        id: 106,
        parent: 100,
        text: 'RTL Jalali Gantt Timeline',
        state: 'IN_PROGRESS',
        start_date: new Date('2026-11-10T08:00:00Z'),
        end_date: new Date('2026-11-17T17:00:00Z'),
        duration: 7
      });

      mockGantt = {
        isTaskExists: vi.fn((id) => mockTasks.has(Number(id))),
        getTask: vi.fn((id) => mockTasks.get(Number(id))),
        updateTask: vi.fn(),
        clearAll: vi.fn(), // Should NEVER be called during live updates!
        eachTask: vi.fn((callback, parentId) => {
          for (const task of mockTasks.values()) {
            if (task.parent === parentId) {
              callback(task);
            }
          }
        })
      };

      sseStore = new SseEventStore({ autoReconnect: false });
    });

    it('should surgically update task on task_claim:approved without calling clearAll', () => {
      const onUiPatch = vi.fn();
      const metrics = bindGanttToSse(mockGantt, {}, sseStore, onUiPatch);

      sseStore.dispatch({
        id: 201,
        type: 'task_claim:approved',
        payload: {
          task_id: 105,
          claim_id: 'CLM-01',
          human_id: 'HM-1',
          human_name: 'رضا حسینی'
        }
      });

      const task105 = mockTasks.get(105);
      expect(task105.state).toBe('ASSIGNED');
      expect(task105.assignee_id).toBe('HM-1');
      expect(task105.assignee_name).toBe('رضا حسینی');

      // Assert surgical update: gantt.updateTask called, gantt.clearAll never called
      expect(mockGantt.updateTask).toHaveBeenCalledWith(105);
      expect(mockGantt.clearAll).not.toHaveBeenCalled();
      expect(metrics.fullDomReRenderCount).toBe(0);
      expect(metrics.fineGrainedUpdateCount).toBe(1);
      expect(onUiPatch).toHaveBeenCalledTimes(1);
    });

    it('should update state to IN_REVIEW on report:submitted', () => {
      bindGanttToSse(mockGantt, {}, sseStore);

      sseStore.dispatch({
        id: 202,
        type: 'report:submitted',
        payload: { task_id: 105, report_id: 'REP-1' }
      });

      const task105 = mockTasks.get(105);
      expect(task105.state).toBe('IN_REVIEW');
      expect(mockGantt.updateTask).toHaveBeenCalledWith(105);
      expect(mockGantt.clearAll).not.toHaveBeenCalled();
    });

    it('should mark task COMPLETED (100%) and roll up parent project progress on report:approved', () => {
      const metrics = bindGanttToSse(mockGantt, {}, sseStore);

      sseStore.dispatch({
        id: 203,
        type: 'report:approved',
        payload: { task_id: 105, report_id: 'REP-1' }
      });

      const task105 = mockTasks.get(105);
      expect(task105.state).toBe('COMPLETED');
      expect(task105.progress).toBe(1.0);

      // Verify parent project 100 had updateTask called with recalculated roll-up
      expect(mockGantt.updateTask).toHaveBeenCalledWith(105);
      expect(mockGantt.updateTask).toHaveBeenCalledWith(100);
      expect(mockGantt.clearAll).not.toHaveBeenCalled();
      expect(metrics.fineGrainedUpdateCount).toBe(2);
      expect(metrics.fullDomReRenderCount).toBe(0);
    });

    it('should preserve Pure Gregorian Timestamp Invariant on task:dates_updated', () => {
      const metrics = bindGanttToSse(mockGantt, {}, sseStore);

      const gregorianStart = '2026-11-13 08:00';
      const gregorianEnd = '2026-11-20 17:00';

      sseStore.dispatch({
        id: 204,
        type: 'task:dates_updated',
        payload: {
          task_id: 106,
          start_date: gregorianStart,
          end_date: gregorianEnd,
          duration: 7
        }
      });

      const task106 = mockTasks.get(106);
      expect(task106.start_date instanceof Date).toBe(true);
      expect(task106.duration).toBe(7);
      expect(mockGantt.updateTask).toHaveBeenCalledWith(106);
      expect(mockGantt.clearAll).not.toHaveBeenCalled();
      expect(metrics.fullDomReRenderCount).toBe(0);
    });
  });
});
