import { Router, Request, Response } from 'express';
import { pgListenerService, PgNotificationEnvelope } from '../services/events/pg-listener.service.js';
import { db } from '../../../../packages/database/src/client.js';

export const eventsStreamRouter = Router();

/**
 * GET /api/events/stream
 * Persistent unidirectional Server-Sent Events (SSE) streaming endpoint.
 */
eventsStreamRouter.get('/stream', async (req: Request, res: Response) => {
  // 1. Resolve Tenant Boundary and Human identity
  const tenantId = (req.query.tenant_id as string) || (req.headers['x-tenant-id'] as string) || 'TN-1';
  const humanId = (req.headers['x-human-id'] as string) || 'HM-ANONYMOUS';

  // 2. Set Unbuffered Streaming HTTP Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  // 3. Initial connection handshake frame
  res.write(`retry: 5000\n:connected tenant=${tenantId} human=${humanId}\n\n`);

  // 4. Heartbeat comment ping every 20 seconds to prevent reverse proxy timeouts
  const keepAliveTimer = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch (e) {
      clearInterval(keepAliveTimer);
    }
  }, 20000);

  // 5. Handle Last-Event-ID replay for guaranteed at-least-once delivery
  const lastEventIdHeader = req.headers['last-event-id'] || req.query.last_event_id;
  if (lastEventIdHeader) {
    const lastId = parseInt(lastEventIdHeader as string, 10);
    if (!isNaN(lastId) && lastId > 0) {
      try {
        const replayRecords = await db
          .selectFrom('tenant_events')
          .select(['id', 'event_type', 'payload'])
          .where('tenant_id', '=', tenantId)
          .where('id', '>', String(lastId) as any)
          .orderBy('id', 'asc')
          .limit(100)
          .execute();

        for (const row of replayRecords) {
          const frame = `id: ${row.id}\nevent: ${row.event_type}\ndata: ${JSON.stringify(row.payload)}\n\n`;
          res.write(frame);
        }
      } catch (err: any) {
        console.warn('[SSE] Event replay query skipped:', err.message);
      }
    }
  }

  // 6. Live event forwarding callback
  const onTenantEvent = async (envelope: PgNotificationEnvelope) => {
    try {
      let payloadData: any = {
        entity_id: envelope.ent_id,
        timestamp: envelope.ts,
      };

      try {
        const record = await db
          .selectFrom('tenant_events')
          .select(['payload'])
          .where('id', '=', String(envelope.e_id) as any)
          .executeTakeFirst();

        if (record && record.payload) {
          payloadData = record.payload;
        }
      } catch (dbErr) {
        // fallback
      }

      const frame = `id: ${envelope.e_id}\nevent: ${envelope.type}\ndata: ${JSON.stringify(payloadData)}\n\n`;
      res.write(frame);
    } catch (err: any) {
      console.error('[SSE] Failed to write event frame to client:', err.message);
    }
  };

  const channelKey = `event:${tenantId}`;
  pgListenerService.on(channelKey, onTenantEvent);

  // 7. Cleanup Socket on Disconnection
  req.on('close', () => {
    clearInterval(keepAliveTimer);
    pgListenerService.removeListener(channelKey, onTenantEvent);
    res.end();
  });
});

/**
 * GET /api/events/history
 * Fetch historical events for debugging / testing.
 */
eventsStreamRouter.get('/history', async (req: Request, res: Response) => {
  const tenantId = (req.query.tenant_id as string) || 'TN-1';

  try {
    const events = await db
      .selectFrom('tenant_events')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .orderBy('id', 'desc')
      .limit(50)
      .execute();

    return res.json({ events });
  } catch (e: any) {
    return res.json({ events: [] });
  }
});
