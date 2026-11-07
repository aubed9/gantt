// apps/rpm_v1/src/mock_data.js
// Mock data conforming strictly to GLOSSARY.md
export { toPersianDigits } from './jalali_adapter.js';

export const initialHumans = [
  { id: 'HM-1', name: 'علی رضایی', role: 'مهندس ارشد پایگاه داده', skills: ['PostgreSQL', 'pgvector', 'SQL'], activeTasks: 1 },
  { id: 'HM-2', name: 'سارا محمدی', role: 'مهندس ارشد فرانت‌اند', skills: ['TypeScript', 'RTL UI', 'DHTMLX Gantt'], activeTasks: 1 },
  { id: 'HM-3', name: 'رضا حسینی', role: 'متخصص هوش مصنوعی و Mastra', skills: ['Mastra', 'AvalAI', 'NLP', 'Gemini STT'], activeTasks: 2 }
];

export const initialProject = {
  id: 'PR-100',
  code: 'rpm_V1',
  name: 'پلتفرم جامع ارکستراسیون منابع و پروژه‌های سازمانی (rpm_V1)',
  manager: 'مهندس کاظمی (PM)',
  owner: 'مهندس افشار (PO)',
  cto: 'دکتر صابری (CTO)',
  status: 'IN_PROGRESS',
  progress: 0.68,
  rollingSummaryFa: 'پروژه rpm_V1 در فاز اول معماری فنی با موفقیت پیش رفته است. مدل داده‌های برداری pgvector در پایگاه داده پیاده‌سازی شده و خط لوله رونویسی صوت AvalAI فعال است. زیرسیستم گانت RTL با تقویم هجری شمسی منطبق گردیده است. هم‌اکنون بررسی گزارش پایانی (EOJ) ماژول دانش در جریان است و وظیفه موتور رقابتی تصاحب کارها در وضعیت آماده تصاحب قرار دارد.'
};

export const initialTasks = [
  {
    id: 100,
    text: 'پلتفرم rpm_V1 - فاز زیرساخت و معماری',
    type: 'project',
    start_date: '2026-04-01 08:00',
    duration: 32,
    open: true,
    render: 'split',
    progress: 0.68
  },
  {
    id: 101,
    parent: 100,
    text: 'طراحی اسکیما و مدل داده‌های رابطه ای و برداری (PostgreSQL + pgvector)',
    start_date: '2026-04-01 08:00',
    duration: 6,
    progress: 1.0,
    state: 'COMPLETED',
    assignee_id: 'HM-1',
    assignee_name: 'علی رضایی',
    skills_needed: ['PostgreSQL', 'pgvector'],
    eoj_report_id: 'RP-501'
  },
  {
    id: 102,
    parent: 100,
    text: 'یکپارچه‌سازی سرویس‌های صوتی AvalAI و رونویسی چندرسانه‌ای Gemini 3.8 Flash',
    start_date: '2026-04-07 08:00',
    duration: 5,
    progress: 1.0,
    state: 'COMPLETED',
    assignee_id: 'HM-3',
    assignee_name: 'رضا حسینی',
    skills_needed: ['AvalAI', 'Gemini STT', 'TypeScript'],
    eoj_report_id: 'RP-502'
  },
  {
    id: 103,
    parent: 100,
    text: 'سفارشی‌سازی تقویم شمسی جلالی و چیدمان راست‌به‌چپ (RTL) گانت چارت',
    start_date: '2026-04-12 08:00',
    duration: 6,
    progress: 0.85,
    state: 'IN_PROGRESS',
    assignee_id: 'HM-2',
    assignee_name: 'سارا محمدی',
    skills_needed: ['DHTMLX Gantt', 'RTL UI']
  },
  {
    id: 104,
    parent: 100,
    text: 'موتور استخراج دانش و خلاصه‌سازی هوشمند گزارش‌های پایانی (Mastra Knowledge)',
    start_date: '2026-04-18 08:00',
    duration: 4,
    progress: 0.95,
    state: 'IN_REVIEW',
    assignee_id: 'HM-3',
    assignee_name: 'رضا حسینی',
    skills_needed: ['Mastra', 'pgvector', 'NLP'],
    eoj_report_id: 'RP-503',
    eoj_report: {
      id: 'RP-503',
      submitted_by: 'رضا حسینی (HM-3)',
      submitted_at: '۱۴۰۵/۰۱/۲۲',
      title: 'گزارش پایان کار (EOJ): ماژول پایگاه دانش مسترا و ایندکس برداری',
      deliverables: [
        'تکمیل قطعه‌بندی اسناد با MDocument به طول ۵۱۲ توکن',
        'ایجاد ایندکس HNSW و GIN بر روی جدول گزارش‌ها',
        'پیاده‌سازی ابزار createVectorQueryTool برای بازیابی معنایی'
      ],
      self_score: 'عالی (۱۰۰٪ معیارهای پذیرش برآورده شد)',
      sentiment: 'مثبت / تأیید شده',
      status: 'SUBMITTED'
    }
  },
  {
    id: 105,
    parent: 100,
    text: 'پیاده‌سازی ماشین وضعیت دو سطحی چرخه حیات تصاحب وظایف (Task Claims)',
    start_date: '2026-04-22 08:00',
    duration: 5,
    progress: 0.0,
    state: 'OPEN_FOR_CLAIM',
    assignee_id: null,
    assignee_name: 'بدون انتصاب (آماده تصاحب)',
    skills_needed: ['TypeScript', 'State Machine', 'PostgreSQL'],
    claims: [
      {
        id: 'CLM-01',
        human_id: 'HM-1',
        human_name: 'علی رضایی',
        match_score: '۹۵٪',
        workload: '۱ وظیفه فعال (ظرفیت مطلوب)',
        prior_eoj_rating: 'عالی (تحویل موفقیت‌آمیز RP-501)',
        status: 'PENDING'
      },
      {
        id: 'CLM-02',
        human_id: 'HM-2',
        human_name: 'سارا محمدی',
        match_score: '۷۰٪',
        workload: '۱ وظیفه فعال (ظرفیت مطلوب)',
        prior_eoj_rating: 'خوب (تحویل به موقع تسک‌های UI)',
        status: 'PENDING'
      }
    ]
  },
  {
    id: 106,
    parent: 100,
    text: 'داشبورد ارکستراسیون مدیریتی و مانیتورینگ بلادرنگ رخدادها و رویدادها',
    start_date: '2026-04-27 08:00',
    duration: 6,
    progress: 0.0,
    state: 'DRAFT',
    assignee_id: null,
    assignee_name: 'پیش‌نویس',
    skills_needed: ['RTL UI', 'Analytics']
  }
];

export const initialLinks = [
  { id: 1, source: 101, target: 103, type: '0' },
  { id: 2, source: 102, target: 104, type: '0' },
  { id: 3, source: 103, target: 105, type: '0' },
  { id: 4, source: 104, target: 105, type: '0' },
  { id: 5, source: 105, target: 106, type: '0' }
];

export function getFreshDataset() {
  const tasksCopy = JSON.parse(JSON.stringify(initialTasks)).map(t => ({
    ...t,
    start_date: t.start_date ? new Date(t.start_date.replace(' ', 'T') + ':00') : undefined
  }));
  return {
    tasks: tasksCopy,
    data: tasksCopy,
    links: JSON.parse(JSON.stringify(initialLinks))
  };
}
