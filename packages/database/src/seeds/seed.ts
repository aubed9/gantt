import { sql } from 'kysely';
import { db } from '../client.js';

function generateNormalizedEmbedding(seed: number, dims = 1536): string {
  const vec: number[] = [];
  let sumSq = 0;
  for (let i = 0; i < dims; i++) {
    // Deterministic pseudo-random value based on seed
    const val = Math.sin(seed * (i + 1)) * Math.cos((seed + 1) * (i + 1));
    vec.push(val);
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1;
  const normalized = vec.map((v) => Number((v / norm).toFixed(6)));
  return `[${normalized.join(',')}]`;
}

export async function seedDatabase() {
  console.log('--- Starting rpm_V1 Database Seed ---');

  // 1. Clean existing records in reverse dependency order
  console.log('Clearing existing table records...');
  await sql`TRUNCATE TABLE tenant_events CASCADE;`.execute(db);
  await sql`TRUNCATE TABLE mastra_vectors.report_chunks CASCADE;`.execute(db);
  await sql`TRUNCATE TABLE reports CASCADE;`.execute(db);
  await sql`TRUNCATE TABLE events CASCADE;`.execute(db);
  await sql`TRUNCATE TABLE task_claims CASCADE;`.execute(db);
  await sql`TRUNCATE TABLE tasks CASCADE;`.execute(db);
  await sql`TRUNCATE TABLE projects CASCADE;`.execute(db);
  await sql`TRUNCATE TABLE humans CASCADE;`.execute(db);
  await sql`TRUNCATE TABLE tenants CASCADE;`.execute(db);

  // 2. Insert Primary Tenant (TN-1)
  console.log('Seeding Tenant...');
  const tenantId = 'TN-1';
  await db
    .insertInto('tenants')
    .values({
      id: tenantId,
      name: 'سازمان راهبری فناوری نوین',
      slug: 'novin-tech',
    })
    .execute();

  // 3. Insert Humans (HM)
  console.log('Seeding Humans...');
  const humans = [
    {
      id: 'HM-1',
      tenant_id: tenantId,
      name: 'علی رضایی',
      email: 'ali.rezaei@novin.tech',
      role: 'مهندس ارشد پایگاه داده و زیرساخت',
      is_internal: true,
      skills: ['PostgreSQL', 'pgvector', 'SQL', 'Performance Tuning'],
      active_tasks_count: 1,
    },
    {
      id: 'HM-2',
      tenant_id: tenantId,
      name: 'سارا محمدی',
      email: 'sara.mohammadi@novin.tech',
      role: 'مهندس ارشد فرانت‌اند و رابط کاربری',
      is_internal: true,
      skills: ['TypeScript', 'RTL UI', 'DHTMLX Gantt', 'CSS', 'Reticle'],
      active_tasks_count: 1,
    },
    {
      id: 'HM-3',
      tenant_id: tenantId,
      name: 'رضا حسینی',
      email: 'reza.hosseini@novin.tech',
      role: 'متخصص هوش مصنوعی و مهندسی داده',
      is_internal: true,
      skills: ['Mastra', 'AvalAI', 'NLP', 'Gemini STT', 'DeepSeek', 'Python'],
      active_tasks_count: 2,
    },
    {
      id: 'HM-10',
      tenant_id: tenantId,
      name: 'مهندس کاظمی',
      email: 'kazemi.pm@novin.tech',
      role: 'مدیر پروژه (PM)',
      is_internal: true,
      skills: ['Project Management', 'Agile', 'Resource Planning'],
      active_tasks_count: 0,
    },
    {
      id: 'HM-11',
      tenant_id: tenantId,
      name: 'مهندس افشار',
      email: 'afshar.po@novin.tech',
      role: 'مالک محصول (PO)',
      is_internal: true,
      skills: ['Product Strategy', 'Roadmapping', 'User Research'],
      active_tasks_count: 0,
    },
    {
      id: 'HM-12',
      tenant_id: tenantId,
      name: 'دکتر صابری',
      email: 'saberi.cto@novin.tech',
      role: 'مدیر ارشد فناوری (CTO)',
      is_internal: true,
      skills: ['System Architecture', 'Governance', 'Security'],
      active_tasks_count: 0,
    },
  ];

  await db.insertInto('humans').values(humans).execute();

  // 4. Insert Project (PR-100)
  console.log('Seeding Project...');
  const projectId = 'PR-100';
  await db
    .insertInto('projects')
    .values({
      id: projectId,
      tenant_id: tenantId,
      code: 'rpm_V1',
      name: 'پلتفرم جامع ارکستراسیون منابع و پروژه‌های سازمانی (rpm_V1)',
      description:
        'پلتفرم هوشمند برنامه‌ریزی و تخصیص منابع سازمانی بر پایه DHTMLX Gantt، Mastra و AvalAI',
      manager_id: 'HM-10',
      owner_id: 'HM-11',
      cto_id: 'HM-12',
      status: 'IN_PROGRESS',
      progress: 0.68,
      rolling_summary_fa:
        'پروژه rpm_V1 در فاز اول معماری فنی با موفقیت پیش رفته است. مدل داده‌های برداری pgvector در پایگاه داده پیاده‌سازی شده و خط لوله رونویسی صوت AvalAI فعال است. زیرسیستم گانت RTL با تقویم هجری شمسی منطبق گردیده است.',
      rolling_summary_en:
        'The rpm_V1 project is progressing successfully in Phase 1 of technical architecture. The pgvector data model is established and the AvalAI voice transcription pipeline is active.',
    })
    .execute();

  // 5. Insert Tasks (TS)
  console.log('Seeding Tasks...');
  // Parent container task
  await db
    .insertInto('tasks')
    .values({
      id: 100,
      tenant_id: tenantId,
      project_id: projectId,
      parent_id: null,
      text: 'پلتفرم rpm_V1 - فاز زیرساخت و معماری',
      type: 'project',
      start_date: new Date('2026-04-01T08:00:00Z'),
      duration: 32,
      end_date: new Date('2026-05-03T08:00:00Z'),
      progress: 0.68,
      state: 'IN_PROGRESS',
      assignee_id: null,
      skills_needed: [],
      eoj_report_id: null,
    })
    .execute();

  const childTasks = [
    {
      id: 101,
      tenant_id: tenantId,
      project_id: projectId,
      parent_id: 100,
      text: 'طراحی اسکیما و مدل داده‌های رابطه ای و برداری (PostgreSQL + pgvector)',
      type: 'task',
      start_date: new Date('2026-04-01T08:00:00Z'),
      duration: 6,
      end_date: new Date('2026-04-07T08:00:00Z'),
      progress: 1.0,
      state: 'COMPLETED' as const,
      assignee_id: 'HM-1',
      skills_needed: ['PostgreSQL', 'pgvector'],
      eoj_report_id: 'RP-501',
    },
    {
      id: 102,
      tenant_id: tenantId,
      project_id: projectId,
      parent_id: 100,
      text: 'یکپارچه‌سازی سرویس‌های صوتی AvalAI و رونویسی چندرسانه‌ای Gemini 3.8 Flash',
      type: 'task',
      start_date: new Date('2026-04-07T08:00:00Z'),
      duration: 5,
      end_date: new Date('2026-04-12T08:00:00Z'),
      progress: 1.0,
      state: 'COMPLETED' as const,
      assignee_id: 'HM-3',
      skills_needed: ['AvalAI', 'Gemini STT', 'TypeScript'],
      eoj_report_id: 'RP-502',
    },
    {
      id: 103,
      tenant_id: tenantId,
      project_id: projectId,
      parent_id: 100,
      text: 'سفارشی‌سازی تقویم شمسی جلالی و چیدمان راست‌به‌چپ (RTL) گانت چارت',
      type: 'task',
      start_date: new Date('2026-04-12T08:00:00Z'),
      duration: 6,
      end_date: new Date('2026-04-18T08:00:00Z'),
      progress: 0.85,
      state: 'IN_PROGRESS' as const,
      assignee_id: 'HM-2',
      skills_needed: ['DHTMLX Gantt', 'RTL UI'],
      eoj_report_id: null,
    },
    {
      id: 104,
      tenant_id: tenantId,
      project_id: projectId,
      parent_id: 100,
      text: 'موتور استخراج دانش و خلاصه‌سازی هوشمند گزارش‌های پایانی (Mastra Knowledge)',
      type: 'task',
      start_date: new Date('2026-04-18T08:00:00Z'),
      duration: 4,
      end_date: new Date('2026-04-22T08:00:00Z'),
      progress: 0.95,
      state: 'IN_REVIEW' as const,
      assignee_id: 'HM-3',
      skills_needed: ['Mastra', 'pgvector', 'NLP'],
      eoj_report_id: 'RP-503',
    },
    {
      id: 105,
      tenant_id: tenantId,
      project_id: projectId,
      parent_id: 100,
      text: 'پیاده‌سازی ماشین وضعیت دو سطحی چرخه حیات تصاحب وظایف (Task Claims)',
      type: 'task',
      start_date: new Date('2026-04-22T08:00:00Z'),
      duration: 5,
      end_date: new Date('2026-04-27T08:00:00Z'),
      progress: 0.0,
      state: 'OPEN_FOR_CLAIM' as const,
      assignee_id: null,
      skills_needed: ['TypeScript', 'State Machine', 'PostgreSQL'],
      eoj_report_id: null,
    },
    {
      id: 106,
      tenant_id: tenantId,
      project_id: projectId,
      parent_id: 100,
      text: 'داشبورد ارکستراسیون مدیریتی و مانیتورینگ بلادرنگ رخدادها و رویدادها',
      type: 'task',
      start_date: new Date('2026-04-27T08:00:00Z'),
      duration: 6,
      end_date: new Date('2026-05-03T08:00:00Z'),
      progress: 0.0,
      state: 'DRAFT' as const,
      assignee_id: null,
      skills_needed: ['RTL UI', 'Analytics'],
      eoj_report_id: null,
    },
  ];

  await db.insertInto('tasks').values(childTasks).execute();

  // Reset tasks sequence to avoid ID collisions on future inserts
  await sql`SELECT setval('tasks_id_seq', 200, false);`.execute(db);

  // 6. Insert Task Claims
  console.log('Seeding Task Claims...');
  const claims = [
    {
      id: 'CLM-01',
      tenant_id: tenantId,
      task_id: 105,
      human_id: 'HM-1',
      status: 'PENDING' as const,
      match_score: 95.0,
      ai_candidate_assessment:
        'مهارت‌های پایگاه داده و معماری عالی. ۱ وظیفه فعال با ظرفیت مطلوب. سابقه تحویل موفقیت‌آمیز RP-501.',
    },
    {
      id: 'CLM-02',
      tenant_id: tenantId,
      task_id: 105,
      human_id: 'HM-2',
      status: 'PENDING' as const,
      match_score: 70.0,
      ai_candidate_assessment:
        'مهارت در تایپ‌اسکریپت و منطق کسب‌وکار فرانت‌اند. تجربه کمتر در تراکنش‌های سطح پایگاه داده.',
    },
  ];

  await db.insertInto('task_claims').values(claims).execute();

  // 7. Insert Events (EV)
  console.log('Seeding Events...');
  const events = [
    {
      id: 'EV-201',
      tenant_id: tenantId,
      project_id: projectId,
      title: 'جلسه ارزیابی معماری اسپرینت ۱ و دروازه کیفی',
      description: 'بررسی صحت اسکیما رابطه ای، یکپارچگی pgvector و سیاست‌های چندمستاجری (Tenant Isolation)',
      event_date: new Date('2026-04-10T14:00:00Z'),
      is_milestone: true,
    },
    {
      id: 'EV-202',
      tenant_id: tenantId,
      project_id: projectId,
      title: 'دموی فنی موتور رونویسی صوت AvalAI و گانت شمسی',
      description: 'ارائه عملکرد هوش مصنوعی در نشست هماهنگی ذینفعان ارشد سازمان',
      event_date: new Date('2026-04-20T10:00:00Z'),
      is_milestone: true,
    },
  ];

  await db.insertInto('events').values(events).execute();

  // 8. Insert Reports (RP & EOJ)
  console.log('Seeding Reports...');
  const reports = [
    {
      id: 'RP-501',
      tenant_id: tenantId,
      project_id: projectId,
      task_id: 101,
      event_id: null,
      author_id: 'HM-1',
      report_type: 'EOJ' as const,
      title: 'گزارش پایان کار (EOJ): طراحی اسکیما و مدل داده‌های رابطه ای و برداری',
      content_markdown: `## خلاصه تحویل و نتایج کلیدی
- ایجاد جداول چندمستأجری با کلید خارجی \`tenant_id\` در تمام موجودیت‌های اصلی.
- فعال‌سازی اکستنشن \`pgvector\` v0.8.7 بر روی پورت 5534.
- پیاده‌سازی ایندکس‌های کارای HNSW بر روی بردارهای ۱۵۳۶ بعدی گزارش‌ها.
- اعمال محدودیت‌های یکتایی ترکیبی سازمانی.`,
      status: 'APPROVED' as const,
      reviewer_id: 'HM-10',
      reviewer_feedback: 'عالی، تمام اهداف معماری و جداول رابطه ای طبق مستندات GLOSSARY پیاده شد.',
      submitted_at: new Date('2026-04-07T16:00:00Z'),
      approved_at: new Date('2026-04-08T09:00:00Z'),
    },
    {
      id: 'RP-502',
      tenant_id: tenantId,
      project_id: projectId,
      task_id: 102,
      event_id: null,
      author_id: 'HM-3',
      report_type: 'EOJ' as const,
      title: 'گزارش پایان کار (EOJ): سرویس‌های صوتی AvalAI و رونویسی Gemini 3.8 Flash',
      content_markdown: `## خلاصه رونویسی و بنچمارک فارسی
- برقراری ارتباط پایدار با Endpoint اختصاصی AvalAI بر بستر \`https://api.avalai.ir/v1\`.
- پیکربندی پارامترهای پیشرفته STT شامل حفظ نیم‌فاصله (ZWNJ) و واژگان تخصصی مهندسی.
- نرخ خطای کاراکتر (CER) زیر ۲.۵٪ در آزمون‌های ارزیابی خودکار.`,
      status: 'APPROVED' as const,
      reviewer_id: 'HM-10',
      reviewer_feedback: 'کیفیت رونویسی متن صوت در زبان فارسی بالاتر از استاندارد مورد انتظار بود.',
      submitted_at: new Date('2026-04-12T17:00:00Z'),
      approved_at: new Date('2026-04-13T10:00:00Z'),
    },
    {
      id: 'RP-503',
      tenant_id: tenantId,
      project_id: projectId,
      task_id: 104,
      event_id: null,
      author_id: 'HM-3',
      report_type: 'EOJ' as const,
      title: 'گزارش پایان کار (EOJ): ماژول پایگاه دانش مسترا و ایندکس برداری',
      content_markdown: `## خلاصه پیاده‌سازی ماژول دانش
- پیاده‌سازی قطعه‌بندی اسناد با استراتژی Markdown در قطعات ۵۱۲ توکنی با همپوشانی ۶۴ توکن.
- ذخیره فراداده غنی سازمانی شامل کد پروژه، شناسه نویسنده و تاریخ شمسی.
- طراحی ابزارهای هیبریدی SQL + برداری برای عامل پاسخگوی هوشمند.`,
      status: 'SUBMITTED' as const,
      reviewer_id: 'HM-10',
      reviewer_feedback: null,
      submitted_at: new Date('2026-04-22T15:30:00Z'),
      approved_at: null,
    },
  ];

  await db.insertInto('reports').values(reports).execute();

  // 9. Insert Report Chunks (Vector Store)
  console.log('Seeding Report Chunks into mastra_vectors...');
  const chunks = [
    {
      tenant_id: tenantId,
      report_id: 'RP-501',
      chunk_index: 0,
      content:
        '[Context: PR-100 > TS-101 > HM-1] ایجاد جداول چندمستأجری با کلید خارجی tenant_id در تمام موجودیت‌های اصلی و راه‌اندازی ایندکس‌های HNSW بر روی پورت 5534.',
      embedding: generateNormalizedEmbedding(101),
      metadata: {
        projectId: projectId,
        taskId: 101,
        authorHumanId: 'HM-1',
        reportType: 'EOJ',
        topic: 'database_infrastructure',
      },
    },
    {
      tenant_id: tenantId,
      report_id: 'RP-502',
      chunk_index: 0,
      content:
        '[Context: PR-100 > TS-102 > HM-3] برقراری ارتباط پایدار با Endpoint اختصاصی AvalAI و ارزیابی کیفیت رونویسی با مدل Gemini 3.8 Flash با CER زیر ۲.۵٪.',
      embedding: generateNormalizedEmbedding(102),
      metadata: {
        projectId: projectId,
        taskId: 102,
        authorHumanId: 'HM-3',
        reportType: 'EOJ',
        topic: 'voice_transcription',
      },
    },
    {
      tenant_id: tenantId,
      report_id: 'RP-503',
      chunk_index: 0,
      content:
        '[Context: PR-100 > TS-104 > HM-3] پیاده‌سازی قطعه‌بندی اسناد با MDocument و ابزارهای هیبریدی SQL و برداری برای عامل هوشمند.',
      embedding: generateNormalizedEmbedding(104),
      metadata: {
        projectId: projectId,
        taskId: 104,
        authorHumanId: 'HM-3',
        reportType: 'EOJ',
        topic: 'knowledge_ingestion',
      },
    },
  ];

  for (const chunk of chunks) {
    await sql`
      INSERT INTO mastra_vectors.report_chunks (tenant_id, report_id, chunk_index, content, embedding, metadata)
      VALUES (
        ${chunk.tenant_id},
        ${chunk.report_id},
        ${chunk.chunk_index},
        ${chunk.content},
        ${chunk.embedding}::vector,
        ${JSON.stringify(chunk.metadata)}::jsonb
      );
    `.execute(db);
  }

  // 10. Insert Initial Outbox Events (tenant_events)
  console.log('Seeding Real-Time Events (tenant_events)...');
  const initialEvents = [
    {
      tenant_id: tenantId,
      event_type: 'task:created',
      entity_type: 'task',
      entity_id: '105',
      payload: {
        taskId: 105,
        state: 'OPEN_FOR_CLAIM',
        text: 'پیاده‌سازی ماشین وضعیت دو سطحی چرخه حیات تصاحب وظایف (Task Claims)',
      },
    },
    {
      tenant_id: tenantId,
      event_type: 'task_claim:created',
      entity_type: 'task_claim',
      entity_id: 'CLM-01',
      payload: {
        claimId: 'CLM-01',
        taskId: 105,
        humanId: 'HM-1',
        matchScore: 95.0,
      },
    },
    {
      tenant_id: tenantId,
      event_type: 'report:submitted',
      entity_type: 'report',
      entity_id: 'RP-503',
      payload: {
        reportId: 'RP-503',
        taskId: 104,
        authorId: 'HM-3',
        status: 'SUBMITTED',
      },
    },
  ];

  for (const ev of initialEvents) {
    await db
      .insertInto('tenant_events')
      .values({
        tenant_id: ev.tenant_id,
        event_type: ev.event_type,
        entity_type: ev.entity_type,
        entity_id: ev.entity_id,
        payload: ev.payload,
      })
      .execute();
  }

  console.log('✓ rpm_V1 database seed completed successfully!');
}

// CLI runner
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed with error:', err);
      process.exit(1);
    });
}
