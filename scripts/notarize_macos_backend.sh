#!/usr/bin/env bash
set -euo pipefail

if [[ "${RUNNER_OS:-}" != "macOS" ]]; then
  echo "notarize-macos-backend: skipped (non-macOS runner)"
  exit 0
fi

required_vars=(
  APPLE_NOTARY_KEYCHAIN_PROFILE
)

for v in "${required_vars[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "notarize-macos-backend: skipped (${v} not set)"
    exit 0
  fi
done

workdir="$(mktemp -d)"
trap 'rm -rf "${workdir}"' EXIT

notarized_count=0

while IFS= read -r binary_path; do
  target_dir="$(dirname "${binary_path}")"
  zip_path="${workdir}/$(basename "${target_dir}")-counsel.zip"

  echo "Preparing archive for notarization: ${binary_path}"
  ditto -c -k --sequesterRsrc --keepParent "${binary_path}" "${zip_path}"

  echo "Submitting to Apple Notary service: ${zip_path}"
  xcrun notarytool submit "${zip_path}" --keychain-profile "${APPLE_NOTARY_KEYCHAIN_PROFILE}" --wait

  echo "Stapling ticket: ${binary_path}"
  xcrun stapler staple "${binary_path}" || true

  echo "Verifying notarization and signature: ${binary_path}"
  spctl --assess --type execute --verbose=4 "${binary_path}"
  codesign --verify --verbose=2 --strict "${binary_path}"

  notarized_count=$((notarized_count + 1))
done < <(find build/vscode-backend-artifacts -type f -name counsel)

if [[ ${notarized_count} -eq 0 ]]; then
  echo "notarize-macos-backend: no counsel binaries found under build/vscode-backend-artifacts"
  exit 1
fi

echo "notarize-macos-backend: notarized ${notarized_count} binary(ies)"
