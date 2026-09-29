#!/usr/bin/env bash
# Daily PostgreSQL dump, keeps the last 7. Run as deploy (see pg-backup.timer).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
mkdir -p "$BACKUP_DIR"

podman exec autoneg-postgresql sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$BACKUP_DIR/autoneg-$(date +%F-%H%M).sql.gz"

ls -1t "$BACKUP_DIR"/autoneg-*.sql.gz | tail -n +8 | xargs -r rm --
