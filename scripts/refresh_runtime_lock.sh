#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_VENV="$(mktemp -d)/runtime-lock-venv"
trap 'rm -rf "$(dirname "$TMP_VENV")"' EXIT

python3 -m venv "$TMP_VENV"
"$TMP_VENV/bin/python" -m pip install --upgrade pip
"$TMP_VENV/bin/python" -m pip install -r requirements/runtime.in

"$TMP_VENV/bin/python" -m pip freeze --all \
  | grep -Ev '^(pip|setuptools|wheel)==' \
  | LC_ALL=C sort > requirements/runtime.lock

echo "runtime-lock-refresh: wrote requirements/runtime.lock"
