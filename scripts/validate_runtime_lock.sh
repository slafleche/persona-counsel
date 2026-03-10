#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_VENV="$(mktemp -d)/runtime-lock-validate-venv"
trap 'rm -rf "$(dirname "$TMP_VENV")"' EXIT

python3 -m venv "$TMP_VENV"
"$TMP_VENV/bin/python" -m pip install --upgrade pip
"$TMP_VENV/bin/python" -m pip install -r requirements/runtime.in -c requirements/runtime.lock
"$TMP_VENV/bin/python" -m pip check

echo "runtime-lock-validate: ok"
