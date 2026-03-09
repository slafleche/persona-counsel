#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Checking counsel command availability"
if ! command -v counsel >/dev/null 2>&1; then
  echo "ERROR: counsel command not found on PATH"
  echo "Hint: python3.11 -m pip install -e ."
  exit 1
fi

echo "[2/4] Running counsel doctor --json"
DOCTOR_JSON="$(counsel doctor --json)"
echo "$DOCTOR_JSON" | python3.11 -c 'import json,sys; data=json.load(sys.stdin); assert data.get("status") in {"ok","error"}; print("doctor-json-ok")'

echo "[3/4] Running counsel setup"
SETUP_OUT="$(counsel setup)"
if [[ -n "$SETUP_OUT" ]]; then
  echo "$SETUP_OUT"
fi

echo "[4/4] Verifying required directories"
for d in personas counsels sessions; do
  if [[ ! -d "$d" ]]; then
    echo "ERROR: missing directory $d"
    exit 1
  fi
done

echo "local-cli-validation: ok"
