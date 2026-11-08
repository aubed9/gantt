// apps/rpm_v1/src/components/variant_b.js
// Production Variant B: RTL DHTMLX Gantt + Live SSE Stream Store & Surgical Event Binding
import { createRpmGanttInstance } from '../gantt_helper.js';
import { initialHumans, toPersianDigits } from '../mock_data.js';
import { emit } from '../emit.js';
import { SseEventStore } from '../sse_store.js';
import { bindGanttToSse, calculateProjectProgressRollup } from '../gantt_sse_binder.js';

export function renderVariantB(container, state) {
  const claimableTasks = state.tasks.filter(t => t.state === 'OPEN_FOR_CLAIM' || t.state === 'CLAIM_REVIEW');
  const targetTask = state.tasks.find(t => t.id === 105) || claimableTasks[0];
  const projectTask = state.tasks.find(t => t.id === 100);

  // Initialize Reactive SSE Store
  const sseStore = new SseEventStore({
    tenantId: 'TN-1',
    humanId: 'HM-1',
    autoReconnect: true,
    useSimulatorFallback: true
  });

  container.innerHTML = `
    <div class="variant-b-layout" data-testid="variant-b-root" dir="rtl">
      <!-- Live SSE Stream & Fine-Grained Update Monitor Banner -->
      <section class="sse-monitor-banner" data-testid="sse-monitor-banner">
        <div class="sse-status-group">
          <div class="live-indicator-wrapper">
            <span class="live-pulse" id="sse-pulse-dot"></span>
            <span class="live-label">وضعیت جریان بلادرنگ (SSE):</span>
            <strong class="status-badge status-connected" data-testid="sse-status" id="sse-status-badge">متصل (Connected)</strong>
          </div>
          <div class="metrics-strip">
            <div class="metric-item">
              <span class="metric-title">بازسازی ساختار DOM:</span>
              <span class="metric-value metric-zero" data-testid="metric-dom-rerenders" id="val-dom-rerenders">۰ (Zero Full Re-renders)</span>
            </div>
            <div class="metric-item">
              <span class="metric-title">به‌روزرسانی‌های جزیی تسک:</span>
              <span class="metric-value" data-testid="metric-task-updates" id="val-task-updates">۰ بار (gantt.updateTask)</span>
            </div>
            <div class="metric-item">
              <span class="metric-title">پیشرفت تجمیعی پروژه (Roll-up):</span>
              <strong class="metric-value metric-accent" data-testid="metric-project-progress" id="val-project-progress">${toPersianDigits(Math.round((projectTask?.progress || 0.68) * 100))}٪</strong>
            </div>
          </div>
        </div>

        <div class="sse-controls-group">
          <span class="controls-label">تست جریان رویدادهای زنده:</span>
          <button type="button" class="btn btn-sm btn-outline" data-testid="btn-sse-claim-approve" id="btn-sse-claim-approve">
            ⚡ تأیید تصاحب تسک ۱۰۵
          </button>
          <button type="button" class="btn btn-sm btn-outline" data-testid="btn-sse-eoj-submit" id="btn-sse-eoj-submit">
            ⚡ ثبت گزارش EOJ
          </button>
          <button type="button" class="btn btn-sm btn-accent" data-testid="btn-sse-eoj-approve" id="btn-sse-eoj-approve">
            ⚡ تأیید گزارش EOJ و محاسبه تجمیعی
          </button>
          <button type="button" class="btn btn-sm btn-secondary" data-testid="btn-sse-date-shift" id="btn-sse-date-shift">
            ⚡ جابجایی تقویم میلادی (+۳ روز)
          </button>
        </div>

        <div class="sse-log-drawer" id="sse-log-drawer" data-testid="sse-log-drawer">
          <span class="log-tag">آخرین رویداد دریافتی:</span>
          <span class="log-content" id="sse-latest-event">در انتظار دریافت رویداد از /api/events/stream...</span>
        </div>
      </section>

      <!-- Top Half: Gantt Overview with Focus on Claimable Tasks -->
      <section class="gantt-section">
        <div class="section-header">
          <div>
            <h3>ارکستراسیون تقویمی و وضعیت تصاحب وظایف (RTL Gantt)</h3>
            <span class="sub-caption">به‌روزرسانی هم‌زمان رویدادهای زنده با حفظ وضعیت اسکرول و عدم بازسازی DOM</span>
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
            <strong>عنوان وظیفه:</strong> <span id="board-task-title">${targetTask.text}</span> |
            <strong>مهارت‌های مورد نیاز:</strong> ${targetTask.skills_needed?.map(s => `<span class="skill-tag">${s}</span>`).join(' ') || '-'} |
            <strong>وضعیت فعلی:</strong> <span class="status-pill status-${targetTask.state.toLowerCase()}" data-testid="task-status-badge" id="board-task-status">${targetTask.state}</span>
          </div>
        </div>

        <div class="claimants-grid" id="claimants-grid">
          ${(targetTask.claims || []).map((claim) => `
            <div class="claimant-card ${claim.status === 'APPROVED' ? 'claimant-approved' : ''}" data-testid="claim-task-item" id="claimant-card-${claim.human_id}">
              <div class="claimant-header">
                <div class="avatar-group">
                  <div class="avatar-circle">${claim.human_name.slice(0, 2)}</div>
                  <div>
                    <h5>${claim.human_name} (${claim.human_id})</h5>
                    <span class="claimant-status status-${claim.status.toLowerCase()}" id="claimant-status-${claim.human_id}">
                      ${claim.status === 'APPROVED' ? 'انتصاب تأیید شد' : claim.status === 'REJECTED' ? 'رد شده' : 'در انتظار بررسی PM'}
                    </span>
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

              <div class="claimant-actions" id="claimant-actions-${claim.human_id}">
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
            <div class="empty-claims-notice" id="empty-claims-notice">
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

  // Gantt chart initialization
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

  // Connect Surgical Gantt SSE Binder
  const domRerendersEl = container.querySelector('#val-dom-rerenders');
  const taskUpdatesEl = container.querySelector('#val-task-updates');
  const projectProgressEl = container.querySelector('#val-project-progress');
  const logContentEl = container.querySelector('#sse-latest-event');
  const statusBadgeEl = container.querySelector('#sse-status-badge');
  const boardStatusBadge = container.querySelector('#board-task-status');

  const patchUiElements = (eventType, payload, metrics) => {
    // 1. Update metric counters without full DOM re-renders
    if (taskUpdatesEl) {
      taskUpdatesEl.textContent = `${toPersianDigits(metrics.fineGrainedUpdateCount)} بار (gantt.updateTask)`;
    }
    if (projectProgressEl) {
      projectProgressEl.textContent = `${toPersianDigits(Math.round(metrics.projectRollupProgress * 100))}٪`;
    }
    if (logContentEl) {
      logContentEl.textContent = `[${new Date().toLocaleTimeString()}] ${eventType}: ${JSON.stringify(payload)}`;
    }

    // 2. Surgically patch Task Claim Board cards if Task #105 changed
    const taskId = Number(payload.task_id || payload.taskId);
    if (taskId === targetTask.id) {
      if (boardStatusBadge && targetTask.state) {
        boardStatusBadge.className = `status-pill status-${targetTask.state.toLowerCase()}`;
        boardStatusBadge.textContent = targetTask.state;
      }

      if (targetTask.state === 'ASSIGNED') {
        const approvedHumanId = targetTask.assignee_id;
        (targetTask.claims || []).forEach(claim => {
          const cardEl = container.querySelector(`#claimant-card-${claim.human_id}`);
          const statusEl = container.querySelector(`#claimant-status-${claim.human_id}`);
          const actionsEl = container.querySelector(`#claimant-actions-${claim.human_id}`);

          if (cardEl && statusEl && actionsEl) {
            if (claim.human_id === approvedHumanId) {
              cardEl.classList.add('claimant-approved');
              statusEl.className = 'claimant-status status-approved';
              statusEl.textContent = 'انتصاب تأیید شد';
              actionsEl.innerHTML = '<span class="assigned-notice">✓ مسئول منتخب پروژه</span>';
            } else {
              cardEl.classList.remove('claimant-approved');
              statusEl.className = 'claimant-status status-rejected';
              statusEl.textContent = 'رد شده';
              actionsEl.innerHTML = '<span class="assigned-notice">درخواست‌های دیگر خودکار لغو شدند</span>';
            }
          }
        });
      }
    }
  };

  const binderMetrics = bindGanttToSse(gantt, state, sseStore, patchUiElements);

  // Status changes on SSE connection
  sseStore.on('status_change', (newStatus) => {
    if (statusBadgeEl) {
      if (newStatus === 'CONNECTED') {
        statusBadgeEl.className = 'status-badge status-connected';
        statusBadgeEl.textContent = 'متصل (Connected)';
      } else if (newStatus === 'CONNECTING') {
        statusBadgeEl.className = 'status-badge status-connecting';
        statusBadgeEl.textContent = 'در حال اتصال...';
      } else {
        statusBadgeEl.className = 'status-badge status-disconnected';
        statusBadgeEl.textContent = 'قطع ارتباط (Reconnecting)';
      }
    }
  });

  // Attach interactive button listeners (dispatches to SSE store)
  const approveButtons = container.querySelectorAll('[data-testid^="btn-approve-claim"]');
  approveButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const humanId = btn.dataset.humanId;
      const humanName = btn.dataset.humanName;
      const claimId = btn.dataset.claimId;

      sseStore.dispatch({
        id: Date.now(),
        type: 'task_claim:approved',
        payload: {
          task_id: targetTask.id,
          claim_id: claimId,
          human_id: humanId,
          human_name: humanName
        }
      });
    });
  });

  const submitBtn = container.querySelector('[data-testid="btn-submit-claim"]');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      sseStore.dispatch({
        id: Date.now(),
        type: 'task_claim:created',
        payload: {
          task_id: targetTask.id,
          human_id: 'HM-2',
          human_name: 'سارا محمدی',
          match_score: '۸۵٪',
          workload: '۱ وظیفه فعال',
          prior_eoj_rating: 'عالی'
        }
      });
    });
  }

  // Simulation test button controllers
  const btnClaimApprove = container.querySelector('#btn-sse-claim-approve');
  if (btnClaimApprove) {
    btnClaimApprove.addEventListener('click', () => {
      sseStore.dispatch({
        id: Date.now(),
        type: 'task_claim:approved',
        payload: {
          task_id: 105,
          claim_id: 'CLM-01',
          human_id: 'HM-1',
          human_name: 'رضا حسینی'
        }
      });
    });
  }

  const btnEojSubmit = container.querySelector('#btn-sse-eoj-submit');
  if (btnEojSubmit) {
    btnEojSubmit.addEventListener('click', () => {
      sseStore.dispatch({
        id: Date.now(),
        type: 'report:submitted',
        payload: {
          task_id: 105,
          report_id: 'REP-901',
          author_id: 'HM-1'
        }
      });
    });
  }

  const btnEojApprove = container.querySelector('#btn-sse-eoj-approve');
  if (btnEojApprove) {
    btnEojApprove.addEventListener('click', () => {
      sseStore.dispatch({
        id: Date.now(),
        type: 'report:approved',
        payload: {
          task_id: 105,
          report_id: 'REP-901',
          task_progress: 1.0,
          reviewer_id: 'HM-2'
        }
      });
    });
  }

  const btnDateShift = container.querySelector('#btn-sse-date-shift');
  if (btnDateShift) {
    btnDateShift.addEventListener('click', () => {
      // Gregorian ISO timestamp shift demonstration (+3 days)
      sseStore.dispatch({
        id: Date.now(),
        type: 'task:dates_updated',
        payload: {
          task_id: 106,
          start_date: '2026-11-13 08:00',
          end_date: '2026-11-20 17:00',
          duration: 7
        }
      });
    });
  }

  // Connect to live backend SSE stream
  sseStore.connect();

  return {
    gantt,
    sseStore,
    metrics: binderMetrics
  };
}
