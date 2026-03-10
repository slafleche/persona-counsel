#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/gh_failed_run_logs.sh
#   ./scripts/gh_failed_run_logs.sh <run_id>
#
# Requires:
#   - gh CLI authenticated
#   - jq available (gh outputs JSON; jq parses it)

RUN_ID="${1:-}"
TAIL_LINES="${TAIL_LINES:-160}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

if [[ -z "$RUN_ID" ]]; then
  RUN_ID="$(gh run list --limit 20 --json databaseId,status,conclusion --jq '.[] | select(.status=="completed" and .conclusion=="failure") | .databaseId' | head -n 1)"
fi

if [[ -z "$RUN_ID" ]]; then
  echo "No failed run found." >&2
  exit 1
fi

echo "Inspecting run: $RUN_ID"

JOBS_JSON="$(gh run view "$RUN_ID" --json jobs)"
FAILED_JOB_IDS="$(printf '%s' "$JOBS_JSON" | jq -r '.jobs[] | select(.conclusion=="failure") | .databaseId')"

if [[ -z "$FAILED_JOB_IDS" ]]; then
  echo "Run has no failed jobs (or no jobs data returned)." >&2
  exit 1
fi

for JOB_ID in $FAILED_JOB_IDS; do
  JOB_NAME="$(printf '%s' "$JOBS_JSON" | jq -r --argjson id "$JOB_ID" '.jobs[] | select(.databaseId==$id) | .name')"
  echo
  echo "===== FAILED JOB: $JOB_NAME ($JOB_ID) ====="
  gh run view "$RUN_ID" --job "$JOB_ID" --log | tail -n "$TAIL_LINES"
done
