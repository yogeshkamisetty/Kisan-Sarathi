#!/usr/bin/env bash
set -euo pipefail

DUMP_FILE="${1:-}"
if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "Usage: $0 <path-to-backup.dump>" >&2
  exit 1
fi

if [ -f "${DUMP_FILE}.sha256" ]; then
  echo "[Fasal Awaaz Restore] Verifying SHA-256 checksum ..."
  sha256sum -c "${DUMP_FILE}.sha256"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required to run pg_restore." >&2
  exit 1
fi

echo "[Fasal Awaaz Restore] Restoring database from $DUMP_FILE ..."
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$DUMP_FILE"
echo "[Fasal Awaaz Restore] Database restore completed."
