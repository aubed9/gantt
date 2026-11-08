// apps/rpm_v1/src/main.js
// Production application entry point for rpm_V1 — Variant B (Task Claim & Resource Board) with Live SSE Binder
import { emit } from './emit.js';
import { getFreshDataset } from './mock_data.js';
import { renderVariantB } from './components/variant_b.js';

// Application State Store
const appState = getFreshDataset();
let activeGanttInstance = null;
let activeSseStore = null;

const rootElement = document.getElementById('app');

function cleanupActiveInstance() {
  if (activeSseStore) {
    try {
      activeSseStore.disconnect();
    } catch (e) {
      // ignore
    }
    activeSseStore = null;
  }

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
  cleanupActiveInstance();
  rootElement.innerHTML = '';
  const result = renderVariantB(rootElement, appState);
  activeGanttInstance = result.gantt;
  activeSseStore = result.sseStore;
  emit.signal('gantt:rendered', { layout: 'VariantB-TaskClaimBoard-SSE' });
}

// Mount the winning Variant B layout with live SSE binder
mountApplication();
