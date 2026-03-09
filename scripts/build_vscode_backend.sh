#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$(uname -s)" in
  Darwin) PLATFORM="darwin" ;;
  Linux) PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="win32" ;;
  *)
    PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    ARCH="$(uname -m | tr '[:upper:]' '[:lower:]')"
    ;;
esac

if [[ "$PLATFORM" == "win32" ]]; then
  BIN_NAME="counsel.exe"
else
  BIN_NAME="counsel"
fi

OUT_DIR="$ROOT_DIR/build/vscode-backend-artifacts/${PLATFORM}-${ARCH}"

cd "$ROOT_DIR"

python3.11 -m pip install -e ".[build]"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

python3.11 -m PyInstaller \
  --noconfirm \
  --clean \
  --onefile \
  --name "counsel" \
  --distpath "$OUT_DIR" \
  scripts/pyinstaller_entry.py

cat <<MSG
Built standalone backend:
  $OUT_DIR/$BIN_NAME

Next step for VS Code extension packaging:
  ./scripts/package_vscode_extension.sh
MSG
