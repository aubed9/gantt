// apps/rpm_v1/src/main.js
// Production application entry point for rpm_V1 — Variant B (Task Claim & Resource Board)
import { emit } from './emit.js';
import { getFreshDataset } from './mock_data.js';
import { renderVariantB } from './components/variant_b.js';

// Application State Store
const appState = getFreshDataset();
let activeGanttInstance = null;

const rootElement = document.getElementById('app');

function cleanupActiveGantt() {
  if (activeGanttInstance) {
    try {
      activeGanttInstance.clearAll();
    } catch (e) {
      // ignore
    }
    activeGanttInstance = null;
  }
}

function mountApplication() {
  cleanupActiveGantt();
  rootElement.innerHTML = '';
  activeGanttInstance = renderVariantB(rootElement, appState, () => {
    mountApplication();
  });
  emit.signal('gantt:rendered', { layout: 'VariantB-TaskClaimBoard' });
}

// Mount the winning Variant B layout
mountApplication();
