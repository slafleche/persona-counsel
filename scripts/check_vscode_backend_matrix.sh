#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ARTIFACTS_DIR="$ROOT_DIR/build/vscode-backend-artifacts"

DEFAULT_TARGETS=(
  "darwin-arm64"
  "linux-x64"
  "win32-x64"
)

targets=()
if [[ $# -gt 0 ]]; then
  targets=("$@")
elif [[ -n "${REQUIRED_TARGETS:-}" ]]; then
  # shellcheck disable=SC2206
  targets=(${REQUIRED_TARGETS})
else
  targets=("${DEFAULT_TARGETS[@]}")
fi

if [[ ! -d "$BACKEND_ARTIFACTS_DIR" ]]; then
  echo "Missing backend artifacts directory: $BACKEND_ARTIFACTS_DIR"
  exit 1
fi

missing=()
for target in "${targets[@]}"; do
  if [[ "$target" == win32-* ]]; then
    expected="$BACKEND_ARTIFACTS_DIR/$target/counsel.exe"
  else
    expected="$BACKEND_ARTIFACTS_DIR/$target/counsel"
  fi

  if [[ ! -f "$expected" ]]; then
    missing+=("$target")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing backend targets:"
  for m in "${missing[@]}"; do
    echo "  - $m"
  done
  echo
  echo "Expected layout:"
  echo "  build/vscode-backend-artifacts/<platform>-<arch>/counsel(.exe)"
  exit 1
fi

echo "backend-matrix-check: ok"
printf "targets: %s\n" "${targets[*]}"
