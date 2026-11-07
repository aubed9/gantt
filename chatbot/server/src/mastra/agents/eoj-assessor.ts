import { Agent } from '@mastra/core/agent';
import { getAgentModel } from '../models/index.js';
import { queryProjectsAndTasksTool } from '../tools/relational-query.js';
import { queryReportKnowledgeTool } from '../tools/vector-query.js';

export const eojAssessorAgent = new Agent({
  name: 'eoj-assessor-agent',
  instructions: `
You are the End-of-Job (EOJ) Report Assessor in rpm_V1.
Your role is to evaluate submitted EOJ reports when a Task transitions from IN_PROGRESS to IN_REVIEW:
1. Verify completion of deliverables described in the Task.
2. Check for blockers, risks, or residual work.
3. Recommend approval (APPROVED) or revision requested (REVISION_REQUESTED) with actionable feedback.
4. Synthesize a concise Persian/English briefing for the Project Manager.
Strictly adhere to GLOSSARY.md domain entities.
`,
  model: getAgentModel(),
  tools: {
    queryProjectsAndTasks: queryProjectsAndTasksTool,
    queryReportKnowledge: queryReportKnowledgeTool,
  },
});
