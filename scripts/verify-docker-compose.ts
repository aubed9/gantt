import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== rpm_V1 Production Docker Compose & Service Orchestration Verification ===\n');

// 1. Verify all required deployment files exist
console.log('--- 1. Verifying Deployment Configuration Artifacts ---');
const requiredFiles = [
  'docker-compose.prod.yml',
  '.env.production.example',
  'deploy/Dockerfile.backend',
  'deploy/entrypoint-backend.sh',
  'deploy/Dockerfile.studio',
  'deploy/entrypoint-studio.sh',
  'deploy/nginx/nginx.conf',
  'deploy/nginx/conf.d/rpm_v1.conf',
  'chatbot/server/src/studio/server.ts',
];

for (const relPath of requiredFiles) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing required file: ${relPath}`);
    process.exit(1);
  }
  console.log(`✓ Found: ${relPath}`);
}

// 2. Validate Docker Compose syntax via CLI
console.log('\n--- 2. Validating docker-compose.prod.yml via Docker Compose CLI ---');
try {
  const composeConfig = execSync('docker compose -f docker-compose.prod.yml config', {
    cwd: rootDir,
    encoding: 'utf-8',
    env: {
      ...process.env,
      AVALAI_API_KEY: 'mock-key-for-config-validation',
    },
  });
  console.log('✓ "docker compose -f docker-compose.prod.yml config" passed with zero errors.');

  // Check expected services in the parsed config
  const services = ['postgres', 'backend', 'studio', 'proxy'];
  for (const svc of services) {
    if (!composeConfig.includes(`container_name: rpm_v1_${svc === 'proxy' ? 'proxy' : svc}_prod`) &&
        !composeConfig.includes(`${svc}:`)) {
      console.error(`❌ Missing expected service in compose config: ${svc}`);
      process.exit(1);
    }
    console.log(`✓ Service verified: "${svc}"`);
  }
} catch (err: any) {
  console.error('❌ Failed to validate docker-compose.prod.yml config:', err.message);
  process.exit(1);
}

// 3. Verify Nginx Reverse Proxy Configuration & Invariants
console.log('\n--- 3. Verifying Nginx Reverse Proxy & SSE Invariants ---');
const nginxConfPath = path.join(rootDir, 'deploy/nginx/conf.d/rpm_v1.conf');
const nginxContent = fs.readFileSync(nginxConfPath, 'utf-8');

if (!nginxContent.includes('/api/events/stream')) {
  console.error('❌ Nginx config missing /api/events/stream SSE location');
  process.exit(1);
}
if (!nginxContent.includes('proxy_buffering off;') || !nginxContent.includes('proxy_cache off;')) {
  console.error('❌ Nginx SSE location must explicitly disable proxy buffering and caching');
  process.exit(1);
}
console.log('✓ Nginx SSE stream (/api/events/stream) has buffering and caching disabled');

if (!nginxContent.includes('client_max_body_size 25m;')) {
  console.error('❌ Nginx config must allow up to 25m client_max_body_size for audio uploads');
  process.exit(1);
}
console.log('✓ Nginx configured with client_max_body_size 25m for speech-to-text audio uploads');

if (!nginxContent.includes('upstream backend_gateway') || !nginxContent.includes('upstream mastra_studio')) {
  console.error('❌ Nginx config must define backend_gateway and mastra_studio upstreams');
  process.exit(1);
}
console.log('✓ Nginx upstreams "backend_gateway" (:3120) and "mastra_studio" (:4111) configured');

// 4. Verify Single Mastra Instance Invariant
console.log('\n--- 4. Verifying Single Mastra Instance Invariant Across Codebase ---');
const srcDir = path.join(rootDir, 'chatbot/server/src');
function scanDir(dir: string): string[] {
  let list: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      list = list.concat(scanDir(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
      list.push(full);
    }
  }
  return list;
}

const sourceFiles = scanDir(srcDir);
const instances: string[] = [];
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  if (/new\s+Mastra\s*\(/.test(content)) {
    instances.push(path.relative(rootDir, file).replace(/\\/g, '/'));
  }
}

if (instances.length !== 1 || !instances[0].includes('chatbot/server/src/mastra/instance.ts')) {
  console.error(`❌ Single Mastra instance invariant broken! Found ${instances.length} instances:`, instances);
  process.exit(1);
}
console.log('✓ Exactly ONE "new Mastra(" instance confirmed strictly at: chatbot/server/src/mastra/instance.ts');

console.log('\n=== ALL DOCKER COMPOSE & SERVICE ORCHESTRATION VERIFICATIONS PASSED ===');
