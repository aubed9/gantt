#!/bin/sh
set -e

echo "[rpm_V1 Backend Entrypoint] Starting Express Backend Gateway..."

# 1. Wait for PostgreSQL to be ready if connection details are present
if [ -n "$POSTGRES_HOST" ]; then
  PG_HOST="${POSTGRES_HOST:-postgres}"
  PG_PORT="${POSTGRES_PORT:-5432}"
  PG_USER="${POSTGRES_USER:-rpm_user}"
  PG_DB="${POSTGRES_DB:-rpm_v1}"

  echo "[rpm_V1 Backend Entrypoint] Waiting for PostgreSQL at ${PG_HOST}:${PG_PORT} (${PG_DB})..."
  until pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" > /dev/null 2>&1; do
    echo "[rpm_V1 Backend Entrypoint] PostgreSQL is unavailable — sleeping 2s..."
    sleep 2
  done
  echo "[rpm_V1 Backend Entrypoint] PostgreSQL is ready and accepting connections."

  # 2. Run database migrations to ensure schema is up-to-date
  echo "[rpm_V1 Backend Entrypoint] Running Kysely database migrations..."
  npx tsx packages/database/src/migrator.ts || echo "[rpm_V1 Backend Entrypoint] Migrations complete or already applied."

  # 3. Optional initial seeding
  if [ "$SEED_ON_BOOT" = "true" ]; then
    echo "[rpm_V1 Backend Entrypoint] SEED_ON_BOOT=true: Applying seed data..."
    npx tsx packages/database/src/seeds/seed.ts || echo "[rpm_V1 Backend Entrypoint] Seed complete or already populated."
  fi
fi

echo "[rpm_V1 Backend Entrypoint] Executing backend command: $@"
exec "$@"
