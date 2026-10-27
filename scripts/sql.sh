#!/usr/bin/env bash
# Run a SQL file (or stdin) against the Supabase project through the Management API.
# The bearer token is injected by the environment's network secret, never stored here.
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-sylmsididyxunxxorydz}"
SQL="$(cat "${1:-/dev/stdin}")"
python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<<"$SQL" |
  curl -sS -X POST "https://api.supabase.com/v1/projects/$REF/database/query" -H 'Content-Type: application/json' --data-binary @-
echo
