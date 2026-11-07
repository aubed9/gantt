// apps/rpm_v1/src/components/variant_c.js
import { createRpmGanttInstance } from '../gantt_helper.js';
import { toPersianDigits } from '../mock_data.js';
import { emit } from '../emit.js';

export function renderVariantC(container, state, onUpdate) {
  const eojTask = state.tasks.find(t => t.id === 104) || state.tasks[3];
  const eojReport = eojTask.eoj_report || {};

  container.innerHTML = `
    <div class="variant-c-layout" data-testid="variant-c-root" dir="rtl">
      <!-- Top Milestone & Event Banner -->
      <section class="milestone-banner" data-testid="milestone-board">
        <div class="event-card">
          <div class="event-tag">رویداد کلیدی (EV-201)</div>
          <h3>جلسه مرور اسپرینت ۱ و ارزیابی فنی فاز آلفا</h3>
          <p class="event-desc">بررسی یکپارچگی خطوط پردازش صوت، ذخیره‌سازی دانش در pgvector، و گانت RTL جلالی با حضور PM، PO و CTO.</p>
        </div>

        <div class="event-stats">
          <div class="stat-pill">
            <span class="stat-num">${toPersianDigits(state.tasks.filter(t => t.state === 'COMPLETED').length)} / ${toPersianDigits(state.tasks.filter(t => t.type !== 'project').length)}</span>
            <span class="stat-desc">وظایف تحویل‌شده</span>
          </div>
          <div class="stat-pill">
            <span class="stat-num text-warning">${eojTask.state === 'IN_REVIEW' ? '۱ گزارش' : '۰ گزارش'}</span>
            <span class="stat-desc">در انتظار بازبینی</span>
          </div>
        </div>
      </section>

      <!-- Main Layout: Gantt Timeline and EOJ Review Inspector -->
      <div class="split-workspace">
        <div class="timeline-area">
          <div class="area-header">
            <h4>نمودار مایلستون‌ها و وابستگی‌های وظایف</h4>
          </div>
          <div id="gantt-chart-container-c" class="gantt-embed" data-testid="gantt-container"></div>
        </div>

        <aside class="eoj-inspector-sidebar" data-testid="eoj-inspector">
          <div class="inspector-header">
            <span class="badge badge-warning">بازرسی گزارش پایان کار (EOJ)</span>
            <h4>بررسی مستندات تحویلی وظیفه #${eojTask.id}</h4>
          </div>

          <div class="eoj-card-content">
            <div class="field-group">
              <label>عنوان وظیفه:</label>
              <strong>${eojTask.text}</strong>
            </div>

            <div class="field-row">
              <div>
                <label>عضو تحویل‌دهنده:</label>
                <span>${eojReport.submitted_by || eojTask.assignee_name}</span>
              </div>
              <div>
                <label>تاریخ ثبت گزارش:</label>
                <span>${eojReport.submitted_at || '۱۴۰۵/۰۱/۲۲'}</span>
              </div>
            </div>

            <div class="field-group">
              <label>وضعیت وظیفه / گزارش:</label>
              <div class="badges-row">
                <span class="status-pill status-${eojTask.state.toLowerCase()}">${eojTask.state}</span>
                <span class="status-pill status-${(eojReport.status || 'SUBMITTED').toLowerCase()}">${eojReport.status || 'SUBMITTED'}</span>
              </div>
            </div>

            <div class="field-group">
              <label>اقلام تحویلی و نتایج کلیدی (Deliverables):</label>
              <ul class="deliverables-list">
                ${(eojReport.deliverables || [
                  'قطعه‌بندی با استراتژی Markdown در ۵۱۲ توکن',
                  'ایندکس HNSW و GIN',
                  'ابزار ترکیبی RAG و SQL'
                ]).map(d => `<li>✓ ${d}</li>`).join('')}
              </ul>
            </div>

            <div class="field-group">
              <label>ارزیابی خوداظهاری عضو و تحلیل احساسات Mastra:</label>
              <div class="ai-eval-box">
                <p><strong>امتیاز:</strong> ${eojReport.self_score || '۱۰۰٪ انطباق با معیارهای موفقیت'}</p>
                <p><strong>تحلیل هوش مصنوعی:</strong> ${eojReport.sentiment || 'تحویل کامل اسناد بدون باگ بحرانی'}</p>
              </div>
            </div>

            <!-- Review Actions per ADR 0002 -->
            <div class="review-actions-panel">
              ${eojTask.state === 'IN_REVIEW' ? `
                <button type="button" class="btn btn-success btn-block" data-testid="btn-approve-eoj">
                  ✓ تأیید گزارش پایان کار (تکمیل ۱۰۰٪)
                </button>
                <button type="button" class="btn btn-warning btn-block" data-testid="btn-request-revision">
                  ↺ درخواست اصلاح و تکمیل موارد نقص
                </button>
              ` : eojTask.state === 'COMPLETED' ? `
                <div class="approved-success-banner">
                  ✓ گزارش تایید شد و اسناد در پایگاه دانش pgvector ثبت گردیدند.
                </div>
              ` : `
                <div class="revision-requested-banner">
                  ↺ درخواست اصلاح ثبت شد؛ وظیفه به وضعیت در حال انجام بازگشت.
                </div>
              `}
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;

  // Gantt chart initialization
  const chartBox = container.querySelector('#gantt-chart-container-c');
  const gantt = createRpmGanttInstance(chartBox);

  gantt.config.columns = [
    { name: 'wbs', label: 'WBS', width: 45, align: 'center', template: gantt.getWBSCode },
    { name: 'text', label: 'عنوان وظیفه', tree: true, width: 230, resize: true },
    { name: 'duration', label: 'مدت', align: 'center', width: 60 },
    {
      name: 'progress',
      label: 'پیشرفت',
      align: 'center',
      width: 75,
      template: function(t) {
        return toPersianDigits(Math.round((t.progress || 0) * 100)) + '٪';
      }
    },
    {
      name: 'state',
      label: 'وضعیت',
      align: 'center',
      width: 105,
      template: function(t) {
        const stateLabels = {
          COMPLETED: '<span class="status-pill status-completed">تکمیل شده</span>',
          IN_PROGRESS: '<span class="status-pill status-in-progress">در حال انجام</span>',
          IN_REVIEW: '<span class="status-pill status-in-review">در انتظار بازبینی</span>',
          OPEN_FOR_CLAIM: '<span class="status-pill status-open">آماده تصاحب</span>',
          DRAFT: '<span class="status-pill status-draft">پیش‌نویس</span>'
        };
        return stateLabels[t.state] || t.state || '';
      }
    }
  ];

  gantt.init(chartBox);
  gantt.parse({
    data: state.tasks,
    links: state.links
  });

  // Attach button events
  const approveBtn = container.querySelector('[data-testid="btn-approve-eoj"]');
  if (approveBtn) {
    approveBtn.addEventListener('click', () => {
      // Per ADR 0002: approve marks report APPROVED, task COMPLETED with 100% progress
      eojTask.state = 'COMPLETED';
      eojTask.progress = 1.0;
      if (eojTask.eoj_report) {
        eojTask.eoj_report.status = 'APPROVED';
      }
      emit.signal('eoj:approved', { taskId: eojTask.id });
      if (typeof onUpdate === 'function') {
        onUpdate();
      }
    });
  }

  const revisionBtn = container.querySelector('[data-testid="btn-request-revision"]');
  if (revisionBtn) {
    revisionBtn.addEventListener('click', () => {
      // Per ADR 0002: revision returns task to IN_PROGRESS
      eojTask.state = 'IN_PROGRESS';
      eojTask.progress = 0.8;
      if (eojTask.eoj_report) {
        eojTask.eoj_report.status = 'REVISION_REQUESTED';
      }
      emit.signal('eoj:revision_requested', { taskId: eojTask.id });
      if (typeof onUpdate === 'function') {
        onUpdate();
      }
    });
  }

  return gantt;
}
