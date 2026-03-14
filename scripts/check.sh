#!/usr/bin/env bash
# Run all lint, format, type-check, and build steps for both frontend and backend.
# Exit code is non-zero if any step fails.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIVIDER="════════════════════════════════════════════════════════════"
PASS="✓"
FAIL="✗"

failures=()

run_step() {
  local label="$1"
  shift
  local dir="$1"
  shift

  echo ""
  echo "$DIVIDER"
  echo "  $label"
  echo "$DIVIDER"

  if (cd "$dir" && "$@") 2>&1; then
    echo ""
    echo "  $PASS $label"
  else
    echo ""
    echo "  $FAIL $label"
    failures+=("$label")
  fi
}

# ── Backend ───────────────────────────────────────────────────────
run_step "Backend · format"    "$ROOT/backend" make fmt
run_step "Backend · lint"      "$ROOT/backend" make lint
run_step "Backend · typecheck" "$ROOT/backend" make typecheck
run_step "Backend · test"      "$ROOT/backend" make test

# ── Frontend ──────────────────────────────────────────────────────
run_step "Frontend · lint"     "$ROOT/frontend" npm run lint
run_step "Frontend · test"     "$ROOT/frontend" npm run test
run_step "Frontend · build"    "$ROOT/frontend" npm run build

# ── Summary ───────────────────────────────────────────────────────
echo ""
echo "$DIVIDER"
if [ ${#failures[@]} -eq 0 ]; then
  echo "  $PASS All checks passed"
  echo "$DIVIDER"
  exit 0
else
  echo "  $FAIL ${#failures[@]} check(s) failed:"
  for f in "${failures[@]}"; do
    echo "    - $f"
  done
  echo "$DIVIDER"
  exit 1
fi
