#!/usr/bin/env bash
# Restart keep-awake if the 15-second ping stalls (VM freeze / killed pane).
set -u
STAMP="${HARBOR_AWAKE_STAMP:-/tmp/harbor-awake.stamp}"
SESSION="${HARBOR_AWAKE_SESSION:-store-keep-awake}"
ROOT="${HARBOR_PERSIST_OUT:-/tmp/heal-src}"
TMUX_BIN="${TMUX_BIN:-tmux}"
CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"
if [ -f "$CONF" ]; then
  TMUX_BIN="$TMUX_BIN -f $CONF"
fi
while true; do
  now=$(date -u +%s)
  last=$now
  if [ -f "$STAMP" ]; then
    last=$(date -u -d "$(cat "$STAMP")" +%s 2>/dev/null || echo "$now")
  fi
  age=$((now - last))
  if [ "$age" -gt 45 ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) awake stalled ${age}s; restarting"
    $TMUX_BIN has-session -t "=$SESSION" 2>/dev/null && $TMUX_BIN kill-session -t "$SESSION"
    $TMUX_BIN new-session -d -s "$SESSION" -c "$ROOT" -- bash "$ROOT/scripts/harbor-keep-awake.sh"
  fi
  sleep 20
done
