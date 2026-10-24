#!/usr/bin/env bash
# Testes da fundação dos aplicativos (F1) num Postgres DESCARTÁVEL em Docker local.
# Não lê .env, não usa credenciais do projeto, não publica portas. Requer a imagem já baixada.
set -euo pipefail

IMAGE="${1:-postgres:17-alpine}"
NAME="myfoods-f1-test-$$"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
MIG="$REPO/supabase/migrations"
STUBS="$REPO/scripts/security-tests/multitenant/00_platform_stubs.sql"
PGPASS="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
F1_ROLES="20261024120000_app_roles_cashier_finance.sql"
F1_APPS="20261024120100_app_entitlements.sql"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "Imagem $IMAGE ausente."; exit 2; }
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PGPASS" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
psqlc() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== stubs de plataforma"; psqlc < "$STUBS"
echo "== migrations anteriores à fundação"
while IFS= read -r f; do
  case "$(basename "$f")" in "$F1_ROLES"|"$F1_APPS") continue;; esac
  psqlc < "$f" >/dev/null || { echo "FALHOU: $f"; exit 1; }
done < <(printf '%s\n' "$MIG"/*.sql | sort)
echo "== seed fictício (antes da fundação, para testar o backfill)"; psqlc < "$HERE/01_seed_before.sql"
echo "== migrations da fundação"; psqlc < "$MIG/$F1_ROLES"; psqlc < "$MIG/$F1_APPS"
echo "== reaplicando (idempotência)"; psqlc < "$MIG/$F1_ROLES" && psqlc < "$MIG/$F1_APPS" && echo "idempotente: OK"
echo "== duplicidades de entitlement:"; psqlc -At -c "select count(*) from (select company_id, feature_code from public.feature_entitlements group by 1,2 having count(*)>1) x"
echo "== testes"; psqlc < "$HERE/02_tests.sql"
