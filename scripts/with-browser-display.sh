#!/bin/sh
set -eu
export DISPLAY=:99
Xvfb "$DISPLAY" -screen 0 1440x1000x24 -nolisten tcp > /tmp/aigak-display.log 2>&1 &
display_pid=$!
trap 'kill "$display_pid" 2>/dev/null || true' EXIT INT TERM
if [ "$#" -gt 0 ]; then
  "$@" &
else
  node --import tsx server/worker.ts &
fi
worker_pid=$!
trap 'kill "$worker_pid" "$display_pid" 2>/dev/null || true' INT TERM
wait "$worker_pid"
