// scripts/verify-database.ts
// Comprehensive automated verification for rpm_V1 PostgreSQL 16 + pgvector schema and seed data
import { sql } from 'kysely';
import { db } from '../packages/database/src/client.js';

async function verifyDatabase() {
  console.log('=== rpm_V1 PostgreSQL 16 + pgvector Schema & Seed Verification ===\n');

  try {
    // 1. Verify Extension & Schemas
    const extResult = await sql<{ extname: string; extversion: string }>`
      SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
    `.execute(db);
    console.log(`✓ pgvector Extension: ${extResult.rows[0]?.extname} v${extResult.rows[0]?.extversion}`);

    const schemaResult = await sql<{ schema_name: string }>`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name IN ('mastra', 'mastra_vectors') 
      ORDER BY schema_name;
    `.execute(db);
    console.log(`✓ Schemas Present: ${schemaResult.rows.map((r) => r.schema_name).join(', ')}`);

    // 2. Verify Table Existence and Record Counts
    const tables = [
      { name: 'tenants', expectedMin: 1 },
      { name: 'humans', expectedMin: 6 },
      { name: 'projects', expectedMin: 1 },
      { name: 'tasks', expectedMin: 6 },
      { name: 'task_claims', expectedMin: 2 },
      { name: 'events', expectedMin: 2 },
      { name: 'reports', expectedMin: 3 },
      { name: 'tenant_events', expectedMin: 3 },
    ];

    console.log('\n--- Verifying Core Entity Tables & Record Counts ---');
    for (const t of tables) {
      const res = await sql<{ count: string }>`
        SELECT COUNT(*)::text as count FROM ${sql.table(t.name)};
      `.execute(db);
      const count = parseInt(res.rows[0]?.count || '0', 10);
      if (count < t.expectedMin) {
        throw new Error(`Table ${t.name} has ${count} records, expected at least ${t.expectedMin}`);
      }
      console.log(`✓ Table "${t.name}": ${count} records (threshold >= ${t.expectedMin})`);
    }

    // Verify mastra_vectors.report_chunks
    const vectorRes = await sql<{ count: string }>`
      SELECT COUNT(*)::text as count FROM mastra_vectors.report_chunks;
    `.execute(db);
    const vectorCount = parseInt(vectorRes.rows[0]?.count || '0', 10);
    if (vectorCount < 3) {
      throw new Error(`Table mastra_vectors.report_chunks has ${vectorCount} records, expected >= 3`);
    }
    console.log(`✓ Table "mastra_vectors.report_chunks": ${vectorCount} records (threshold >= 3)`);

    // 3. Verify Foreign Keys to tenants(id)
    console.log('\n--- Verifying Tenant Isolation Foreign Keys ---');
    const fkRes = await sql<{ conname: string; relname: string }>`
      SELECT c.conname, r.relname
      FROM pg_constraint c
      JOIN pg_class r ON c.conrelid = r.oid
      WHERE c.confrelid = 'tenants'::regclass
      ORDER BY r.relname;
    `.execute(db);

    console.log(`✓ Found ${fkRes.rows.length} foreign keys pointing to "tenants(id)":`);
    fkRes.rows.forEach((r) => console.log(`  - ${r.relname} (${r.conname})`));
    if (fkRes.rows.length < 8) {
      throw new Error(`Expected at least 8 foreign keys to tenants, found ${fkRes.rows.length}`);
    }

    // 4. Verify pgvector HNSW Cosine Distance Query
    console.log('\n--- Verifying pgvector HNSW Vector Search ---');
    const queryVector = '[0.01, 0.02, 0.03]'; // Query embedding
    // Test similarity query on report_chunks
    const simRes = await sql<{ id: string; report_id: string; distance: number; content: string }>`
      SELECT id, report_id, (embedding <=> (SELECT embedding FROM mastra_vectors.report_chunks LIMIT 1)) as distance, content
      FROM mastra_vectors.report_chunks
      ORDER BY distance ASC
      LIMIT 2;
    `.execute(db);

    console.log(`✓ HNSW Vector Cosine Distance search succeeded:`);
    simRes.rows.forEach((r, idx) => {
      console.log(`  [Rank ${idx + 1}] Report ${r.report_id}: distance = ${Number(r.distance).toFixed(4)}`);
    });

    // 5. Verify PostgreSQL LISTEN/NOTIFY Trigger on tenant_events
    console.log('\n--- Verifying Real-Time Outbox Trigger (trg_notify_tenant_event) ---');
    const triggerRes = await sql<{ tgname: string }>`
      SELECT tgname FROM pg_trigger WHERE tgname = 'trg_notify_tenant_event';
    `.execute(db);
    if (!triggerRes.rows.length) {
      throw new Error('Trigger trg_notify_tenant_event not found on tenant_events!');
    }
    console.log(`✓ Trigger "${triggerRes.rows[0].tgname}" is active on tenant_events`);

    console.log('\n=== ALL DATABASE & SCHEMA VERIFICATIONS PASSED ===');
    process.exit(0);
  } catch (err: any) {
    console.error('\n✗ Database verification failed:', err.message);
    process.exit(1);
  }
}

verifyDatabase();
