#!/usr/bin/env bash
# Find the leiðbeiningar and attachments the bank-card edit bug wiped (sc-530,
# sc-534), and write the SQL that puts them back. Changes nothing in prod.
#
# Run from your own machine:
#
#   ssh slodi-dev 'bash -s' < scripts/recover-leidbeiningar.sh
#   ssh slodi-dev bash -s -- /opt/slodi/backups/slodi_2026-09-12_03-00-00.dump < scripts/recover-leidbeiningar.sh
#
# With no argument it picks the newest backup taken before the bug shipped
# (#137, deployed 2026-09-13 23:22 UTC), i.e. slodi_2026-09-13_02-00-01. The
# 2026-09-14 02:00 backup, 2.5 h after the deploy and overnight, is usually the
# better baseline because it already has the release's own changes: pass it
# explicitly. It then:
#   1. restores that backup into a scratch database, slodi_recover, in the
#      same Postgres container (prod's slodi_db is only read);
#   2. copies prod's current id/instructions/media into the scratch database;
#   3. lists every item whose instructions were non-empty in the backup and
#      are empty now, or whose documents/images shrank;
#   4. writes ~/slodi-recover/restore.sql, one guarded UPDATE per item.
#
# Nothing is applied. Read report.csv, then apply with:
#
#   docker exec -i slodi-postgres psql -U slodi_user -d slodi_db -v ON_ERROR_STOP=1 -1 < ~/slodi-recover/restore.sql
#
# Each UPDATE only fires if the field is still empty/shrunk, so anything
# someone re-typed by hand since is left alone. Drop the scratch database
# afterwards with:
#
#   docker exec slodi-postgres dropdb -U slodi_user slodi_recover

set -euo pipefail

# Everything runs inside main(): with `ssh … bash -s < script` the script itself
# is stdin, and `docker exec -i` would otherwise swallow the rest of it. Bash
# reads the whole function before running any of it.
main() {

DB_CONTAINER="${DB_CONTAINER:-slodi-postgres}"
DB_USER="${DB_USER:-slodi_user}"
PROD_DB="${PROD_DB:-slodi_db}"
SCRATCH_DB="slodi_recover"
BACKUP_DIR="${BACKUP_DIR:-/opt/slodi/backups}"
BUG_SHIPPED="2026-09-13_23-22-00"  # backup names are slodi_YYYY-MM-DD_HH-MM-SS
OUT="${OUT:-$HOME/slodi-recover}"

psql_() { docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -v ON_ERROR_STOP=1 -X -q "$@"; }

# ── Pick the backup ──────────────────────────────────────────────────────────
DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  # Names are slodi_YYYY-MM-DD_HH-MM-SS.dump, so a string compare is a date compare.
  DUMP=$(ls -1 "$BACKUP_DIR"/slodi_*.dump 2>/dev/null \
    | awk -v cut="$BACKUP_DIR/slodi_$BUG_SHIPPED" '$0 < cut' | sort | tail -1)
fi
if [ -z "$DUMP" ] || [ ! -s "$DUMP" ]; then
  echo "No backup from before $BUG_SHIPPED in $BACKUP_DIR." >&2
  echo "Look in Azure: az storage blob list --account-name slodibackups -c db-backups --auth-mode login -o table" >&2
  exit 1
fi
echo "Backup: $DUMP ($(du -h "$DUMP" | cut -f1))"
mkdir -p "$OUT"

# ── 1. Restore into the scratch database ─────────────────────────────────────
docker exec "$DB_CONTAINER" dropdb -U "$DB_USER" --if-exists "$SCRATCH_DB"
docker exec "$DB_CONTAINER" createdb -U "$DB_USER" "$SCRATCH_DB"
# The whole dump, so content's enum types come along; --no-owner/--no-acl
# avoid role errors.
docker exec -i "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$SCRATCH_DB" \
  --no-owner --no-acl < "$DUMP" 2> "$OUT/pg_restore.log" \
  || { echo "pg_restore reported errors, see $OUT/pg_restore.log" >&2; tail -5 "$OUT/pg_restore.log" >&2; }
psql_ -d "$SCRATCH_DB" -c "ALTER TABLE content RENAME TO backup_content;"

# ── 2. Copy prod's current values next to it (read-only on prod) ────────────
psql_ -d "$SCRATCH_DB" -c "CREATE TABLE current_content (id uuid PRIMARY KEY, name text, content_type text, instructions text, media jsonb, deleted_at timestamptz);"
psql_ -d "$PROD_DB" -c "\copy (SELECT id, name, content_type, instructions, media, deleted_at FROM content) TO STDOUT" \
  | psql_ -d "$SCRATCH_DB" -c "\copy current_content FROM STDIN"

# ── 3. Compare ───────────────────────────────────────────────────────────────
psql_ -d "$SCRATCH_DB" <<'SQL'
CREATE VIEW wiped AS
SELECT c.id, c.content_type, c.name,
       coalesce(btrim(b.instructions), '') <> '' AND coalesce(btrim(c.instructions), '') = '' AS lost_instructions,
       coalesce(jsonb_array_length(b.media->'documents'), 0) > coalesce(jsonb_array_length(c.media->'documents'), 0) AS lost_documents,
       coalesce(jsonb_array_length(b.media->'images'), 0)    > coalesce(jsonb_array_length(c.media->'images'), 0)    AS lost_images,
       length(b.instructions) AS backup_instructions_chars,
       b.instructions AS backup_instructions,
       b.media AS backup_media
FROM current_content c
JOIN backup_content b USING (id)
WHERE c.deleted_at IS NULL;
SQL

psql_ -d "$SCRATCH_DB" -c "\copy (SELECT id, content_type, name, lost_instructions, lost_documents, lost_images, backup_instructions_chars FROM wiped WHERE lost_instructions OR lost_documents OR lost_images ORDER BY name) TO STDOUT WITH CSV HEADER" \
  > "$OUT/report.csv"

echo ""
psql_ -d "$SCRATCH_DB" -c "SELECT count(*) FILTER (WHERE lost_instructions) AS lost_instructions,
                                  count(*) FILTER (WHERE lost_documents)    AS lost_documents,
                                  count(*) FILTER (WHERE lost_images)       AS lost_images,
                                  count(*) FILTER (WHERE lost_instructions OR lost_documents OR lost_images) AS items
                           FROM wiped;"

# ── 4. Write the restore SQL (not applied) ───────────────────────────────────
# Media is put back whole only when prod's copy has fewer documents and at most
# one image: the bug's exact fingerprint ({images:[hero], documents:[]}).
psql_ -d "$SCRATCH_DB" -t -A <<'SQL' > "$OUT/restore.sql"
SELECT '-- Generated ' || now() || '. Review report.csv first. Each statement is guarded.';
SELECT format(
  'UPDATE content SET instructions = %L WHERE id = %L AND coalesce(btrim(instructions), '''') = '''';  -- %s',
  backup_instructions, id, replace(name, E'\n', ' '))
FROM wiped WHERE lost_instructions ORDER BY name;
SELECT format(
  'UPDATE content SET media = %L::jsonb WHERE id = %L AND coalesce(jsonb_array_length(media->''documents''), 0) < %s AND coalesce(jsonb_array_length(media->''images''), 0) <= 1;  -- %s',
  backup_media::text, id, coalesce(jsonb_array_length(backup_media->'documents'), 0), replace(name, E'\n', ' '))
FROM wiped WHERE lost_documents OR lost_images ORDER BY name;
SQL

echo ""
echo "Report:      $OUT/report.csv  ($(($(wc -l < "$OUT/report.csv") - 1)) items)"
echo "Restore SQL: $OUT/restore.sql ($(grep -c '^UPDATE' "$OUT/restore.sql") statements, NOT applied)"
echo ""
echo "Next: read the report, then apply with"
echo "  docker exec -i $DB_CONTAINER psql -U $DB_USER -d $PROD_DB -v ON_ERROR_STOP=1 -1 < $OUT/restore.sql"
}

main "$@"
exit
