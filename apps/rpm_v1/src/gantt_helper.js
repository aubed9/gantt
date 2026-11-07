// apps/rpm_v1/src/gantt_helper.js
import { Gantt } from '../../../codebase/dhtmlxgantt.es.js';
import {
  setupJalaliScaleUnits,
  registerJalaliGridEditor,
  registerJalaliLightboxBlock,
  localeFaJalali,
  toJalaali,
  persianMonthNames,
  toPersianDigits
} from './jalali_adapter.js';

export function createRpmGanttInstance(containerNode) {
  const gantt = Gantt.getGanttInstance();

  // 1. Locale
  gantt.i18n.addLocale('fa_jalali', localeFaJalali);
  gantt.i18n.setLocale('fa_jalali');

  // 2. Register custom Jalali scales and form blocks
  setupJalaliScaleUnits(gantt);
  registerJalaliGridEditor(gantt);
  registerJalaliLightboxBlock(gantt);

  // 3. Core RTL Configuration
  gantt.config.rtl = true;
  gantt.config.scale_height = 60;
  gantt.config.row_height = 38;
  gantt.config.fit_tasks = true;
  gantt.config.round_dnd_dates = true;
  gantt.config.date_format = '%Y-%m-%d %H:%i';

  // 4. Right-docked Grid Layout
  gantt.config.layout = {
    css: 'gantt_container',
    rows: [
      {
        cols: [
          { view: 'scrollbar', id: 'scrollVer' },
          { view: 'timeline', scrollX: 'scrollHor', scrollY: 'scrollVer' },
          { resizer: true, width: 1 },
          { view: 'grid', scrollX: 'scrollHor', scrollY: 'scrollVer' }
        ]
      },
      { view: 'scrollbar', id: 'scrollHor', height: 18 }
    ]
  };

  // 5. Scales
  gantt.config.scales = [
    {
      unit: 'jalali_year',
      step: 1,
      format: function(date) {
        const { jy } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
        return 'سال ' + toPersianDigits(jy);
      }
    },
    {
      unit: 'jalali_month',
      step: 1,
      format: function(date) {
        const { jm } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
        return persianMonthNames[jm - 1];
      }
    }
  ];

  // 6. Templates
  gantt.templates.date_grid = function(date) {
    if (!date) return '';
    const { jy, jm, jd } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
  };

  gantt.templates.task_class = function(start, end, task) {
    return 'task-state-' + (task.state ? task.state.toLowerCase() : 'default');
  };

  gantt.templates.progress_text = function(start, end, task) {
    const pct = Math.round((task.progress || 0) * 100);
    return `<span style="font-size:11px;font-weight:600;">${toPersianDigits(pct)}٪</span>`;
  };

  // 7. Lightbox RTL
  gantt.attachEvent('onLightbox', function() {
    const box = gantt.getLightbox();
    if (box) {
      box.classList.add('gantt_cal_light_rtl');
      box.setAttribute('dir', 'rtl');
    }
  });

  // 8. Lightbox sections
  gantt.config.lightbox.sections = [
    { name: 'description', height: 60, map_to: 'text', type: 'textarea', focus: true },
    { name: 'type', type: 'typeselect', map_to: 'type' },
    { name: 'time', type: 'jalali_time', map_to: 'auto' }
  ];

  return gantt;
}
