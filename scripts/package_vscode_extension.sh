#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
BACKEND_ARTIFACTS_DIR="$ROOT_DIR/build/vscode-backend-artifacts"
BACKEND_DEST_DIR="$EXT_DIR/backend"
STRICT_MATRIX="${STRICT_MATRIX:-0}"
PACKAGE_TARGETS="${PACKAGE_TARGETS:-}"
VSCE_PRE_RELEASE="${VSCE_PRE_RELEASE:-0}"

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

ALL_TARGETS=()
while IFS= read -r target; do
  [[ -n "$target" ]] && ALL_TARGETS+=("$target")
done < <(find "$BACKEND_ARTIFACTS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)

SELECTED_TARGETS=()
if [[ -n "$PACKAGE_TARGETS" ]]; then
  # shellcheck disable=SC2206
  SELECTED_TARGETS=($PACKAGE_TARGETS)
else
  SELECTED_TARGETS=("${ALL_TARGETS[@]}")
fi

if (( ${#SELECTED_TARGETS[@]} == 0 )); then
  echo "No package targets selected." >&2
  exit 1
fi

if [[ "$STRICT_MATRIX" == "1" ]]; then
  "$ROOT_DIR/scripts/check_vscode_backend_matrix.sh"
fi

cd "$EXT_DIR"
npm install
npm run build

VSIX_OUTPUTS=()
for target in "${SELECTED_TARGETS[@]}"; do
  SRC_DIR="$BACKEND_ARTIFACTS_DIR/$target"
  if [[ ! -d "$SRC_DIR" ]]; then
    echo "Requested package target missing: $target" >&2
    exit 1
  fi

  if [[ ! -f "$SRC_DIR/counsel" && ! -f "$SRC_DIR/counsel.exe" ]]; then
    echo "Target has no backend binary: $target" >&2
    exit 1
  fi

  rm -rf "$BACKEND_DEST_DIR"
  mkdir -p "$BACKEND_DEST_DIR/$target"
  cp -R "$SRC_DIR"/. "$BACKEND_DEST_DIR/$target"/
  if [[ -f "$BACKEND_ARTIFACTS_DIR/manifest.json" ]]; then
    cp "$BACKEND_ARTIFACTS_DIR/manifest.json" "$BACKEND_DEST_DIR/manifest.json"
  fi

  VSIX_NAME="persona-counsel-vscode-${target}.vsix"
  VSCE_ARGS=(package --target "$target" --no-dependencies --out "$VSIX_NAME")
  if [[ "$VSCE_PRE_RELEASE" == "1" ]]; then
    VSCE_ARGS+=(--pre-release)
  fi
  if command -v vsce >/dev/null 2>&1; then
    vsce "${VSCE_ARGS[@]}"
  else
    npx --yes @vscode/vsce "${VSCE_ARGS[@]}"
  fi
  VSIX_OUTPUTS+=("$EXT_DIR/$VSIX_NAME")
done

cat <<MSG
Extension packaged successfully.

Backend binaries included from:
  $BACKEND_ARTIFACTS_DIR

Packaged extensions:
$(for f in "${VSIX_OUTPUTS[@]}"; do echo "  $f"; done)

Strict matrix mode:
  STRICT_MATRIX=$STRICT_MATRIX
Pre-release packaging mode:
  VSCE_PRE_RELEASE=$VSCE_PRE_RELEASE
Package targets:
  ${SELECTED_TARGETS[*]}
MSG
