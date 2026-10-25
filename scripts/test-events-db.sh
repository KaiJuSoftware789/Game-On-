#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ranking_container="game-on-events-test-${RANDOM}-$$"
ranking_docker=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
# Disposable, isolated database. No host ports, credentials, or production data.
"${ranking_docker[@]}" run --rm -d --name "$ranking_container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=rankings_test postgres:17-alpine >/dev/null
trap '"${ranking_docker[@]}" rm -f "$ranking_container" >/dev/null' EXIT
for attempt in {1..30}; do
  if "${ranking_docker[@]}" exec "$ranking_container" pg_isready -h 127.0.0.1 -U postgres -d rankings_test >/dev/null 2>&1; then break; fi
  sleep 1
done
ranking_psql=("${ranking_docker[@]}" exec -i "$ranking_container" psql -X -U postgres -d rankings_test -v ON_ERROR_STOP=1)
"${ranking_psql[@]}" -q < tests/rankings-db-bootstrap.sql
"${ranking_psql[@]}" -q < supabase/migrations/202610250002_local_events.sql
"${ranking_psql[@]}" -q < tests/events-db.sql
