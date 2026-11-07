#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
OUT_FILE="$BACKUP_DIR/fasal_awaaz_${TIMESTAMP}.dump"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required to run pg_dump." >&2
  exit 1
fi

echo "[Fasal Awaaz Backup] Creating PostgreSQL custom-format dump at $OUT_FILE ..."
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > "$OUT_FILE"
sha256sum "$OUT_FILE" > "${OUT_FILE}.sha256"
echo "[Fasal Awaaz Backup] Completed successfully. Checksum saved to ${OUT_FILE}.sha256"
