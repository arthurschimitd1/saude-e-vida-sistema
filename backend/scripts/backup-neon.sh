#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Defina DATABASE_URL antes de executar o backup}"

if [[ "${LUCROMAIS_ENV:-}" != "homologacao" && "${ALLOW_PRODUCTION_BACKUP:-0}" != "1" ]]; then
  echo "Backup bloqueado: defina LUCROMAIS_ENV=homologacao ou ALLOW_PRODUCTION_BACKUP=1 de forma consciente." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump nao encontrado. Instale o cliente PostgreSQL antes de continuar." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT="${BACKUP_DIR}/lucromais-${LUCROMAIS_ENV:-database}-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file "$OUTPUT" \
  "$DATABASE_URL"

if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "$OUTPUT" >/dev/null
fi

echo "Backup criado e validado: $OUTPUT"
echo "Mantenha esse arquivo fora do Git e em armazenamento restrito."
