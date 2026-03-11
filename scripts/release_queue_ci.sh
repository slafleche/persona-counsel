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
gh workflow run "${WORKFLOW_NAME}" --ref "${branch}"
echo "release-queue: dispatched."
echo "release-queue: check status with: gh run list --workflow \"${WORKFLOW_NAME}\" --limit 5"
