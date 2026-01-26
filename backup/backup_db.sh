#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG ======
PROJECT_DIR="/home/ubuntu/apps/AquaManager"
BACKUP_DIR="${PROJECT_DIR}/backup/db"
CONTAINER_DB="aquamanager_db"

DB_NAME="${DB_NAME:-aquamanager}"
DB_ROOT_PASS="${DB_ROOT_PASS:-rootpass}"   # adapte si tu as changé MYSQL_ROOT_PASSWORD
KEEP_LAST=2
# ====================

mkdir -p "$BACKUP_DIR"

TS="$(date +'%Y-%m-%d_%H-%M-%S')"
FILE="${BACKUP_DIR}/${DB_NAME}_${TS}.sql.gz"

echo "[INFO] Dump MySQL -> ${FILE}"

# Dump + gzip
docker exec "$CONTAINER_DB" sh -lc \
  "mysqldump -uroot -p\"$DB_ROOT_PASS\" --single-transaction --routines --triggers \"$DB_NAME\" 2>/dev/null" \
  | gzip > "$FILE"

echo "[INFO] OK: $(du -h "$FILE" | awk '{print $1}')"

# Garder uniquement les 2 derniers
echo "[INFO] Rotation: garder ${KEEP_LAST} fichiers"
ls -1t "${BACKUP_DIR}/${DB_NAME}_"*.sql.gz 2>/dev/null | tail -n +$((KEEP_LAST + 1)) | xargs -r rm -f

echo "[INFO] Terminé."
