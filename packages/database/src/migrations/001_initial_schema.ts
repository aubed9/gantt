import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Extensions & Schemas
  await sql`CREATE EXTENSION IF NOT EXISTS vector;`.execute(db);
  await sql`CREATE SCHEMA IF NOT EXISTS mastra;`.execute(db);
  await sql`CREATE SCHEMA IF NOT EXISTS mastra_vectors;`.execute(db);

  // 2. Custom Enums
  await sql`
    DO $$ BEGIN
      CREATE TYPE task_state_enum AS ENUM (
        'DRAFT', 'OPEN_FOR_CLAIM', 'CLAIM_REVIEW', 'ASSIGNED',
        'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED', 'CANCELLED'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `.execute(db);

  await sql`
    DO $$ BEGIN
      CREATE TYPE claim_state_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `.execute(db);

  await sql`
    DO $$ BEGIN
      CREATE TYPE report_state_enum AS ENUM ('DRAFT', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `.execute(db);

  // 3. Tenants Table (TN)
  await sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);

  // 4. Humans Table (HM)
  await sql`
    CREATE TABLE IF NOT EXISTS humans (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL,
      is_internal BOOLEAN NOT NULL DEFAULT TRUE,
      skills TEXT[] NOT NULL DEFAULT '{}',
      active_tasks_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_humans_tenant_email UNIQUE (tenant_id, email)
    );
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_humans_tenant ON humans(tenant_id);`.execute(db);

  // 5. Projects Table (PR)
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      manager_id VARCHAR(64) REFERENCES humans(id) ON DELETE SET NULL,
      owner_id VARCHAR(64) REFERENCES humans(id) ON DELETE SET NULL,
      cto_id VARCHAR(64) REFERENCES humans(id) ON DELETE SET NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
      progress NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
      rolling_summary_fa TEXT,
      rolling_summary_en TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_projects_tenant_code UNIQUE (tenant_id, code)
    );
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);`.execute(db);

  // 6. Tasks Table (TS)
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id INT REFERENCES tasks(id) ON DELETE CASCADE,
      text VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'task',
      start_date TIMESTAMPTZ NOT NULL,
      duration INT NOT NULL DEFAULT 1,
      end_date TIMESTAMPTZ NOT NULL,
      progress NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
      state task_state_enum NOT NULL DEFAULT 'DRAFT',
      assignee_id VARCHAR(64) REFERENCES humans(id) ON DELETE SET NULL,
      skills_needed TEXT[] NOT NULL DEFAULT '{}',
      eoj_report_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);`.execute(db);

  // 7. Task Claims Table
  await sql`
    CREATE TABLE IF NOT EXISTS task_claims (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      human_id VARCHAR(64) NOT NULL REFERENCES humans(id) ON DELETE CASCADE,
      status claim_state_enum NOT NULL DEFAULT 'PENDING',
      match_score NUMERIC(5,2),
      ai_candidate_assessment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_task_claims_task_human UNIQUE (task_id, human_id)
    );
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_task_claims_tenant ON task_claims(tenant_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_task_claims_task ON task_claims(task_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_task_claims_human ON task_claims(human_id);`.execute(db);

  // 8. Events Table (EV)
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      event_date TIMESTAMPTZ NOT NULL,
      is_milestone BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);`.execute(db);

  // 9. Reports Table (RP & EOJ)
  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id INT REFERENCES tasks(id) ON DELETE SET NULL,
      event_id VARCHAR(64) REFERENCES events(id) ON DELETE SET NULL,
      author_id VARCHAR(64) NOT NULL REFERENCES humans(id) ON DELETE RESTRICT,
      report_type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content_markdown TEXT NOT NULL,
      status report_state_enum NOT NULL DEFAULT 'SUBMITTED',
      reviewer_id VARCHAR(64) REFERENCES humans(id) ON DELETE SET NULL,
      reviewer_feedback TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ
    );
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_reports_tenant ON reports(tenant_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_reports_task ON reports(task_id);`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);`.execute(db);

  // 10. Mastra Vectors Knowledge Table (mastra_vectors.report_chunks)
  await sql`
    CREATE TABLE IF NOT EXISTS mastra_vectors.report_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      report_id VARCHAR(64) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      chunk_index INT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(1536),
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_chunks_embedding_hnsw
    ON mastra_vectors.report_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_chunks_metadata_gin
    ON mastra_vectors.report_chunks USING gin (metadata);
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_chunks_tenant_report
    ON mastra_vectors.report_chunks (tenant_id, report_id);
  `.execute(db);

  // 11. Real-Time Outbox Table (tenant_events) for SSE & LISTEN/NOTIFY
  await sql`
    CREATE TABLE IF NOT EXISTS tenant_events (
      id BIGSERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      event_type VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_tenant_events_tenant_replay 
    ON tenant_events (tenant_id, id ASC);
  `.execute(db);

  // Trigger function for pg_notify with < 150-byte JSON envelope
  await sql`
    CREATE OR REPLACE FUNCTION fn_notify_tenant_event() 
    RETURNS TRIGGER AS $$
    DECLARE
      v_notification JSON;
    BEGIN
      v_notification := json_build_object(
        'e_id', NEW.id,
        't_id', NEW.tenant_id,
        'type', NEW.event_type,
        'ent_id', NEW.entity_id,
        'ts', (EXTRACT(EPOCH FROM NEW.created_at) * 1000)::BIGINT
      );

      PERFORM pg_notify('rpm_events', v_notification::TEXT);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`DROP TRIGGER IF EXISTS trg_notify_tenant_event ON tenant_events;`.execute(db);
  await sql`
    CREATE TRIGGER trg_notify_tenant_event
    AFTER INSERT ON tenant_events
    FOR EACH ROW
    EXECUTE FUNCTION fn_notify_tenant_event();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS trg_notify_tenant_event ON tenant_events;`.execute(db);
  await sql`DROP FUNCTION IF EXISTS fn_notify_tenant_event();`.execute(db);
  await sql`DROP TABLE IF EXISTS tenant_events CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS mastra_vectors.report_chunks CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS reports CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS events CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS task_claims CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS tasks CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS projects CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS humans CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS tenants CASCADE;`.execute(db);

  await sql`DROP TYPE IF EXISTS report_state_enum;`.execute(db);
  await sql`DROP TYPE IF EXISTS claim_state_enum;`.execute(db);
  await sql`DROP TYPE IF EXISTS task_state_enum;`.execute(db);
}
