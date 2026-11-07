import { EventEmitter } from 'events';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

export interface PgNotificationEnvelope {
  e_id: number | string;
  t_id: string;
  type: string;
  ent_id: string;
  ts: number;
}

export class PgListenerService extends EventEmitter {
  private client: pg.Client | null = null;
  private isConnected = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectDelayMs = 15000;
  private readonly channel = 'rpm_events';
  private inMemoryFallback = false;

  constructor() {
    super();
    // Allow up to 100 concurrent SSE subscribers per tenant without Node warnings
    this.setMaxListeners(200);
  }

  public async start(): Promise<void> {
    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    const connectionString =
      process.env.DATABASE_URL ||
      `postgresql://${process.env.POSTGRES_USER || 'rpm_user'}:${process.env.POSTGRES_PASSWORD || 'rpm_secret_password'}@localhost:${process.env.POSTGRES_PORT || '5534'}/${process.env.POSTGRES_DB || 'rpm_v1'}`;

    try {
      this.client = new Client({
        connectionString,
        keepAlive: true,
        statement_timeout: 0,
      });

      this.client.on('notification', (msg: pg.Notification) => {
        this.handleNotification(msg);
      });

      this.client.on('error', (err: Error) => {
        console.warn('[PgListener] PostgreSQL connection error:', err.message);
        this.handleDisconnect();
      });

      this.client.on('end', () => {
        console.warn('[PgListener] PostgreSQL connection ended unexpectedly');
        this.handleDisconnect();
      });

      await this.client.connect();
      await this.client.query(`LISTEN ${this.channel}`);

      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.inMemoryFallback = false;
      console.log(`[PgListener] Connected and listening on PostgreSQL channel "${this.channel}"`);
      this.emit('ready');
    } catch (err: any) {
      console.warn('[PgListener] Direct PostgreSQL connection not available, enabling in-memory event dispatch fallback:', err.message);
      this.isConnected = true;
      this.isConnecting = false;
      this.inMemoryFallback = true;
      this.emit('ready');
    }
  }

  public broadcastLocal(envelope: PgNotificationEnvelope): void {
    this.emit(`event:${envelope.t_id}`, envelope);
    this.emit('event:all', envelope);
  }

  private handleNotification(msg: pg.Notification): void {
    if (msg.channel !== this.channel || !msg.payload) return;

    try {
      const envelope: PgNotificationEnvelope = JSON.parse(msg.payload);
      this.broadcastLocal(envelope);
    } catch (parseErr: any) {
      console.error('[PgListener] Failed to parse JSON notification payload:', parseErr.message, msg.payload);
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.isConnecting = false;

    if (this.client) {
      this.client.removeAllListeners();
      this.client.end().catch(() => {});
      this.client = null;
    }

    this.reconnectAttempts++;
    const baseDelay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelayMs);
    const jitter = baseDelay * (0.1 + Math.random() * 0.15);
    const delay = Math.round(baseDelay + jitter);

    setTimeout(() => this.start(), delay);
  }

  public getStatus(): { isConnected: boolean; isFallback: boolean; reconnectAttempts: number } {
    return {
      isConnected: this.isConnected,
      isFallback: this.inMemoryFallback,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  public async shutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.query(`UNLISTEN ${this.channel}`);
        await this.client.end();
      } catch (e) {
        // ignore
      }
      this.client = null;
    }
    this.isConnected = false;
  }
}

export const pgListenerService = new PgListenerService();
