#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
BACKEND_ARTIFACTS_DIR="$ROOT_DIR/build/vscode-backend-artifacts"
BACKEND_DEST_DIR="$EXT_DIR/backend"
STRICT_MATRIX="${STRICT_MATRIX:-0}"

if [[ ! -d "$BACKEND_ARTIFACTS_DIR" ]]; then
  cat <<MSG
Missing backend artifacts directory:
  $BACKEND_ARTIFACTS_DIR

Build at least one backend first:
  ./scripts/build_vscode_backend.sh
MSG
  exit 1
fi

if ! find "$BACKEND_ARTIFACTS_DIR" -mindepth 2 -maxdepth 2 -type f \( -name "counsel" -o -name "counsel.exe" \) | grep -q .; then
  cat <<MSG
No backend binaries found in:
  $BACKEND_ARTIFACTS_DIR

Expected layout:
  build/vscode-backend-artifacts/<platform>-<arch>/counsel
  build/vscode-backend-artifacts/<platform>-<arch>/counsel.exe
MSG
  exit 1
fi

python3 "$ROOT_DIR/scripts/generate_vscode_backend_manifest.py"

rm -rf "$BACKEND_DEST_DIR"
mkdir -p "$BACKEND_DEST_DIR"
cp -R "$BACKEND_ARTIFACTS_DIR"/. "$BACKEND_DEST_DIR"/

if ! find "$BACKEND_DEST_DIR" -mindepth 2 -maxdepth 2 -type f \( -name "counsel" -o -name "counsel.exe" \) | grep -q .; then
  echo "Backend copy preflight failed: no binaries present under $BACKEND_DEST_DIR"
  exit 1
fi

if [[ "$STRICT_MATRIX" == "1" ]]; then
  "$ROOT_DIR/scripts/check_vscode_backend_matrix.sh"
fi

cd "$EXT_DIR"
npm install
npm run build

if command -v vsce >/dev/null 2>&1; then
  vsce package --no-dependencies
else
  npx --yes @vscode/vsce package --no-dependencies
fi

cat <<MSG
Extension packaged successfully.

Backend binaries included from:
  $BACKEND_ARTIFACTS_DIR

Packaged extension:
  $EXT_DIR/*.vsix

Strict matrix mode:
  STRICT_MATRIX=$STRICT_MATRIX
MSG
