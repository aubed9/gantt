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
      'task-status-badge'
    ],
    signals: [
      'variant:changed',
      'task:claimed',
      'task:assigned',
      'eoj:approved',
      'eoj:revision_requested',
      'gantt:rendered'
    ],
    stores: ['rpm_store']
  });
}
