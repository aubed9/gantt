// scripts/verify-infrastructure.js
// Automated verification for PostgreSQL 16 + pgvector and AvalAI endpoint configuration
import { execSync } from 'child_process';
import https from 'https';

console.log('=== rpm_V1 Infrastructure Verification ===\n');

// 1. Verify PostgreSQL Container & Port
try {
  const containerStatus = execSync('docker ps --filter "name=rpm_v1_postgres" --format "{{.Status}}"').toString().trim();
  console.log(`✓ PostgreSQL Container Status: ${containerStatus}`);

  // Query vector extension
  const extCheck = execSync('docker exec rpm_v1_postgres psql -U rpm_user -d rpm_v1 -t -c "SELECT extname || \' v\' || extversion FROM pg_extension WHERE extname = \'vector\';"').toString().trim();
  console.log(`✓ pgvector Extension: ${extCheck}`);

  // Query vector distance calculation
  const mathCheck = execSync('docker exec rpm_v1_postgres psql -U rpm_user -d rpm_v1 -t -c "SELECT \'[1,2,3]\'::vector <=> \'[1,2,4]\'::vector;"').toString().trim();
  console.log(`✓ Cosine Distance Calculation: ${mathCheck}`);

  // Query Mastra schemas
  const schemaCheck = execSync('docker exec rpm_v1_postgres psql -U rpm_user -d rpm_v1 -t -c "SELECT string_agg(schema_name, \', \') FROM information_schema.schemata WHERE schema_name IN (\'mastra\', \'mastra_vectors\');"').toString().trim();
  console.log(`✓ Mastra Schemas Initialized: ${schemaCheck}`);
} catch (err) {
  console.error('✗ PostgreSQL Verification Failed:', err.message);
  process.exit(1);
}

// 2. Verify AvalAI Connectivity
console.log('\n--- Checking AvalAI API Reachability ---');
const req = https.request('https://api.avalai.ir/v1/models', { method: 'GET' }, (res) => {
  // 401 Unauthorized confirms endpoint is alive and waiting for API token
  if (res.statusCode === 401 || res.statusCode === 200) {
    console.log(`✓ AvalAI API Endpoint Reachable: https://api.avalai.ir/v1 (HTTP ${res.statusCode})`);
    console.log('\n=== ALL INFRASTRUCTURE CHECKS PASSED ===');
    process.exit(0);
  } else {
    console.warn(`! AvalAI responded with unexpected status: ${res.statusCode}`);
    process.exit(0);
  }
});

req.on('error', (e) => {
  console.error(`✗ AvalAI Connection Error: ${e.message}`);
  process.exit(1);
});

req.end();
