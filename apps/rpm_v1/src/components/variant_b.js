// apps/rpm_v1/src/components/variant_b.js
import { createRpmGanttInstance } from '../gantt_helper.js';
import { initialHumans, toPersianDigits } from '../mock_data.js';
import { emit } from '../emit.js';

export function renderVariantB(container, state, onUpdate) {
  const claimableTasks = state.tasks.filter(t => t.state === 'OPEN_FOR_CLAIM' || t.state === 'CLAIM_REVIEW');
  const targetTask = state.tasks.find(t => t.id === 105) || claimableTasks[0];

  container.innerHTML = `
    <div class="variant-b-layout" data-testid="variant-b-root" dir="rtl">
      <!-- Top Half: Gantt Overview with Focus on Claimable Tasks -->
      <section class="gantt-section">
        <div class="section-header">
          <div>
            <h3>ارکستراسیون تقویمی و وضعیت تصاحب وظایف (RTL Gantt)</h3>
            <span class="sub-caption">وظایف با وضعیت زرد آماده ثبت درخواست تصاحب توسط اعضای تیم هستند</span>
          </div>
          <div class="action-summary">
            <span class="badge badge-accent">پنجره بررسی متمرکز (Pooled Review Window)</span>
          </div>
        </div>
        <div id="gantt-chart-container-b" class="gantt-embed" data-testid="gantt-container"></div>
      </section>

      <!-- Bottom Half: Interactive Task Claim & Candidate Review Board -->
      <section class="claim-board-section" data-testid="claim-board">
        <div class="claim-board-header">
          <div class="board-title-group">
            <span class="step-badge">مرحله ۱: درخواست تصاحب و تأیید انتصاب</span>
            <h4>تابلوی ارزیابی نامزدها و انتصاب وظیفه (#${targetTask.id})</h4>
          </div>
          <div class="task-spec-summary">
            <strong>عنوان وظیفه:</strong> ${targetTask.text} |
            <strong>مهارت‌های مورد نیاز:</strong> ${targetTask.skills_needed?.map(s => `<span class="skill-tag">${s}</span>`).join(' ') || '-'} |
            <strong>وضعیت فعلی:</strong> <span class="status-pill status-${targetTask.state.toLowerCase()}" data-testid="task-status-badge">${targetTask.state}</span>
          </div>
        </div>

        <div class="claimants-grid">
          ${(targetTask.claims || []).map((claim, idx) => `
            <div class="claimant-card ${claim.status === 'APPROVED' ? 'claimant-approved' : ''}" data-testid="claim-task-item">
              <div class="claimant-header">
                <div class="avatar-group">
                  <div class="avatar-circle">${claim.human_name.slice(0, 2)}</div>
                  <div>
                    <h5>${claim.human_name} (${claim.human_id})</h5>
                    <span class="claimant-status status-${claim.status.toLowerCase()}">${claim.status === 'APPROVED' ? 'انتصاب تأیید شد' : claim.status === 'REJECTED' ? 'رد شده' : 'در انتظار بررسی PM'}</span>
                  </div>
                </div>
                <div class="score-badge">
                  <span class="score-label">انطباق مهارتی</span>
                  <strong class="score-value">${claim.match_score}</strong>
                </div>
              </div>

              <div class="claimant-details">
                <div class="detail-row">
                  <span class="detail-label">ظرفیت کاری فعلی:</span>
                  <span class="detail-val">${claim.workload}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">پیشینه گزارش‌های EOJ:</span>
                  <span class="detail-val">${claim.prior_eoj_rating}</span>
                </div>
              </div>

              <div class="claimant-actions">
                ${targetTask.state !== 'ASSIGNED' ? `
                  <button type="button" class="btn btn-primary" data-testid="btn-approve-claim-${claim.human_id}" data-claim-id="${claim.id}" data-human-id="${claim.human_id}" data-human-name="${claim.human_name}">
                    ✓ تأیید انتصاب این عضو (توسط PM)
                  </button>
                ` : `
                  <span class="assigned-notice">${targetTask.assignee_id === claim.human_id ? '✓ مسئول منتخب پروژه' : 'درخواست‌های دیگر خودکار لغو شدند'}</span>
                `}
              </div>
            </div>
          `).join('')}

          ${(!targetTask.claims || targetTask.claims.length === 0) ? `
            <div class="empty-claims-notice">
              <p>هنوز درخواستی برای این وظیفه ثبت نشده است.</p>
              <button type="button" class="btn btn-accent" data-testid="btn-submit-claim">
                + ثبت درخواست تصاحب به عنوان عضو تیم
              </button>
            </div>
          ` : ''}
        </div>
      </section>
    </div>
  `;

  // Gantt chart
  const chartBox = container.querySelector('#gantt-chart-container-b');
  const gantt = createRpmGanttInstance(chartBox);

  gantt.config.columns = [
    { name: 'wbs', label: 'WBS', width: 45, align: 'center', template: gantt.getWBSCode },
    { name: 'text', label: 'عنوان وظیفه', tree: true, width: 250, resize: true },
    {
      name: 'state',
      label: 'وضعیت چرخه حیات',
      align: 'center',
      width: 120,
      template: function(t) {
        const stateLabels = {
          COMPLETED: '<span class="status-pill status-completed">تکمیل شده</span>',
          IN_PROGRESS: '<span class="status-pill status-in-progress">در حال انجام</span>',
          IN_REVIEW: '<span class="status-pill status-in-review">در انتظار بررسی</span>',
          OPEN_FOR_CLAIM: '<span class="status-pill status-open">آماده تصاحب</span>',
          CLAIM_REVIEW: '<span class="status-pill status-review">بررسی درخواست‌ها</span>',
          ASSIGNED: '<span class="status-pill status-assigned">منصوب شده</span>',
          DRAFT: '<span class="status-pill status-draft">پیش‌نویس</span>'
        };
        return stateLabels[t.state] || t.state || '';
      }
    },
    { name: 'assignee_name', label: 'عضو منصوب', align: 'center', width: 140 }
  ];

  gantt.init(chartBox);
  gantt.parse({
    data: state.tasks,
    links: state.links
  });

  // Attach interactive button listeners
  const approveButtons = container.querySelectorAll('[data-testid^="btn-approve-claim"]');
  approveButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const humanId = btn.dataset.humanId;
      const humanName = btn.dataset.humanName;
      const claimId = btn.dataset.claimId;

      // Update state according to ADR 0001
      targetTask.state = 'ASSIGNED';
      targetTask.assignee_id = humanId;
      targetTask.assignee_name = humanName;
      targetTask.claims.forEach(c => {
        if (c.id === claimId) {
          c.status = 'APPROVED';
        } else {
          c.status = 'REJECTED';
        }
      });

      emit.signal('task:assigned', { taskId: targetTask.id, humanId, humanName });
      if (typeof onUpdate === 'function') {
        onUpdate();
      }
    });
  });

  const submitBtn = container.querySelector('[data-testid="btn-submit-claim"]');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      targetTask.state = 'CLAIM_REVIEW';
      targetTask.claims = targetTask.claims || [];
      targetTask.claims.push({
        id: 'CLM-03',
        human_id: 'HM-2',
        human_name: 'سارا محمدی',
        match_score: '۸۵٪',
        workload: '۱ وظیفه فعال',
        prior_eoj_rating: 'عالی',
        status: 'PENDING'
      });
      emit.signal('task:claimed', { taskId: targetTask.id, humanId: 'HM-2' });
      if (typeof onUpdate === 'function') {
        onUpdate();
      }
    });
  }

  return gantt;
}
