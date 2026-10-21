#!/usr/bin/env bash
# Executa os testes multitenant num Postgres DESCARTÁVEL em Docker local.
# NUNCA aponta para o Supabase Cloud: não lê .env, não usa credenciais do projeto e não abre portas
# (o contêiner só é acessado via `docker exec`).
# Requer a imagem postgres (ex.: postgres:17-alpine) já baixada. Uso: ./run.sh [IMAGEM]
set -euo pipefail

IMAGE="${1:-postgres:17-alpine}"
NAME="myfoods-mt-test-$$"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
MIG="$REPO/supabase/migrations"
TMP="$(mktemp -d)"
PGPASS="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"   # senha local, descartável

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "Imagem $IMAGE ausente (baixar exige autorização)."; exit 2; }
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PGPASS" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2

psqlc() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== plataforma (stubs)";   psqlc < "$HERE/00_platform_stubs.sql"

echo "== migrations aprovadas (ordem de versão, sem o rascunho)"
while IFS= read -r f; do
  case "$(basename "$f")" in 20261021125126_*|20261021125216_*) continue;; esac
  echo "   $(basename "$f")"; psqlc < "$f" || { echo "FALHOU: $f"; exit 1; }
done < <(printf '%s\n' "$MIG"/*.sql | sort)

echo "== seed fictício";        psqlc < "$HERE/01_seed.sql"

echo "== testes ANTES da correção (esperado: falhas que reproduzem as vulnerabilidades)"
psqlc -v phase=before < "$HERE/02_tests.sql" | tee "$TMP/before.txt"

echo "== aplicando rascunho (cópia temporária SEM o bloco-guarda; o arquivo do repositório não é alterado)"
sed '/^DO \$guard\$ BEGIN/,/^END \$guard\$;/d' "$MIG/20261021125126_tenant_scoped_roles_and_user_units.sql" > "$TMP/draft.sql"
psqlc < "$TMP/draft.sql"

echo "== testes DEPOIS da migration de políticas (fase after)"
psqlc -v phase=after < "$HERE/02_tests.sql" | tee "$TMP/after.txt"

echo "== aplicando a migration de grants"
psqlc < "$MIG/20261021125216_least_privilege_grants.sql"
echo "== testes FINAIS (políticas + grants)"
psqlc -v phase=final < "$HERE/02_tests.sql" | tee "$TMP/final.txt"

echo "== reaplicando as duas migrations (idempotência)"
psqlc < "$TMP/draft.sql" && psqlc < "$MIG/20261021125216_least_privilege_grants.sql" && echo "idempotente: OK"

if [ -n "${PROPOSAL_SQL:-}" ]; then
  echo "== PROPOSTA separada (${PROPOSAL_SQL##*/}) aplicada sobre o rascunho, só neste contêiner"
  psqlc < "$PROPOSAL_SQL"
  psqlc -v phase=proposal < "$HERE/02_tests.sql" | tee "$TMP/proposal.txt"
fi

echo "== rollback e reteste"
psqlc < "$HERE/rollback_20261021125216.sql" && psqlc < "$HERE/rollback_20261021125126.sql" && echo "rollback aplicado"
psqlc -v phase=rollback < "$HERE/02_tests.sql" | tee "$TMP/rollback.txt"
