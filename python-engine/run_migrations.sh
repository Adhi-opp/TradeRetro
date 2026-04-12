#!/usr/bin/env bash
# Run all SQL migrations in order against the target database.
# Usage: PGPASSWORD=postgres bash run_migrations.sh

set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-traderetro_raw}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for sql_file in "$SCRIPT_DIR"/0*.sql; do
    echo "Running $(basename "$sql_file") ..."
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$sql_file"
done

echo "All migrations complete."
