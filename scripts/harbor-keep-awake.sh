#!/usr/bin/env bash
# Hit live every 15 seconds so Render Free never reaches idle spin-down.
# Heal after splash AND whenever a remembered shop page is gone, even if this
# loop was frozen and missed the down period.
set -u
BASE="${HARBOR_PERSIST_LIVE_URL:-https://tikitok-shop.onrender.com}"
BASE="${BASE%/}"
ROOT="${HARBOR_PERSIST_OUT:-/tmp/heal-src}"
STAMP="${HARBOR_AWAKE_STAMP:-/tmp/harbor-awake.stamp}"
HEAL="${ROOT}/scripts/harbor-heal-live-stores.py"
PROBE_SLUGS="${HARBOR_PROBE_SLUGS:-ali-collections stay-check-store butt-store ak-shopping-store royal-lucky-store luqman-humi-store ola-here}"
down=0

touch_stamp() {
  date -u +%Y-%m-%dT%H:%M:%SZ > "$STAMP"
}

heal_now() {
  touch_stamp
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) heal-on-wake"
  python3 "$HEAL" || echo "heal-on-wake failed; next ping will retry"
  touch_stamp
}

shops_missing() {
  for slug in $PROBE_SLUGS; do
    code=$(curl -sS -m 15 -o /dev/null -w "%{http_code}" "$BASE/s/$slug" || echo fail)
    if ! echo "$code" | grep -qE '^(200|301|302|303|307|308)$'; then
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) missing $slug $code"
      return 0
    fi
  done
  return 1
}

echo "keep-awake $BASE every 15s"
touch_stamp
heal_now
while true; do
  code=$(curl -sS -m 20 -o /dev/null -w "%{http_code}" "$BASE/welcome" || echo fail)
  touch_stamp
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) welcome $code"
  if echo "$code" | grep -qE '^(200|301|302|303|307|308)$'; then
    if [ "$down" = 1 ] || shops_missing; then
      heal_now
    fi
    down=0
  else
    down=1
  fi
  sleep 15
done
