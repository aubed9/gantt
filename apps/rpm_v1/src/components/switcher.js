// apps/rpm_v1/src/components/switcher.js
import { emit } from '../emit.js';

export const VARIANTS = [
  { key: 'A', title: 'A (داشبورد مدیریتی و تایم‌لاین فشرده)' },
  { key: 'B', title: 'B (تابلوی تصاحب و تخصیص هوشمند اعضا)' },
  { key: 'C', title: 'C (تمرکز بر مایلستون‌ها و بازرسی EOJ)' }
];

export function initVariantSwitcher(onVariantChange) {
  let container = document.getElementById('variant-switcher-root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'variant-switcher-root';
    document.body.appendChild(container);
  }

  function getQueryVariant() {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('variant');
    return VARIANTS.some(item => item.key === v) ? v : 'A';
  }

  let currentKey = getQueryVariant();

  function render() {
    const currentVariant = VARIANTS.find(v => v.key === currentKey) || VARIANTS[0];

    container.innerHTML = `
      <div class="prototype-floating-switcher" data-testid="variant-switcher" dir="rtl">
        <button type="button" class="switch-btn" data-testid="variant-prev" title="طرح قبلی">
          <span style="display:inline-block;transform:rotate(180deg)">➔</span> قبلی
        </button>
        <div class="switch-label" data-testid="variant-label">
          <span class="badge">پروتوتایپ UI</span>
          <strong>${currentVariant.title}</strong>
        </div>
        <button type="button" class="switch-btn" data-testid="variant-next" title="طرح بعدی">
          بعدی ➔
        </button>
      </div>
    `;

    container.querySelector('[data-testid="variant-prev"]').addEventListener('click', () => {
      cycleVariant(-1);
    });

    container.querySelector('[data-testid="variant-next"]').addEventListener('click', () => {
      cycleVariant(1);
    });
  }

  function cycleVariant(direction) {
    const currentIndex = VARIANTS.findIndex(v => v.key === currentKey);
    const nextIndex = (currentIndex + direction + VARIANTS.length) % VARIANTS.length;
    setVariant(VARIANTS[nextIndex].key);
  }

  function setVariant(key) {
    if (key === currentKey) return;
    currentKey = key;
    const url = new URL(window.location);
    url.searchParams.set('variant', key);
    window.history.replaceState({}, '', url);

    render();
    emit.signal('variant:changed', { variant: key });
    if (typeof onVariantChange === 'function') {
      onVariantChange(key);
    }
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight') {
      cycleVariant(-1); // RTL right means previous in flow
    } else if (e.key === 'ArrowLeft') {
      cycleVariant(1); // RTL left means next in flow
    }
  });

  render();
  return {
    getCurrentVariant: () => currentKey,
    setVariant
  };
}
