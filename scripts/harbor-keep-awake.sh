#!/usr/bin/env bash
# Hit live every 15 seconds so Render Free never reaches idle spin-down.
set -u
BASE="${HARBOR_PERSIST_LIVE_URL:-https://tikitok-shop.onrender.com}"
BASE="${BASE%/}"
echo "keep-awake $BASE every 15s"
while true; do
  code=$(curl -sS -m 20 -o /dev/null -w "%{http_code}" "$BASE/welcome" || echo fail)
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) welcome $code"
  sleep 15
done
