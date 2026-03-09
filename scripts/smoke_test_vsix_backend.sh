#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <vsix-path> <target>" >&2
  echo "Example: $0 extension/persona-counsel-vscode-darwin-arm64.vsix darwin-arm64" >&2
  exit 2
fi

VSIX_PATH="$1"
TARGET="$2"

if [[ ! -f "$VSIX_PATH" ]]; then
  echo "VSIX not found: $VSIX_PATH" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

unzip -q "$VSIX_PATH" -d "$TMP_DIR/unpacked"

if [[ "$TARGET" == win32-* ]]; then
  BIN_PATH="$TMP_DIR/unpacked/extension/backend/$TARGET/counsel.exe"
else
  BIN_PATH="$TMP_DIR/unpacked/extension/backend/$TARGET/counsel"
fi

if [[ ! -f "$BIN_PATH" ]]; then
  echo "Bundled backend not found in VSIX: $BIN_PATH" >&2
  exit 1
fi

if [[ ! -x "$BIN_PATH" ]]; then
  chmod +x "$BIN_PATH"
fi

if command -v counsel >/dev/null 2>&1; then
  echo "Expected no preinstalled counsel in clean smoke environment, but found one on PATH." >&2
  exit 1
fi

"$BIN_PATH" --help >/dev/null

# Some builds expose version as a command/option, others don't yet.
# Keep compatibility while still probing when available.
if "$BIN_PATH" --version >/dev/null 2>&1; then
  :
elif "$BIN_PATH" version >/dev/null 2>&1; then
  :
else
  echo "version probe skipped: no supported version flag/command" >&2
fi

run_workspace_smoke() {
  local work_dir="$1"
  mkdir -p "$work_dir"
  cd "$work_dir"

  "$BIN_PATH" setup >/dev/null
  local doctor_json
  doctor_json="$("$BIN_PATH" doctor --json)"

  echo "$doctor_json" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'

  for d in personas counsels sessions; do
    if [[ ! -d "$work_dir/$d" ]]; then
      echo "Expected setup-created directory missing: $d (work_dir: $work_dir)" >&2
      exit 1
    fi
  done
}

run_workspace_smoke "$TMP_DIR/workspace space"
run_workspace_smoke "$TMP_DIR/workspace-unicode-e-accented-é"

echo "vsix-backend-smoke: ok ($TARGET)"
