#!/usr/bin/env bash
set -euo pipefail

base_branch="prerelease"
if [[ "${1:-}" == "--r" ]]; then
  base_branch="release"
elif [[ "${1:-}" == "--pr" || -z "${1:-}" ]]; then
  base_branch="prerelease"
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Usage:
  npm run pr:open -- --pr   # current branch -> prerelease
  npm run pr:open -- --r    # current branch -> release
EOF
  exit 0
else
  echo "pr-open: unknown option '${1}'. Use --pr or --r." >&2
  exit 1
fi

head_branch="$(git branch --show-current)"

if [[ -z "${head_branch}" ]]; then
  echo "pr-open: could not detect current branch." >&2
  exit 1
fi

if [[ "${head_branch}" == "${base_branch}" ]]; then
  echo "pr-open: head and base are both '${base_branch}'. switch to a feature branch first." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "pr-open: GitHub CLI (gh) is required." >&2
  exit 1
fi

echo "pr-open: opening PR page for ${head_branch} -> ${base_branch}"
gh pr create --base "${base_branch}" --head "${head_branch}" --web
