#!/usr/bin/env bash
# Copy the remembered shop list onto the harbor-persist Git branch so a
# Render splash can be healed from GitHub, not from the wiped Free disk.
set -u
SRC="${HARBOR_PERSIST_OUT:-/tmp/heal-src}"
WT="${HARBOR_PERSIST_WT:-/tmp/harbor-persist-wt}"
mkdir -p "$SRC/persist"
if [ ! -d "$WT/.git" ]; then
  rm -rf "$WT"
  git clone --branch harbor-persist --single-branch \
    "https://github.com/ahsansaif0300-creator/TikTok-Shop.git" "$WT" || true
fi
if [ ! -d "$WT/.git" ]; then
  echo "persist worktree missing"
  exit 0
fi
git -C "$WT" fetch origin harbor-persist || true
git -C "$WT" checkout harbor-persist || true
git -C "$WT" pull --ff-only origin harbor-persist || true
mkdir -p "$WT/persist"
cp -f "$SRC/persist/shops.json" "$WT/persist/shops.json" 2>/dev/null || true
cp -f "$SRC/persist/seen-stores.json" "$WT/persist/seen-stores.json" 2>/dev/null || true
git -C "$WT" add persist/shops.json persist/seen-stores.json 2>/dev/null || true
if git -C "$WT" diff --cached --quiet; then
  echo "persist snapshot unchanged"
  exit 0
fi
git -C "$WT" -c user.name="harbor-persist" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit -m "Save live merchant stores so splash cannot wipe them."
git -C "$WT" push origin harbor-persist || echo "persist push skipped"
