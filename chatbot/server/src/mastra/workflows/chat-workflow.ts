import { createWorkflow } from '@mastra/core/workflows';

export const rpmChatWorkflow = createWorkflow({
  id: 'rpm-chat-v1',
  execute: async ({ input }) => {
    return {
      status: 'completed',
      output: `Echo from rpm-chat-v1 workflow: ${JSON.stringify(input)}`,
    };
  },
});
