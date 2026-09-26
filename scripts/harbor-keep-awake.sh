#!/usr/bin/env bash
# Hit live every 15 seconds so Render Free never reaches idle spin-down.
# The instant /welcome comes back after a down/splash, run heal so Merchants
# is already filled before anyone logs in again.
set -u
BASE="${HARBOR_PERSIST_LIVE_URL:-https://tikitok-shop.onrender.com}"
BASE="${BASE%/}"
ROOT="${HARBOR_PERSIST_OUT:-/tmp/heal-src}"
STAMP="${HARBOR_AWAKE_STAMP:-/tmp/harbor-awake.stamp}"
HEAL="${ROOT}/scripts/harbor-heal-live-stores.py"
down=0

heal_now() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) heal-on-wake"
  python3 "$HEAL" || echo "heal-on-wake failed; next ping will retry"
}

echo "keep-awake $BASE every 15s"
heal_now
while true; do
  code=$(curl -sS -m 20 -o /dev/null -w "%{http_code}" "$BASE/welcome" || echo fail)
  date -u +%Y-%m-%dT%H:%M:%SZ > "$STAMP"
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) welcome $code"
  if echo "$code" | grep -qE '^(200|301|302|303|307|308)$'; then
    if [ "$down" = 1 ]; then
      heal_now
    fi
    down=0
  else
    down=1
  fi
  sleep 15
done
