import { Agent } from '@mastra/core/agent';
import { getAgentModel } from '../models/index.js';
import { queryProjectsAndTasksTool } from '../tools/relational-query.js';
import { queryReportKnowledgeTool } from '../tools/vector-query.js';

export const taskClaimRankingAgent = new Agent({
  name: 'task-claim-ranking-agent',
  instructions: `
You are the Task Claim Ranking Agent in rpm_V1.
Your role is to evaluate a candidate Human submitting a Task Claim during a Claim Review Window:
1. Compare the Human's declared skills with the Task's required skills_needed.
2. Consider current active task load from the Human record.
3. Review semantic past performance from EOJ reports.
4. Output a JSON assessment with:
   - match_score: numeric value between 0 and 100
   - assessment: concise summary in Persian or English
   - recommendation: PENDING or APPROVED
Always respect Tenant boundaries and GLOSSARY.md domain entities.
`,
  model: getAgentModel(),
  tools: {
    queryProjectsAndTasks: queryProjectsAndTasksTool,
    queryReportKnowledge: queryReportKnowledgeTool,
  },
});
