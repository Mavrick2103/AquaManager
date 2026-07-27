#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG ======
PROJECT_DIR="/home/ubuntu/apps/AquaManager"
BACKUP_DIR="${PROJECT_DIR}/backup/db"
CONTAINER_DB="aquamanager_db"

DB_NAME="${DB_NAME:-aquamanager}"
DB_ROOT_PASS="${DB_ROOT_PASS:-rootpass}"

KEEP_LAST=8

RESTIC_ENV="/etc/aquamanager/restic.env"
# ====================

mkdir -p "$BACKUP_DIR"

TS="$(date +'%Y-%m-%d_%H-%M-%S')"
FILE="${BACKUP_DIR}/${DB_NAME}_${TS}.sql.gz"

echo "[INFO] Dump MySQL -> ${FILE}"

docker exec "$CONTAINER_DB" sh -lc \
  "mysqldump -uroot -p\"$DB_ROOT_PASS\" \
  --single-transaction \
  --routines \
  --triggers \
  \"$DB_NAME\" 2>/dev/null" \
  | gzip > "$FILE"

gzip -t "$FILE"

echo "[INFO] OK local: $(du -h "$FILE" | awk '{print $1}')"

echo "[INFO] Envoi Restic vers le stockage externe"

set -a
source "$RESTIC_ENV"
set +a

restic backup "$FILE"

echo "[INFO] Vérification du dépôt Restic"
restic check

echo "[INFO] Rotation locale: garder ${KEEP_LAST} fichiers"
ls -1t "${BACKUP_DIR}/${DB_NAME}_"*.sql.gz 2>/dev/null \
  | tail -n +$((KEEP_LAST + 1)) \
  | xargs -r rm -f

echo "[INFO] Terminé."