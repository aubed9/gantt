#!/bin/sh
set -e

echo "[rpm_V1 Studio Entrypoint] Starting Mastra Studio Service on :4111..."

if [ -n "$POSTGRES_HOST" ]; then
  PG_HOST="${POSTGRES_HOST:-postgres}"
  PG_PORT="${POSTGRES_PORT:-5432}"
  PG_USER="${POSTGRES_USER:-rpm_user}"
  PG_DB="${POSTGRES_DB:-rpm_v1}"

  echo "[rpm_V1 Studio Entrypoint] Waiting for PostgreSQL at ${PG_HOST}:${PG_PORT} (${PG_DB})..."
  until pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" > /dev/null 2>&1; do
    echo "[rpm_V1 Studio Entrypoint] PostgreSQL is unavailable — sleeping 2s..."
    sleep 2
  done
  echo "[rpm_V1 Studio Entrypoint] PostgreSQL telemetry sink is ready."
fi

echo "[rpm_V1 Studio Entrypoint] Executing Studio command: $@"
exec "$@"
