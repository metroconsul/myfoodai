#!/usr/bin/env bash
# Testes da conexão Mercado Pago (tabelas de tokens e estado OAuth) num Postgres DESCARTÁVEL (Docker local).
# Reaproveita stubs, seed e funções auxiliares do kit do Caixa & Financeiro. Não lê .env, não publica portas.
set -euo pipefail

IMAGE="${1:-postgres:17-alpine}"
NAME="myfoods-mp-test-$$"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
MIG="$REPO/supabase/migrations"
STUBS="$REPO/scripts/security-tests/multitenant/00_platform_stubs.sql"
CF="$REPO/scripts/security-tests/caixa-financeiro"
PGPASS="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "Imagem $IMAGE ausente."; exit 2; }
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PGPASS" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
psqlc() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== stubs"; psqlc < "$STUBS"
echo "== todas as migrations"
while IFS= read -r f; do
  psqlc < "$f" >/dev/null || { echo "FALHOU: $f"; exit 1; }
done < <(printf '%s\n' "$MIG"/*.sql | sort)
echo "== seed fictício + funções auxiliares (kit do Caixa & Financeiro)"
psqlc < "$CF/01_seed.sql"
psqlc < "$CF/02_tests.sql" >/dev/null
psqlc -c 'TRUNCATE t.results'
echo "== testes Mercado Pago"; psqlc < "$HERE/03_tests.sql"
