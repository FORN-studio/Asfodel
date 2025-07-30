#!/usr/bin/env bash

URL="http://localhost:5173/api/process"
INTERVAL=60

# Source environment variables
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

while true; do
  (
    ts=$(date -Is)
    curl -sS \
      -X GET "$URL" \
      -H "authorization: $CRON_SECRET" \
      --connect-timeout 5 \
      --max-time 30 \
      --fail-with-body \
      -w "\n[$ts] time_total=%{time_total}s http=%{http_code}\n" \
    || echo "[$ts] request failed (exit $?)"
  ) &

  # wait exactly $INTERVAL before launching the next one
  sleep "$INTERVAL"
done
