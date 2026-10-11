#!/usr/bin/env bash
# Run the journey tests and the route crawler against a throwaway stack. CI
# runs exactly this script (.github/workflows/journeys.yml), so a local run is
# the CI run.
#
#   scripts/e2e.sh                     # all journeys, crawl in all four forms
#   scripts/e2e.sh --grep @pr --project chromium --project crawl-desktop-light
#                                      # the PR gate
#   scripts/e2e.sh --project crawl-phone-dark --grep /programs
#                                      # one form, some pages
#   E2E_KEEP_STACK=1 scripts/e2e.sh    # leave the backend up afterwards
#
# Ports default to 18000 (backend) and 13000 (frontend) so they do not clash
# with a dev stack on 8000/3000. Postgres is not exposed at all.
#
# Steps: generate signing keys -> backend stack up (migrate + e2e seed) ->
# next build -> playwright (starts next) -> coverage and crawl reports -> tear down.
# Extra arguments are passed to `playwright test`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-slodi-e2e}"
export E2E_BACKEND_PORT="${E2E_BACKEND_PORT:-18000}"
export E2E_FRONTEND_PORT="${E2E_FRONTEND_PORT:-13000}"
export E2E_AUTH_DIR="$FRONTEND/e2e/.auth"

# Frontend config. AUTH0_DOMAIN is never contacted: sessions are minted by the
# tests, and the SDK only talks to Auth0 on login, callback and refresh.
export NEXT_PUBLIC_API_URL="http://localhost:$E2E_BACKEND_PORT"
# Server-side route handlers (app/api/leikir, app/api/emails) reach the backend
# through this one; in production it comes from frontend/.env.docker.
export API_BASE_URL="$NEXT_PUBLIC_API_URL"
export APP_BASE_URL="http://localhost:$E2E_FRONTEND_PORT"
export AUTH0_DOMAIN="e2e.slodi.invalid"
export AUTH0_AUDIENCE="https://api.e2e.slodi.invalid"
export AUTH0_CLIENT_ID="e2e-client"
export AUTH0_CLIENT_SECRET="e2e-client-secret"
export DEFAULT_WORKSPACE_ID="00000000-0000-4000-8000-0000000000b0"
# Fresh per run; the tests encrypt session cookies with it.
AUTH0_SECRET="$(openssl rand -hex 32)"
export AUTH0_SECRET

compose() { docker compose -f "$ROOT/docker-compose.e2e.yml" "$@"; }

# shellcheck disable=SC2329 # invoked by the EXIT trap
cleanup() {
  local status=$?
  if [[ $status -ne 0 ]]; then
    echo "::group::backend logs"
    compose logs --no-color seed backend || true
    echo "::endgroup::"
  fi
  if [[ "${E2E_KEEP_STACK:-}" != "1" ]]; then
    compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

cd "$FRONTEND"

echo "==> Signing keys"
node e2e/support/generate-keys.mjs

echo "==> Backend stack ($COMPOSE_PROJECT_NAME, backend on :$E2E_BACKEND_PORT)"
compose up --build --detach --wait backend

echo "==> next build"
npm run build

echo "==> Journeys and route crawl"
set +e
npx playwright test "$@"
status=$?
set -e

echo "==> Coverage"
node e2e/support/coverage-report.mjs e2e-results/results.json | tee e2e-results/coverage.md
node e2e/support/crawl-report.mjs e2e-results/results.json >e2e-results/crawl.md
cat e2e-results/crawl.md
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat e2e-results/coverage.md e2e-results/crawl.md >>"$GITHUB_STEP_SUMMARY"
fi

exit $status
