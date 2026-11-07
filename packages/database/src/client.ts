import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export function createDatabasePool(): pg.Pool {
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || 'rpm_user'}:${process.env.POSTGRES_PASSWORD || 'rpm_secret_password'}@localhost:${process.env.POSTGRES_PORT || '5534'}/${process.env.POSTGRES_DB || 'rpm_v1'}`;

  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export function createDatabase(pool?: pg.Pool): Kysely<Database> {
  const activePool = pool ?? createDatabasePool();
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: activePool,
    }),
  });
}

export const db = createDatabase();
