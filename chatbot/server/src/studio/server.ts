import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { mastra } from '../mastra/instance.js';

dotenv.config();

const { Pool } = pg;
const PORT = parseInt(process.env.MASTRA_STUDIO_PORT || process.env.PORT || '4111', 10);
const HOST = process.env.HOST || '0.0.0.0';

export function createStudioApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // PostgreSQL pool for telemetry spans
  let pool: pg.Pool | null = null;
  const dbUrl = process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || 'rpm_user'}:${process.env.POSTGRES_PASSWORD || 'rpm_secret_password'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5534'}/${process.env.POSTGRES_DB || 'rpm_v1'}`;

  try {
    pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 3000,
    });
    pool.on('error', (err) => {
      // Quiet pool errors when DB not ready
    });
  } catch (err) {
    pool = null;
  }

  // Health endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'mastra-studio',
      port: PORT,
      timestamp: new Date().toISOString(),
    });
  });

  // REST API: Agents registered in the central Mastra instance
  app.get('/api/agents', (_req: Request, res: Response) => {
    const agents = [
      {
        id: 'rpm-assistant-agent',
        name: 'rpm-assistant-agent',
        displayName: 'RPM Assistant Agent',
        description: 'Bilingual (Farsi/English) reasoning assistant for project navigation and Gantt operations',
        registered: !!mastra.getAgent('rpm-assistant-agent'),
      },
      {
        id: 'task-claim-ranking-agent',
        name: 'task-claim-ranking-agent',
        displayName: 'Task Claim Ranking Agent',
        description: 'Evaluates candidate task claims during Claim Review Windows with confidence scoring',
        registered: !!mastra.getAgent('task-claim-ranking-agent'),
      },
      {
        id: 'eoj-assessor-agent',
        name: 'eoj-assessor-agent',
        displayName: 'EOJ Assessor Agent',
        description: 'Validates End-of-Job reports, deliverable completion, and duration-weighted progress roll-up',
        registered: !!mastra.getAgent('eoj-assessor-agent'),
      },
    ];
    res.json(agents);
  });

  // REST API: Workflows registered in the central Mastra instance
  app.get('/api/workflows', (_req: Request, res: Response) => {
    const workflows = [
      {
        id: 'rpm-chat-v1',
        name: 'rpm-chat-v1',
        displayName: 'RPM Chat Workflow',
        registered: !!mastra.getWorkflow('rpm-chat-v1'),
      },
      {
        id: 'report-ingestion-v1',
        name: 'report-ingestion-v1',
        displayName: 'Report Knowledge Ingestion Workflow',
        registered: !!mastra.getWorkflow('report-ingestion-v1'),
      },
    ];
    res.json(workflows);
  });

  // REST API: Observability trace query
  app.get('/api/observability/traces', async (req: Request, res: Response) => {
    // Address the Mastra Studio entity filter trap:
    // If filterEntityId or entityName is passed, map code symbol 'chatWorkflow' to canonical 'rpm-chat-v1'
    let entityFilter = (req.query.filterEntityId || req.query.entityName) as string | undefined;
    if (entityFilter === 'chatWorkflow') {
      entityFilter = 'rpm-chat-v1';
    }

    const limit = parseInt((req.query.limit as string) || '50', 10);
    const spanType = req.query.spanType as string | undefined;

    if (!pool) {
      return res.json({ spans: [], total: 0, connected: false, entityFilter: entityFilter || null });
    }

    try {
      let query = `
        SELECT 
          id, 
          "traceId", 
          "spanId", 
          "parentSpanId", 
          name, 
          "entityName", 
          "spanType", 
          status, 
          attributes, 
          input, 
          output, 
          error, 
          "startedAt", 
          "endedAt"
        FROM mastra.mastra_ai_spans
      `;
      const params: any[] = [];
      const conditions: string[] = [];

      if (entityFilter) {
        params.push(entityFilter);
        conditions.push(`"entityName" = $${params.length}`);
      }

      if (spanType) {
        params.push(spanType);
        conditions.push(`"spanType" = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY "startedAt" DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await pool.query(query, params);
      res.json({
        spans: result.rows,
        total: result.rowCount,
        connected: true,
        entityFilter: entityFilter || null,
      });
    } catch (err: any) {
      // Graceful fallback if table doesn't exist yet or connection fails
      res.json({
        spans: [],
        total: 0,
        connected: false,
        entityFilter: entityFilter || null,
        error: err.message,
      });
    }
  });

  // REST API: Single span detail
  app.get('/api/observability/spans/:id', async (req: Request, res: Response) => {
    if (!pool) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    try {
      const result = await pool.query(
        'SELECT * FROM mastra.mastra_ai_spans WHERE id = $1 OR "spanId" = $1 LIMIT 1',
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Span not found' });
      }
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // HTML Studio Dashboard (Serves /, /traces, /agents, /agents/:id/traces, /workflows/:id/traces)
  const renderStudioDashboard = (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mastra Studio — rpm_V1 Observability & Telemetry</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: #12141c;
      --border: #232738;
      --text: #e2e8f0;
      --text-muted: #8492a6;
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.15);
      --success: #10b981;
      --success-glow: rgba(16, 185, 129, 0.15);
      --error: #ef4444;
      --font-mono: 'JetBrains Mono', monospace;
      --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(18, 20, 28, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0.9rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }
    .logo {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.1rem;
      color: white;
    }
    .title {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .badge {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-live {
      background: var(--success-glow);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge-port {
      background: var(--accent-glow);
      color: var(--accent);
      border: 1px solid rgba(99, 102, 241, 0.3);
      font-family: var(--font-mono);
    }
    nav {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.15s;
    }
    nav a:hover, nav a.active {
      color: var(--text);
    }
    main {
      flex: 1;
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }
    .grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 1.5rem;
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .panel-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .entity-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .entity-item {
      padding: 0.65rem 0.8rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-decoration: none;
      color: inherit;
    }
    .entity-item:hover, .entity-item.active {
      background: var(--accent-glow);
      border-color: var(--accent);
      color: white;
    }
    .entity-name {
      font-family: var(--font-mono);
      font-size: 0.82rem;
    }
    .traces-table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    th {
      text-align: left;
      padding: 0.75rem 1rem;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid rgba(35, 39, 56, 0.6);
      font-family: var(--font-sans);
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }
    .span-name {
      font-family: var(--font-mono);
      font-weight: 600;
      color: #93c5fd;
    }
    .span-entity {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .status-pill {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-success {
      background: var(--success-glow);
      color: var(--success);
    }
    .status-error {
      background: rgba(239, 68, 68, 0.15);
      color: var(--error);
    }
    .drawer {
      margin-top: 1.5rem;
      padding: 1.25rem;
      background: #0d0f17;
      border: 1px solid var(--border);
      border-radius: 8px;
      display: none;
    }
    pre {
      background: #050608;
      padding: 1rem;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: #a5b4fc;
      overflow-x: auto;
      max-height: 320px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo">M</div>
      <div>
        <div class="title">Mastra Studio</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">rpm_V1 Platform Telemetry & Observability</div>
      </div>
      <span class="badge badge-port">:4111</span>
      <span class="badge badge-live">PostgreSQL Connected</span>
    </div>
    <nav>
      <a href="/traces" class="active">Traces</a>
      <a href="/agents">Agents</a>
      <a href="http://localhost:3120/prototype" target="_blank">Express Prototype ↗</a>
      <a href="/health">Health API</a>
    </nav>
  </header>

  <main>
    <div class="grid">
      <aside>
        <div class="panel">
          <div class="panel-title">Registered Agents</div>
          <ul class="entity-list" id="agents-list">
            <li><a class="entity-item" href="/agents/rpm-assistant-agent/traces"><span class="entity-name">rpm-assistant-agent</span></a></li>
            <li><a class="entity-item" href="/agents/task-claim-ranking-agent/traces"><span class="entity-name">task-claim-ranking-agent</span></a></li>
            <li><a class="entity-item" href="/agents/eoj-assessor-agent/traces"><span class="entity-name">eoj-assessor-agent</span></a></li>
          </ul>

          <div class="panel-title" style="margin-top: 1.5rem;">Registered Workflows</div>
          <ul class="entity-list" id="workflows-list">
            <li><a class="entity-item" href="/workflows/rpm-chat-v1/traces"><span class="entity-name">rpm-chat-v1</span></a></li>
            <li><a class="entity-item" href="/workflows/report-ingestion-v1/traces"><span class="entity-name">report-ingestion-v1</span></a></li>
          </ul>

          <div style="margin-top: 1.5rem; font-size: 0.75rem; color: var(--text-muted); line-height: 1.4;">
            💡 <strong>Entity Filter Trap Protection:</strong> Direct canonical URLs prevent 0-record filter drops in PostgreSQL queries.
          </div>
        </div>
      </aside>

      <section>
        <div class="panel">
          <div class="panel-title">
            <span>Telemetry Spans (mastra.mastra_ai_spans)</span>
            <button onclick="loadSpans()" style="background: transparent; border: 1px solid var(--border); color: var(--text); padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Refresh</button>
          </div>

          <div class="traces-table-container">
            <table>
              <thead>
                <tr>
                  <th>Span Name</th>
                  <th>Entity</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Tokens</th>
                  <th>Started At</th>
                </tr>
              </thead>
              <tbody id="spans-tbody">
                <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading telemetry traces...</td></tr>
              </tbody>
            </table>
          </div>

          <div class="drawer" id="span-drawer">
            <h4 style="margin-bottom: 0.75rem; font-size: 0.9rem;" id="drawer-title">Span Detail</h4>
            <pre id="drawer-content"></pre>
          </div>
        </div>
      </section>
    </div>
  </main>

  <script>
    async function loadSpans() {
      const tbody = document.getElementById('spans-tbody');
      const params = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;

      let entityFilter = params.get('filterEntityId') || params.get('entityName');
      if (pathname.includes('/agents/')) {
        entityFilter = pathname.split('/agents/')[1].split('/')[0];
      } else if (pathname.includes('/workflows/')) {
        entityFilter = pathname.split('/workflows/')[1].split('/')[0];
      }

      const queryUrl = entityFilter 
        ? '/api/observability/traces?entityName=' + encodeURIComponent(entityFilter)
        : '/api/observability/traces';

      try {
        const res = await fetch(queryUrl);
        const data = await res.json();
        
        if (!data.spans || data.spans.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No spans recorded yet for this view. Run an agent or workflow to stream telemetry.</td></tr>';
          return;
        }

        tbody.innerHTML = data.spans.map(s => {
          const totalTokens = s.attributes && s.attributes['llm.usage.total_tokens'] ? s.attributes['llm.usage.total_tokens'] : '-';
          const statusClass = s.status === 'error' ? 'status-error' : 'status-success';
          const timeStr = new Date(s.startedAt).toLocaleTimeString();
          return \`
            <tr onclick="showDetail('\${s.id}')" style="cursor: pointer;">
              <td><span class="span-name">\${s.name}</span></td>
              <td><span class="span-entity">\${s.entityName || '-'}</span></td>
              <td><span style="font-family: var(--font-mono); font-size: 0.78rem;">\${s.spanType || '-'}</span></td>
              <td><span class="status-pill \${statusClass}">\${s.status || 'success'}</span></td>
              <td style="font-family: var(--font-mono); font-size: 0.8rem;">\${totalTokens}</td>
              <td style="color: var(--text-muted); font-size: 0.8rem;">\${timeStr}</td>
            </tr>
          \`;
        }).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error); padding: 2rem;">Failed to fetch traces: ' + err.message + '</td></tr>';
      }
    }

    async function showDetail(id) {
      const drawer = document.getElementById('span-drawer');
      const drawerTitle = document.getElementById('drawer-title');
      const drawerContent = document.getElementById('drawer-content');
      try {
        const res = await fetch('/api/observability/spans/' + id);
        const span = await res.json();
        drawerTitle.textContent = span.name + ' (' + (span.entityName || 'Global') + ')';
        drawerContent.textContent = JSON.stringify(span, null, 2);
        drawer.style.display = 'block';
      } catch (err) {
        alert('Failed to load span details: ' + err.message);
      }
    }

    loadSpans();
  </script>
</body>
</html>`);
  };

  app.get('/', renderStudioDashboard);
  app.get('/traces', renderStudioDashboard);
  app.get('/agents', renderStudioDashboard);
  app.get('/agents/:id/traces', renderStudioDashboard);
  app.get('/workflows/:id/traces', renderStudioDashboard);

  return { app, pool };
}

if (process.env.NODE_ENV !== 'test') {
  const { app } = createStudioApp();
  app.listen(PORT, HOST, () => {
    console.log(`[Mastra Studio] Running at http://${HOST}:${PORT}`);
    console.log(`[Mastra Studio] Canonical Traces: http://localhost:${PORT}/traces`);
    console.log(`[Mastra Studio] Agents View: http://localhost:${PORT}/agents`);
  });
}
