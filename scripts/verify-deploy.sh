#!/usr/bin/env bash
# Check a production deploy from the outside and on the VM.
#
# Run from your own machine after a deploy:
#
#   scripts/verify-deploy.sh
#
# Needs `ssh slodi-dev` to work (see ~/.ssh/config), curl, and git.
# Exit code is the number of failed checks. WARN lines do not fail the run.
#
# What it asserts, and why (see #163):
#   - Only nginx (80/443) is reachable from the internet; Postgres, backend and
#     frontend are published on 127.0.0.1 only.
#   - The site and the API answer through nginx.
#   - The backend sees the visitor's real IP, not the Docker gateway, so the IP
#     rate limiter gives each visitor their own bucket.
#   - The VM runs exactly the commit the last deploy recorded.

set -uo pipefail

SSH_HOST="${SLODI_SSH:-slodi-dev}"
SITE="${SLODI_SITE:-https://slodi.is}"
API="${SLODI_API:-https://api.slodi.is}"
API_HOST="${API#https://}"

PASS="✓"
FAIL="✗"
WARN="!"
failures=0

pass() { echo "  $PASS $*"; }
fail() { echo "  $FAIL $*"; failures=$((failures + 1)); }
warn() { echo "  $WARN $*"; }
section() { echo ""; echo "── $* "; }

port_open() { timeout 6 bash -c "exec 3<>/dev/tcp/$1/$2" 2>/dev/null; }

# ── From the internet ────────────────────────────────────────────────────────

section "From the internet"

IP=$(getent hosts "$API_HOST" | awk '{print $1; exit}')
if [ -z "$IP" ]; then
  fail "could not resolve $API_HOST"
  exit "$failures"
fi
echo "  $API_HOST → $IP"

for p in 80 443; do
  if port_open "$IP" "$p"; then pass "port $p open (nginx)"; else fail "port $p closed — nginx unreachable"; fi
done
for p in 5432 8000 3000; do
  if port_open "$IP" "$p"; then fail "port $p is reachable from the internet"; else pass "port $p closed"; fi
done

code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$SITE/" 2>/dev/null)
[ "$code" = "200" ] && pass "$SITE → 200" || fail "$SITE → ${code:-no response}"

# A unique query string lets us find this exact request in the backend's
# access log and see which client address uvicorn recorded for it.
PROBE="verify-$(date +%s)-$RANDOM"
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$API/healthz?probe=$PROBE" 2>/dev/null)
[ "$code" = "200" ] && pass "$API/healthz → 200" || fail "$API/healthz → ${code:-no response}"

MAIN_SHA=$(git ls-remote "$(git -C "$(dirname "$0")" remote get-url origin)" refs/heads/main 2>/dev/null | cut -c1-40)

# ── On the VM ────────────────────────────────────────────────────────────────

section "On the VM ($SSH_HOST)"

# The remote half prints PASS/FAIL/WARN/INFO lines; they are counted here.
remote_out=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_HOST" bash -s -- "$PROBE" "$MAIN_SHA" <<'REMOTE'
set -uo pipefail
PROBE="$1"; MAIN_SHA="$2"
cd ~/slodi || { echo "FAIL ~/slodi missing"; exit 0; }

# Deployed commit
HEAD_SHA=$(git rev-parse HEAD)
echo "INFO checkout at $(git log -1 --format='%h %s' HEAD)"
if git symbolic-ref -q HEAD >/dev/null; then
  echo "WARN checkout is on a branch, not a detached deploy — has a deploy with #163 run yet?"
fi
for svc in backend frontend; do
  stamp=~/.slodi-deployed-$svc
  if [ -s "$stamp" ]; then
    s=$(cat "$stamp")
    echo "INFO $svc deployed ${s:0:7}"
    git cat-file -e "$s^{commit}" 2>/dev/null || echo "FAIL $svc stamp ${s:0:7} is not a known commit"
  else
    echo "WARN no $svc deploy stamp yet (written by the first deploy after #163)"
  fi
done
if [ -n "$MAIN_SHA" ] && [ "$HEAD_SHA" != "$MAIN_SHA" ]; then
  echo "WARN checkout ${HEAD_SHA:0:7} is not main's tip ${MAIN_SHA:0:7} (fine if CI for the tip is still running)"
fi
[ -z "$(git status --porcelain --untracked-files=no)" ] \
  && echo "PASS no local changes to tracked files" \
  || echo "WARN tracked files changed locally on the VM"

# Containers
for c in slodi-postgres slodi-backend slodi-frontend; do
  state=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null)
  case "$state" in
    "running healthy"|"running ") echo "PASS $c $state" ;;
    *) echo "FAIL $c ${state:-missing}" ;;
  esac
done

# Port bindings: every published port must be on loopback.
for c in slodi-postgres slodi-backend slodi-frontend; do
  bindings=$(docker port "$c" 2>/dev/null)
  if [ -z "$bindings" ]; then
    echo "WARN $c publishes no ports"
  elif echo "$bindings" | grep -vqE '127\.0\.0\.1:'; then
    echo "FAIL $c published beyond loopback: $(echo $bindings)"
  else
    echo "PASS $c bound to $(echo "$bindings" | awk '{print $3}' | sort -u | tr '\n' ' ')"
  fi
done

# Real client IPs
fwd=$(docker exec slodi-backend printenv FORWARDED_ALLOW_IPS 2>/dev/null)
[ "$fwd" = "127.0.0.1,172.16.0.0/12" ] \
  && echo "PASS FORWARDED_ALLOW_IPS=$fwd" \
  || echo "FAIL FORWARDED_ALLOW_IPS='${fwd}' (expected 127.0.0.1,172.16.0.0/12)"

line=$(docker logs --since 5m slodi-backend 2>&1 | grep -F "probe=$PROBE" | tail -1)
client=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)
if [ -z "$line" ]; then
  echo "WARN probe request not found in the backend access log"
elif echo "$client" | grep -qE '^(172\.(1[6-9]|2[0-9]|3[01])\.|127\.)'; then
  echo "FAIL backend saw the probe from $client — the proxy, not the visitor; rate limits are shared"
else
  echo "PASS backend saw the probe from $client (the visitor)"
fi

# nginx
if sudo -n true 2>/dev/null; then
  if sudo grep -qE 'proxy_pass http://localhost:' /etc/nginx/sites-enabled/slodi; then
    echo "WARN nginx proxies to localhost — change to 127.0.0.1 (::1 is no longer bound)"
  else
    echo "PASS nginx proxies to 127.0.0.1"
  fi
  n=$(sudo tail -n 2000 /var/log/nginx/error.log 2>/dev/null | grep -c 'connect() failed.*\[::1\]')
  [ "${n:-0}" -eq 0 ] && echo "PASS no recent [::1] upstream errors" \
                      || echo "WARN $n recent [::1] upstream errors in nginx error.log"
else
  echo "WARN no passwordless sudo — skipped the nginx checks"
fi

# Disk
used=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "$used" -lt 85 ] && echo "PASS disk $used% used" || echo "FAIL disk $used% used"
echo "INFO build cache $(docker system df --format '{{.Type}} {{.Size}}' | awk '/Build Cache/{print $3}')"
REMOTE
)
ssh_status=$?

if [ $ssh_status -ne 0 ] && [ -z "$remote_out" ]; then
  fail "could not run checks over ssh $SSH_HOST (exit $ssh_status)"
fi

while IFS= read -r l; do
  kind=${l%% *}; msg=${l#* }
  case "$kind" in
    PASS) pass "$msg" ;;
    FAIL) fail "$msg" ;;
    WARN) warn "$msg" ;;
    INFO) echo "    $msg" ;;
    *) [ -n "$l" ] && echo "    $l" ;;
  esac
done <<< "$remote_out"

echo ""
if [ "$failures" -eq 0 ]; then
  echo "$PASS All checks passed"
else
  echo "$FAIL $failures check(s) failed"
fi
exit "$failures"
