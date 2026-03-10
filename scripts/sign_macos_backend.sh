#!/usr/bin/env bash
set -euo pipefail

if [[ "${RUNNER_OS:-}" != "macOS" ]]; then
  echo "sign-macos-backend: skipped (non-macOS runner)"
  exit 0
fi

if [[ -z "${APPLE_CODESIGN_IDENTITY:-}" ]]; then
  echo "sign-macos-backend: skipped (APPLE_CODESIGN_IDENTITY not set)"
  exit 0
fi

signed_count=0

while IFS= read -r binary_path; do
  echo "Signing: ${binary_path}"
  codesign --force --sign "${APPLE_CODESIGN_IDENTITY}" --timestamp --options runtime "${binary_path}"
  codesign --verify --verbose=2 --strict "${binary_path}"
  signed_count=$((signed_count + 1))
done < <(find build/vscode-backend-artifacts -type f -name counsel)

if [[ ${signed_count} -eq 0 ]]; then
  echo "sign-macos-backend: no counsel binaries found under build/vscode-backend-artifacts"
  exit 1
fi

echo "sign-macos-backend: signed ${signed_count} binary(ies)"
