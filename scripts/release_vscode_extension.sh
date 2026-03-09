#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_LOCAL=0

usage() {
  cat <<'TXT'
Usage:
  ./scripts/release_vscode_extension.sh [--build-local]

Options:
  --build-local  Build current host backend target before strict matrix checks.

Flow:
  1) (optional) build local backend artifact
  2) require backend target matrix
  3) package extension with STRICT_MATRIX=1

Notes:
  - Targets are enforced by scripts/check_vscode_backend_matrix.sh
  - Override target set with REQUIRED_TARGETS (space-separated)
  - Optionally limit packaged outputs with PACKAGE_TARGETS (space-separated)
  - For cross-platform release, collect artifacts from CI/build machines into:
      build/vscode-backend-artifacts/<platform>-<arch>/counsel(.exe)
TXT
}

while (( $# > 0 )); do
  case "$1" in
    --build-local)
      BUILD_LOCAL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

cd "$ROOT_DIR"

if [[ "$BUILD_LOCAL" == "1" ]]; then
  ./scripts/build_vscode_backend.sh
fi

./scripts/check_vscode_backend_matrix.sh

if [[ -z "${PACKAGE_TARGETS:-}" ]]; then
  PACKAGE_TARGETS="darwin-arm64 linux-x64 win32-x64"
fi

STRICT_MATRIX=1 PACKAGE_TARGETS="$PACKAGE_TARGETS" ./scripts/package_vscode_extension.sh

echo "release-vscode-extension: ok"
