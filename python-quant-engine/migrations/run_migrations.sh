#!/usr/bin/env bash
# Run all migration files in order against the target database.
# Usage: ./run_migrations.sh
# Requires: PGPASSWORD, PGUSER, PGDATABASE env vars (or defaults below).

set -euo pipefail

DB_NAME="${PGDATABASE:-traderetro_raw}"
DB_USER="${PGUSER:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Running migrations against ${DB_NAME}@${DB_HOST}:${DB_PORT} ==="

for sql_file in "$SCRIPT_DIR"/[0-9]*.sql; do
    echo "  -> $(basename "$sql_file")"
    psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -f "$sql_file"
done

echo "=== All migrations applied ==="
