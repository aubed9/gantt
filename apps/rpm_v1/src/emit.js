// apps/rpm_v1/src/emit.js
import { createReticleEmitter, reticle, registerCapabilities } from '@reticlehq/browser';

export const emit = createReticleEmitter();

// Dev-gated Reticle initialization
if (typeof window !== 'undefined') {
  reticle.connect({
    token: 'a30106c10bb9b712c222d4173f4de6c4f9ee30cc487a8733'
  });

  registerCapabilities({
    testids: [
      'rpm-app',
      'variant-switcher',
      'variant-label',
      'variant-prev',
      'variant-next',
      'gantt-container',
      'kpi-metrics',
      'executive-summary-card',
      'claim-board',
      'claim-task-item',
      'btn-submit-claim',
      'btn-approve-claim',
      'eoj-inspector',
      'btn-approve-eoj',
      'btn-request-revision',
      'task-status-badge',
      // Real-time SSE Monitor Testids
      'sse-monitor-banner',
      'sse-status',
      'metric-dom-rerenders',
      'metric-task-updates',
      'metric-project-progress',
      'btn-sse-claim-approve',
      'btn-sse-eoj-submit',
      'btn-sse-eoj-approve',
      'btn-sse-date-shift',
      'sse-log-drawer'
    ],
    signals: [
      'variant:changed',
      'task:claimed',
      'task:assigned',
      'eoj:approved',
      'eoj:revision_requested',
      'gantt:rendered',
      // Real-time SSE & Surgical Gantt Signals
      'sse:connected',
      'sse:event_received',
      'sse:status_changed',
      'gantt:task_updated',
      'gantt:progress_rolled_up',
      'gantt:dates_shifted'
    ],
    stores: ['rpm_store', 'sse_event_store']
  });
}
