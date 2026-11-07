import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  mastra,
  getRpmAssistantAgent,
  getTaskClaimRankingAgent,
  getEojAssessorAgent,
  getRpmChatWorkflow,
  getReportIngestionWorkflow,
} from '../../chatbot/server/src/mastra/instance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Mastra Single Instance & First-Class Agent Registration Invariants', () => {
  it('enforces exactly ONE new Mastra( instantiation across chatbot/server/src/', () => {
    const srcDir = path.resolve(__dirname, '../../chatbot/server/src');

    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanFiles(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const allSourceFiles = scanFiles(srcDir);
    const filesWithMastraInstantiation: string[] = [];

    const mastraInstantiationPattern = /new\s+Mastra\s*\(/g;

    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (mastraInstantiationPattern.test(content)) {
        filesWithMastraInstantiation.push(path.relative(srcDir, file).replace(/\\/g, '/'));
      }
    }

    expect(filesWithMastraInstantiation).toHaveLength(1);
    expect(filesWithMastraInstantiation[0]).toBe('mastra/instance.ts');
  });

  it('boots cleanly in key-free and database-free test environment', () => {
    // When NODE_ENV === 'test' or no API key, module import must never throw
    expect(mastra).toBeDefined();
  });

  it('registers all first-class domain agents within the single Mastra instance', () => {
    const rpmAgent = mastra.getAgent('rpm-assistant-agent');
    expect(rpmAgent).toBeDefined();
    expect(rpmAgent?.name).toBe('rpm-assistant-agent');

    const claimAgent = mastra.getAgent('task-claim-ranking-agent');
    expect(claimAgent).toBeDefined();
    expect(claimAgent?.name).toBe('task-claim-ranking-agent');

    const eojAgent = mastra.getAgent('eoj-assessor-agent');
    expect(eojAgent).toBeDefined();
    expect(eojAgent?.name).toBe('eoj-assessor-agent');
  });

  it('registers all domain workflows within the single Mastra instance', () => {
    const chatWf = mastra.getWorkflow('rpm-chat-v1');
    expect(chatWf).toBeDefined();
    expect(chatWf?.id).toBe('rpm-chat-v1');

    const ingestionWf = mastra.getWorkflow('report-ingestion-v1');
    expect(ingestionWf).toBeDefined();
    expect(ingestionWf?.id).toBe('report-ingestion-v1');
  });

  it('provides typed accessors that dynamically resolve models at call time', () => {
    const rpmAgent = getRpmAssistantAgent();
    expect(rpmAgent).toBeDefined();
    expect(rpmAgent.name).toBe('rpm-assistant-agent');
    expect(rpmAgent.model).toBeDefined();

    const claimAgent = getTaskClaimRankingAgent();
    expect(claimAgent).toBeDefined();
    expect(claimAgent.name).toBe('task-claim-ranking-agent');
    expect(claimAgent.model).toBeDefined();

    const eojAgent = getEojAssessorAgent();
    expect(eojAgent).toBeDefined();
    expect(eojAgent.name).toBe('eoj-assessor-agent');
    expect(eojAgent.model).toBeDefined();

    const chatWf = getRpmChatWorkflow();
    expect(chatWf).toBeDefined();
    expect(chatWf.id).toBe('rpm-chat-v1');

    const ingestionWf = getReportIngestionWorkflow();
    expect(ingestionWf).toBeDefined();
    expect(ingestionWf.id).toBe('report-ingestion-v1');
  });

  it('throws an informative error if an unknown agent is requested', () => {
    expect(() => {
      mastra.getAgent('non-existent-agent' as any);
    }).toThrow(/not found/i);
  });
});
