#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/build/vscode-backend"
BIN_NAME="counsel"

cd "$ROOT_DIR"

python3.11 -m pip install -e ".[build]"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

python3.11 -m PyInstaller \
  --noconfirm \
  --clean \
  --onefile \
  --name "$BIN_NAME" \
  --distpath "$OUT_DIR" \
  scripts/pyinstaller_entry.py

cat <<MSG
Built standalone backend:
  $OUT_DIR/$BIN_NAME

Next step for VS Code extension packaging:
  Copy this binary into your extension's platform-specific backend folder.
MSG
