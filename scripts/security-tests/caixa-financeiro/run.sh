#!/usr/bin/env bash
# Testes do MyFoods Caixa & Financeiro num Postgres DESCARTÁVEL (Docker local).
# Não lê .env, não usa credenciais do projeto, não publica portas.
set -euo pipefail

IMAGE="${1:-postgres:17-alpine}"
NAME="myfoods-cf-test-$$"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
MIG="$REPO/supabase/migrations"
STUBS="$REPO/scripts/security-tests/multitenant/00_platform_stubs.sql"
CF="20261024172028_caixa_financeiro_core.sql"
PGPASS="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "Imagem $IMAGE ausente."; exit 2; }
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PGPASS" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
psqlc() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== stubs"; psqlc < "$STUBS"
echo "== todas as migrations (inclui $CF)"
while IFS= read -r f; do
  psqlc < "$f" >/dev/null || { echo "FALHOU: $f"; exit 1; }
done < <(printf '%s\n' "$MIG"/*.sql | sort)
echo "== reaplicando $CF (idempotência esperada: falha controlada, pois cria tabelas)"
psqlc < "$MIG/$CF" >/dev/null 2>&1 && echo "reaplicou" || echo "não reaplica (CREATE TABLE): esperado para migration de criação"
echo "== seed fictício"; psqlc < "$HERE/01_seed.sql"
echo "== testes"; psqlc < "$HERE/02_tests.sql"
