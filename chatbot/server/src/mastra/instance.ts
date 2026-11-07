import { Mastra } from '@mastra/core';
import {
  rpmAssistantAgent,
  taskClaimRankingAgent,
  eojAssessorAgent,
} from './agents/index.js';
import {
  rpmChatWorkflow,
  reportIngestionWorkflow,
} from './workflows/index.js';
import { resolveModel } from './models/index.js';

/**
 * ARCHITECTURAL INVARIANT: Exactly one Mastra instance must exist across
 * chatbot/server/src/, located strictly in instance.ts.
 * Pinned by test/mastra/instance-binding.test.ts
 */
export const mastra = new Mastra({
  agents: {
    'rpm-assistant-agent': rpmAssistantAgent,
    'task-claim-ranking-agent': taskClaimRankingAgent,
    'eoj-assessor-agent': eojAssessorAgent,
  },
  workflows: {
    'rpm-chat-v1': rpmChatWorkflow,
    'report-ingestion-v1': reportIngestionWorkflow,
  },
});

/**
 * First-Class Typed Accessors:
 * Retrieve registered agents directly from the single Mastra instance
 * and bind dynamic models at call time for live AvalAI API key resolution.
 */
export function getRpmAssistantAgent() {
  const agent = mastra.getAgent('rpm-assistant-agent');
  if (!agent) {
    throw new Error('Agent "rpm-assistant-agent" is not registered in the Mastra instance');
  }
  agent.model = resolveModel();
  return agent;
}

export function getTaskClaimRankingAgent() {
  const agent = mastra.getAgent('task-claim-ranking-agent');
  if (!agent) {
    throw new Error('Agent "task-claim-ranking-agent" is not registered in the Mastra instance');
  }
  agent.model = resolveModel();
  return agent;
}

export function getEojAssessorAgent() {
  const agent = mastra.getAgent('eoj-assessor-agent');
  if (!agent) {
    throw new Error('Agent "eoj-assessor-agent" is not registered in the Mastra instance');
  }
  agent.model = resolveModel();
  return agent;
}

export function getRpmChatWorkflow() {
  const workflow = mastra.getWorkflow('rpm-chat-v1');
  if (!workflow) {
    throw new Error('Workflow "rpm-chat-v1" is not registered in the Mastra instance');
  }
  return workflow;
}

export function getReportIngestionWorkflow() {
  const workflow = mastra.getWorkflow('report-ingestion-v1');
  if (!workflow) {
    throw new Error('Workflow "report-ingestion-v1" is not registered in the Mastra instance');
  }
  return workflow;
}
