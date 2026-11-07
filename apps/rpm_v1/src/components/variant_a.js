// apps/rpm_v1/src/components/variant_a.js
import { createRpmGanttInstance } from '../gantt_helper.js';
import { initialProject, toPersianDigits } from '../mock_data.js';

export function renderVariantA(container, state) {
  // Calculate duration-weighted progress per ADR 0002
  const leafTasks = state.tasks.filter(t => t.type !== 'project');
  const totalDuration = leafTasks.reduce((acc, t) => acc + (t.duration || 1), 0);
  const weightedProgress = leafTasks.reduce((acc, t) => acc + ((t.progress || 0) * (t.duration || 1)), 0);
  const overallPct = Math.round((weightedProgress / (totalDuration || 1)) * 100);

  const completedCount = leafTasks.filter(t => t.state === 'COMPLETED').length;
  const inReviewCount = leafTasks.filter(t => t.state === 'IN_REVIEW').length;
  const openClaimCount = leafTasks.filter(t => t.state === 'OPEN_FOR_CLAIM').length;

  container.innerHTML = `
    <div class="variant-a-layout" data-testid="variant-a-root" dir="rtl">
      <!-- Executive KPI Ribbon -->
      <header class="executive-kpi-ribbon" data-testid="kpi-metrics">
        <div class="project-identity">
          <span class="project-badge">پروژه فعال</span>
          <h2 class="project-title">${initialProject.name}</h2>
          <div class="project-governance">
            <span>مدیر پروژه (PM): ${initialProject.manager}</span> •
            <span>مالک محصول (PO): ${initialProject.owner}</span> •
            <span>مدیر ارشد فنی (CTO): ${initialProject.cto}</span>
          </div>
        </div>

        <div class="kpi-cards-grid">
          <div class="kpi-card" data-testid="kpi-progress">
            <span class="kpi-label">پیشرفت کل پروژه (وزن‌دار)</span>
            <div class="kpi-value-row">
              <strong class="kpi-value">${toPersianDigits(overallPct)}٪</strong>
              <div class="kpi-progress-bar">
                <div class="kpi-progress-fill" style="width: ${overallPct}%"></div>
              </div>
            </div>
            <span class="kpi-subtext">محاسبه خودکار بر اساس مدت وظایف</span>
          </div>

          <div class="kpi-card">
            <span class="kpi-label">وظایف تکمیل‌شده</span>
            <strong class="kpi-value text-success">${toPersianDigits(completedCount)} / ${toPersianDigits(leafTasks.length)}</strong>
            <span class="kpi-subtext">دارای گزارش پایانی EOJ تأیید شده</span>
          </div>

          <div class="kpi-card">
            <span class="kpi-label">در انتظار بررسی EOJ</span>
            <strong class="kpi-value text-warning">${toPersianDigits(inReviewCount)}</strong>
            <span class="kpi-subtext">آماده بازبینی و تایید PM</span>
          </div>

          <div class="kpi-card">
            <span class="kpi-label">آماده تصاحب اعضا</span>
            <strong class="kpi-value text-accent">${toPersianDigits(openClaimCount)}</strong>
            <span class="kpi-subtext">پنجره ثبت درخواست باز است</span>
          </div>
        </div>
      </header>

      <!-- Main Gantt View with AI Briefing Sidebar -->
      <div class="workspace-body">
        <div class="gantt-pane">
          <div class="pane-header">
            <h3>تایم‌لاین اجرایی و نمودار گانت (چیدمان راست‌به‌چپ با مقیاس خورشیدی)</h3>
            <span class="pane-note">قابلیت Drag & Drop دوطرفه و تغییر مدت زمان فعال است</span>
          </div>
          <div id="gantt-chart-container-a" class="gantt-embed" data-testid="gantt-container"></div>
        </div>

        <aside class="executive-summary-card" data-testid="executive-summary-card">
          <div class="card-header">
            <h4>خلاصه چرخشی Mastra Agent</h4>
            <span class="ai-badge">هوش مصنوعی</span>
          </div>
          <p class="summary-text">${initialProject.rollingSummaryFa}</p>
          <div class="summary-meta">
            <span>مدل زبانی: DeepSeek V4.1 Flash (AvalAI)</span>
            <span>بردارها: PostgreSQL 16 + pgvector</span>
          </div>
        </aside>
      </div>
    </div>
  `;

  // Initialize Gantt instance
  const chartBox = container.querySelector('#gantt-chart-container-a');
  const gantt = createRpmGanttInstance(chartBox);

  // Columns for Variant A
  gantt.config.columns = [
    { name: 'wbs', label: 'WBS', width: 45, align: 'center', template: gantt.getWBSCode },
    { name: 'text', label: 'عنوان وظیفه', tree: true, width: 230, resize: true },
    { name: 'start_date', label: 'تاریخ شروع (جلالی)', align: 'center', width: 105, resize: true },
    {
      name: 'state',
      label: 'وضعیت',
      align: 'center',
      width: 100,
      template: function(t) {
        const stateLabels = {
          COMPLETED: '<span class="status-pill status-completed">تکمیل شده</span>',
          IN_PROGRESS: '<span class="status-pill status-in-progress">در حال انجام</span>',
          IN_REVIEW: '<span class="status-pill status-in-review">در انتظار بررسی</span>',
          OPEN_FOR_CLAIM: '<span class="status-pill status-open">آماده تصاحب</span>',
          DRAFT: '<span class="status-pill status-draft">پیش‌نویس</span>'
        };
        return stateLabels[t.state] || t.state || '';
      }
    },
    {
      name: 'assignee_name',
      label: 'مسئول انتصاب',
      align: 'center',
      width: 120,
      template: function(t) {
        return t.assignee_name || '<em style="color:#888;">تعیین نشده</em>';
      }
    }
  ];

  gantt.init(chartBox);
  gantt.parse({
    data: state.tasks,
    links: state.links
  });

  return gantt;
}
