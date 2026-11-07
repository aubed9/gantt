import { createWorkflow } from '@mastra/core/workflows';

export const reportIngestionWorkflow = createWorkflow({
  id: 'report-ingestion-v1',
  execute: async ({ input }) => {
    return {
      status: 'ingested',
      chunksIndexed: 1,
      metadata: input,
    };
  },
});
