#!/usr/bin/env bash

URL="http://localhost:5173/api/process"
INTERVAL=6

while true; do
  (
    ts=$(date -Is)
    curl -sS \
      -X POST "$URL" \
      -H "Content-Type: application/json" \
      --data '{"run":true}' \
      --connect-timeout 5 \
      --max-time 30 \
      --fail-with-body \
      -w "\n[$ts] time_total=%{time_total}s http=%{http_code}\n" \
    || echo "[$ts] request failed (exit $?)"
  ) &

  # wait exactly $INTERVAL before launching the next one
  sleep "$INTERVAL"
done
