#!/bin/bash
set -euo pipefail

# ── Discord notifications ────────────────────────────────────────────────────
# Webhook must come from the environment — never hardcode it (this file is in a
# public repo). Set DISCORD_WEBHOOK in the cron/systemd environment on the backup
# host, e.g. an EnvironmentFile or `/opt/slodi/backup.env` sourced below.
# Notifications are silently skipped if it is unset.
[ -f /opt/slodi/backup.env ] && . /opt/slodi/backup.env
DISCORD_WEBHOOK="${DISCORD_WEBHOOK:-}"
on_error() {
  if [ -n "${DISCORD_WEBHOOK:-}" ]; then
    curl -s -X POST "$DISCORD_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{\"content\": \"🚨 Slóði DB backup FAILED on $(hostname) at $(date)\"}"
  fi
  exit 1
}
trap on_error ERR

# ── Config ───────────────────────────────────────────────────────────────────
# Reads DB credentials from docker-compose environment so they stay in sync.
DB_CONTAINER="slodi-postgres"
DB_NAME="slodi_db"
DB_USER="slodi_user"
BACKUP_DIR="/opt/slodi/backups"
RETENTION_DAYS=30
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/slodi_${DATE}.dump"

# ── Pre-flight checks ───────────────────────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "[$(date)] ERROR: Container '$DB_CONTAINER' is not running" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ── Backup ───────────────────────────────────────────────────────────────────
echo "[$(date)] Starting backup..."

# pg_dump in custom format (already compressed, no separate --compress needed)
docker exec "$DB_CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  > "$BACKUP_FILE"

# Verify the dump file is non-empty
if [ ! -s "$BACKUP_FILE" ]; then
  echo "[$(date)] ERROR: Backup file is empty, removing" >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

echo "[$(date)] Backup saved: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# ── Authenticate via VM managed identity (token never expires) ────────────
az login --identity --allow-no-subscriptions --output none 2>/dev/null || true

# ── Upload to Azure Blob ────────────────────────────────────────────────────
az storage blob upload \
  --account-name slodibackups \
  --container-name db-backups \
  --name "$(basename "$BACKUP_FILE")" \
  --file "$BACKUP_FILE" \
  --auth-mode login

echo "[$(date)] Uploaded to Azure Blob Storage"

# ── Cleanup ──────────────────────────────────────────────────────────────────
find "$BACKUP_DIR" -name "*.dump" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"

# ── Success notification ─────────────────────────────────────────────────────
if [ -n "${DISCORD_WEBHOOK:-}" ]; then
  curl -s -X POST "$DISCORD_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"✅ Slóði DB backup completed: $(basename "$BACKUP_FILE") ($(du -sh "$BACKUP_FILE" | cut -f1))\"}"
fi
