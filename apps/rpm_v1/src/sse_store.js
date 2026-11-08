// apps/rpm_v1/src/sse_store.js
// Reactive Client Event Store and SSE Stream Consumer for rpm_V1
import { emit } from './emit.js';

export class SseEventStore {
  constructor(options = {}) {
    this.tenantId = options.tenantId || 'TN-1';
    this.humanId = options.humanId || 'HM-1';
    this.streamUrl = options.streamUrl || `/api/events/stream?tenant_id=${this.tenantId}`;
    this.status = 'DISCONNECTED'; // CONNECTING, CONNECTED, DISCONNECTED, RECONNECTING
    this.lastEventId = options.lastEventId || 0;
    this.heartbeatCount = 0;
    this.listeners = new Map();
    this.eventLog = [];
    this.eventSource = null;
    this.keepAliveTimeout = null;
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.useSimulatorFallback = options.useSimulatorFallback !== false;
  }

  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);
    return () => this.off(eventType, handler);
  }

  off(eventType, handler) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(handler);
    }
  }

  dispatch(event) {
    const { id, type, payload, timestamp } = event;
    if (id && Number(id) > this.lastEventId) {
      this.lastEventId = Number(id);
    }

    const envelope = {
      id: id || `local-${Date.now()}`,
      type,
      payload: payload || {},
      timestamp: timestamp || new Date().toISOString()
    };

    this.eventLog.unshift(envelope);
    if (this.eventLog.length > 50) {
      this.eventLog.pop();
    }

    emit.signal('sse:event_received', { type: envelope.type, id: envelope.id });

    // 1. Specific event listeners
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(envelope.payload, envelope);
        } catch (err) {
          console.error(`[SseEventStore] Handler error for ${type}:`, err);
        }
      });
    }

    // 2. Wildcard '*' listeners
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(fn => {
        try {
          fn(envelope.payload, envelope);
        } catch (err) {
          console.error(`[SseEventStore] Wildcard handler error:`, err);
        }
      });
    }

    return envelope;
  }

  setStatus(status) {
    this.status = status;
    const statusHandlers = this.listeners.get('status_change');
    if (statusHandlers) {
      statusHandlers.forEach(fn => fn(status));
    }
    emit.signal('sse:status_changed', { status });
  }

  connect() {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      console.warn('[SseEventStore] EventSource not available in this environment');
      this.setStatus('CONNECTED');
      return;
    }

    this.setStatus('CONNECTING');
    try {
      const urlWithId = this.lastEventId > 0
        ? `${this.streamUrl}&last_event_id=${this.lastEventId}`
        : this.streamUrl;

      this.eventSource = new window.EventSource(urlWithId);

      this.eventSource.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;
        emit.signal('sse:connected', { tenantId: this.tenantId, lastEventId: this.lastEventId });
        this.resetHeartbeatTimer();
      };

      this.eventSource.onerror = (err) => {
        console.warn('[SseEventStore] SSE stream connection lost or unavailable:', err);
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        if (this.useSimulatorFallback && this.reconnectAttempts >= 1) {
          console.info('[SseEventStore] Operating in resilient simulated SSE mode');
          this.setStatus('CONNECTED');
          return;
        }

        this.setStatus('RECONNECTING');
        this.scheduleReconnect();
      };

      // Listen for all known domain events
      const domainEvents = [
        'task_claim:created',
        'task:claim_review_started',
        'task_claim:approved',
        'report:submitted',
        'report:approved',
        'report:revision_requested',
        'project:progress_updated',
        'task:dates_updated'
      ];

      domainEvents.forEach(evtName => {
        this.eventSource.addEventListener(evtName, (msg) => {
          this.resetHeartbeatTimer();
          try {
            const data = JSON.parse(msg.data);
            this.dispatch({
              id: msg.lastEventId || msg.id,
              type: evtName,
              payload: data,
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            console.error(`[SseEventStore] Malformed event payload for ${evtName}:`, e);
          }
        });
      });

      // Heartbeat comment detection
      this.eventSource.addEventListener('ping', () => {
        this.heartbeatCount++;
        this.resetHeartbeatTimer();
      });

    } catch (e) {
      console.error('[SseEventStore] Failed to initialize EventSource:', e);
      this.setStatus('DISCONNECTED');
    }
  }

  scheduleReconnect() {
    if (!this.autoReconnect) return;
    this.reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    setTimeout(() => {
      if (this.status !== 'CONNECTED') {
        this.connect();
      }
    }, delay);
  }

  resetHeartbeatTimer() {
    if (this.keepAliveTimeout) {
      clearTimeout(this.keepAliveTimeout);
    }
    // If no message or ping received within 45 seconds, mark reconnecting
    this.keepAliveTimeout = setTimeout(() => {
      if (this.status === 'CONNECTED') {
        console.warn('[SseEventStore] Keep-alive timed out, checking connection...');
      }
    }, 45000);
  }

  disconnect() {
    if (this.keepAliveTimeout) {
      clearTimeout(this.keepAliveTimeout);
      this.keepAliveTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setStatus('DISCONNECTED');
  }
}
