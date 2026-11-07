import { Agent } from '@mastra/core/agent';
import { getAgentModel } from '../models/index.js';
import { queryProjectsAndTasksTool } from '../tools/relational-query.js';
import { queryReportKnowledgeTool } from '../tools/vector-query.js';

export const rpmAssistantAgent = new Agent({
  name: 'rpm-assistant-agent',
  instructions: `
You are the rpm_V1 Resource & Project Management Assistant.
You orchestrate projects, humans, tasks, events, and reports within an isolated Tenant boundary.
Adhere strictly to GLOSSARY.md domain entities and terminology.
`,
  model: getAgentModel(),
  tools: {
    queryProjectsAndTasks: queryProjectsAndTasksTool,
    queryReportKnowledge: queryReportKnowledgeTool,
  },
});
