#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_NAME="Release Artifact Matrix"
branch="${1:-$(git rev-parse --abbrev-ref HEAD)}"

if [[ "${branch}" != "prerelease" && "${branch}" != "release" ]]; then
  echo "release-queue: branch must be prerelease or release (current: ${branch})" >&2
  exit 1
fi

local_sha="$(git rev-parse HEAD)"
remote_ref="origin/${branch}"
remote_sha="$(git rev-parse "${remote_ref}" 2>/dev/null || true)"

if [[ -z "${remote_sha}" ]]; then
  echo "release-queue: missing remote ref ${remote_ref}. Push the branch first." >&2
  exit 1
fi

if [[ "${local_sha}" != "${remote_sha}" ]]; then
  echo "release-queue: local ${branch} is not synced with ${remote_ref}." >&2
  echo "release-queue: push/pull first, then queue workflow." >&2
  exit 1
fi

echo "release-queue: dispatching '${WORKFLOW_NAME}' on ${branch}..."
workflow_output="$(gh workflow run "${WORKFLOW_NAME}" --ref "${branch}" 2>&1)"
echo "${workflow_output}"

run_url="$(printf '%s\n' "${workflow_output}" | grep -Eo 'https://github.com/[^[:space:]]+/actions/runs/[0-9]+' | head -n1 || true)"
if [[ -n "${run_url}" ]]; then
  if command -v open >/dev/null 2>&1; then
    open "${run_url}" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${run_url}" >/dev/null 2>&1 || true
  fi
fi

echo "release-queue: dispatched."
echo "release-queue: check status with: gh run list --workflow \"${WORKFLOW_NAME}\" --limit 5"
