#!/usr/bin/env bash
# Keep live Merchants from going empty after Render Free recycle.
# Remembers every non-demo store it sees, then puts missing ones back.
set -u
ROOT="${HARBOR_PERSIST_OUT:-/tmp/heal-src}"
BASE="${HARBOR_PERSIST_LIVE_URL:-https://tikitok-shop.onrender.com}"
BASE="${BASE%/}"
cd "$ROOT"
export HARBOR_PERSIST_OUT="$ROOT"
while true; do
  echo "==== $(date -u +%Y-%m-%dT%H:%M:%SZ) heal ===="
  python3 "$ROOT/scripts/harbor-heal-live-stores.py" || echo "heal failed; retrying"
  python3 - <<'PY' || true
import json
from pathlib import Path
import os
root = Path(os.environ.get("HARBOR_PERSIST_OUT") or ".")
base = (os.environ.get("HARBOR_PERSIST_LIVE_URL") or "https://tikitok-shop.onrender.com").rstrip("/")
slugs = {
    "ali-collections",
    "ak-shopping-store",
    "butt-store",
    "royal-lucky-store",
    "luqman-humi-store",
    "ola-here",
    "stay-check-store",
}
for rel in ("persist/seen-stores.json", "persist/shops.json"):
    path = root / rel
    if not path.exists():
        continue
    try:
        for store in json.loads(path.read_text()).get("stores") or []:
            if store.get("slug"):
                slugs.add(store["slug"])
    except Exception:
        pass
import subprocess
for slug in sorted(slugs):
    try:
        code = subprocess.check_output(
            ["curl", "-sS", "-m", "20", "-o", "/dev/null", "-w", "%{http_code}", f"{base}/s/{slug}"],
            text=True,
        ).strip()
    except subprocess.CalledProcessError as error:
        code = str(error)
    print(slug, code)
PY
  for _ in 1 2 3; do
    curl -sS -m 20 -o /dev/null -w "wake %{http_code}\n" "$BASE/welcome" || true
    sleep 15
  done
done
