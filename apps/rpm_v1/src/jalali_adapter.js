// apps/rpm_v1/src/jalali_adapter.js
// Astronomical Jalali calendar integration using jalaali-js and DHTMLX Gantt extension seams
import * as jalaali from 'jalaali-js';

export const toJalaali = jalaali.toJalaali;
export const toGregorian = jalaali.toGregorian;
export const isLeapJalaaliYear = jalaali.isLeapJalaaliYear;
export const jalaaliMonthLength = jalaali.jalaaliMonthLength;

export function toPersianDigits(str) {
  if (str === null || str === undefined) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

export const persianMonthNames = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const persianDayNames = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'
];

export const localeFaJalali = {
  date: {
    month_full: persianMonthNames,
    month_short: persianMonthNames,
    day_full: persianDayNames,
    day_short: ['۱ش', '۲ش', '۳ش', '۴ش', '۵ش', 'ج', 'ش']
  },
  labels: {
    new_task: 'وظیفه جدید',
    icon_save: 'ذخیره',
    icon_cancel: 'انصراف',
    icon_details: 'جزئیات',
    icon_edit: 'ویرایش',
    icon_delete: 'حذف',
    confirm_closing: 'تغییرات ذخیره نشده از دست خواهد رفت، آیا مطمئنید؟',
    confirm_deleting: 'آیا از حذف این مورد اطمینان دارید؟',
    section_description: 'شرح وظیفه',
    section_time: 'بازه زمانی (شمسی)',
    section_type: 'نوع موجودیت',
    column_wbs: 'WBS',
    column_text: 'عنوان وظیفه',
    column_start_date: 'تاریخ شروع',
    column_duration: 'مدت (روز)',
    column_add: ''
  }
};

export function setupJalaliScaleUnits(gantt) {
  // Saturday week start: In JS, Saturday is 6.
  gantt.date.week_start = function(date) {
    const shift = (date.getDay() + 1) % 7;
    return gantt.date.add(date, -shift, 'day');
  };

  // jalali_month start: round back to Farvardin 1 or current Jalali month 1
  gantt.date.jalali_month_start = function(date) {
    const { jy, jm } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const gStart = toGregorian(jy, jm, 1);
    return new Date(gStart.gy, gStart.gm - 1, gStart.gd, 0, 0, 0);
  };

  // add jalali_month
  gantt.date.add_jalali_month = function(date, step) {
    const { jy, jm, jd } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    let totalMonths = (jy * 12) + (jm - 1) + step;
    let newJy = Math.floor(totalMonths / 12);
    let newJm = (totalMonths % 12) + 1;
    let maxDays = jalaaliMonthLength(newJy, newJm);
    let newJd = Math.min(jd, maxDays);
    const gTarget = toGregorian(newJy, newJm, newJd);
    return new Date(gTarget.gy, gTarget.gm - 1, gTarget.gd, date.getHours(), date.getMinutes(), date.getSeconds());
  };

  // jalali_year start
  gantt.date.jalali_year_start = function(date) {
    const { jy } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const gStart = toGregorian(jy, 1, 1);
    return new Date(gStart.gy, gStart.gm - 1, gStart.gd, 0, 0, 0);
  };

  gantt.date.add_jalali_year = function(date, step) {
    const { jy, jm, jd } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    let newJy = jy + step;
    let maxDays = jalaaliMonthLength(newJy, jm);
    let newJd = Math.min(jd, maxDays);
    const gTarget = toGregorian(newJy, jm, newJd);
    return new Date(gTarget.gy, gTarget.gm - 1, gTarget.gd, date.getHours(), date.getMinutes(), date.getSeconds());
  };
}

export function registerJalaliGridEditor(gantt) {
  gantt.config.editor_types.jalali_date = {
    show: function(id, column, config, placeholder) {
      const task = gantt.getTask(id);
      const curDate = task[column.name] || new Date();
      const { jy, jm, jd } = toJalaali(curDate.getFullYear(), curDate.getMonth() + 1, curDate.getDate());
      const formatted = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
      placeholder.innerHTML = `<input type="text" dir="ltr" class="jalali-editor-input" value="${formatted}" style="width:100%;text-align:center;padding:4px;" />`;
    },
    hide: function() {},
    set_value: function(value, id, column, node) {
      const input = node.querySelector('input');
      if (input) input.value = value;
    },
    get_value: function(id, column, node) {
      const input = node.querySelector('input');
      if (!input) return new Date();
      const parts = input.value.split(/[-/]/).map(Number);
      if (parts.length === 3 && parts[0] > 1300 && parts[1] >= 1 && parts[1] <= 12 && parts[2] >= 1 && parts[2] <= 31) {
        const { gy, gm, gd } = toGregorian(parts[0], parts[1], parts[2]);
        return new Date(gy, gm - 1, gd);
      }
      return gantt.getTask(id)[column.name] || new Date();
    },
    is_changed: function(value, id, column, node) {
      return true;
    }
  };
}

export function registerJalaliLightboxBlock(gantt) {
  gantt.form_blocks.jalali_time = {
    render: function(sns) {
      return `
        <div class="gantt_time_jalali_block" dir="rtl" style="display:flex;gap:8px;align-items:center;padding:8px 0;">
          <span>شروع:</span>
          <select class="j_day" style="padding:4px 8px;border-radius:4px;border:1px solid #ccc;"></select>
          <select class="j_month" style="padding:4px 8px;border-radius:4px;border:1px solid #ccc;"></select>
          <select class="j_year" style="padding:4px 8px;border-radius:4px;border:1px solid #ccc;"></select>
        </div>
      `;
    },
    set_value: function(node, value, task, section) {
      const d = task.start_date || new Date();
      const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());

      const selDay = node.querySelector('.j_day');
      const selMonth = node.querySelector('.j_month');
      const selYear = node.querySelector('.j_year');

      selDay.innerHTML = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === jd ? 'selected' : ''}>${toPersianDigits(i + 1)}</option>`).join('');
      selMonth.innerHTML = persianMonthNames.map((name, i) => `<option value="${i + 1}" ${i + 1 === jm ? 'selected' : ''}>${name}</option>`).join('');
      selYear.innerHTML = [1402, 1403, 1404, 1405, 1406].map(y => `<option value="${y}" ${y === jy ? 'selected' : ''}>${toPersianDigits(y)}</option>`).join('');
    },
    get_value: function(node, task, section) {
      const jy = parseInt(node.querySelector('.j_year').value, 10);
      const jm = parseInt(node.querySelector('.j_month').value, 10);
      const jd = parseInt(node.querySelector('.j_day').value, 10);
      const { gy, gm, gd } = toGregorian(jy, jm, jd);
      task.start_date = new Date(gy, gm - 1, gd);
      task.end_date = gantt.date.add(task.start_date, task.duration || 1, 'day');
      return task.start_date;
    },
    focus: function(node) {
      const sel = node.querySelector('.j_day');
      if (sel) sel.focus();
    }
  };
}
