import { db } from '../../../../../packages/database/src/client.js';
import { pgListenerService, PgNotificationEnvelope } from './pg-listener.service.js';

export interface DispatchEventParams {
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export class EventDispatcherService {
  private static monotonicCounter = Date.now();

  /**
   * Persists an event to the tenant_events table (which triggers trg_notify_tenant_event)
   * and broadcasts it immediately to local SSE listeners.
   */
  public async dispatch(params: DispatchEventParams): Promise<{ id: string | number }> {
    const { tenantId, eventType, entityType, entityId, payload } = params;

    let eventId: string | number = ++EventDispatcherService.monotonicCounter;

    try {
      const inserted = await db
        .insertInto('tenant_events')
        .values({
          tenant_id: tenantId,
          event_type: eventType,
          entity_type: entityType,
          entity_id: entityId,
          payload: payload as any,
          created_at: new Date(),
        })
        .returning('id')
        .executeTakeFirst();

      if (inserted && inserted.id) {
        eventId = inserted.id;
      }
    } catch (dbErr: any) {
      console.warn('[EventDispatcher] Could not insert into tenant_events table, using in-memory event ID:', dbErr.message);
    }

    const envelope: PgNotificationEnvelope = {
      e_id: eventId,
      t_id: tenantId,
      type: eventType,
      ent_id: entityId,
      ts: Date.now(),
    };

    // Broadcast through listener service
    pgListenerService.broadcastLocal(envelope);

    return { id: eventId };
  }
}

export const eventDispatcherService = new EventDispatcherService();
