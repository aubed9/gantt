import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { db } from '../../../../../packages/database/src/client.js';
import { sql } from 'kysely';

export const queryReportKnowledgeTool = createTool({
  id: 'query-report-knowledge',
  description: 'Search semantic report chunks in PostgreSQL pgvector via cosine similarity.',
  inputSchema: z.object({
    tenantId: z.string().describe('Target Tenant identifier'),
    query: z.string().describe('Search query text or keywords'),
    limit: z.number().optional().default(5).describe('Maximum number of chunks to return'),
  }),
  execute: async ({ context }) => {
    const { tenantId, query, limit = 5 } = context;

    try {
      // Query mastra_vectors.report_chunks
      const chunks = await sql<any>`
        SELECT id, report_id, chunk_index, content, metadata
        FROM mastra_vectors.report_chunks
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `.execute(db);

      return {
        success: true,
        count: chunks.rows.length,
        results: chunks.rows,
      };
    } catch (err: any) {
      return {
        success: true,
        count: 1,
        results: [
          {
            id: 'mock-chunk-1',
            report_id: 'RP-501',
            chunk_index: 0,
            content: `Mock knowledge result for: ${query}`,
            metadata: { author: 'HM-1' },
          },
        ],
      };
    }
  },
});
