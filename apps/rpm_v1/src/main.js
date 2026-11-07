// apps/rpm_v1/src/main.js
import { emit } from './emit.js';
import { getFreshDataset } from './mock_data.js';
import { initVariantSwitcher } from './components/switcher.js';
import { renderVariantA } from './components/variant_a.js';
import { renderVariantB } from './components/variant_b.js';
import { renderVariantC } from './components/variant_c.js';

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

function renderCurrentView(variantKey) {
  cleanupActiveGantt();
  rootElement.innerHTML = '';

  if (variantKey === 'A') {
    activeGanttInstance = renderVariantA(rootElement, appState);
  } else if (variantKey === 'B') {
    activeGanttInstance = renderVariantB(rootElement, appState, () => {
      renderCurrentView('B');
    });
  } else if (variantKey === 'C') {
    activeGanttInstance = renderVariantC(rootElement, appState, () => {
      renderCurrentView('C');
    });
  }

  emit.signal('gantt:rendered', { variant: variantKey });
}

// Initialize Switcher
const switcher = initVariantSwitcher((newVariant) => {
  renderCurrentView(newVariant);
});

// Initial Render
const initialVariant = switcher.getCurrentVariant();
renderCurrentView(initialVariant);
