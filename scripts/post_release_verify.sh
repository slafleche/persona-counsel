#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EXTENSION_ID="${EXTENSION_ID:-PersonaCouncel.persona-counsel-vscode}"
PYTHON_REPOSITORY="${PYTHON_REPOSITORY:-testpypi}"
VERIFY_PYTHON="${VERIFY_PYTHON:-1}"
VSCE_VERIFY_ATTEMPTS="${VSCE_VERIFY_ATTEMPTS:-20}"
VSCE_VERIFY_DELAY_SECONDS="${VSCE_VERIFY_DELAY_SECONDS:-15}"

fail() {
  echo "post-release-verify: FAIL: $1" >&2
  exit "${2:-1}"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1" 2
}

require_cmd node
require_cmd python3
require_cmd npx

LOCAL_EXTENSION_VERSION="$(node -p "require('./extension/package.json').version")"
LOCAL_PYTHON_VERSION="$(
  python3 - <<'PY'
import tomllib
from pathlib import Path

raw = Path("pyproject.toml").read_text(encoding="utf-8")
print(tomllib.loads(raw)["project"]["version"])
PY
)"

echo "post-release-verify: local extension version: ${LOCAL_EXTENSION_VERSION}"
echo "post-release-verify: local python version: ${LOCAL_PYTHON_VERSION}"
echo "post-release-verify: checking extension id: ${EXTENSION_ID}"
echo "post-release-verify: marketplace check retry policy: attempts=${VSCE_VERIFY_ATTEMPTS}, delay=${VSCE_VERIFY_DELAY_SECONDS}s"

REMOTE_EXTENSION_VERSION=""
for attempt in $(seq 1 "$VSCE_VERIFY_ATTEMPTS"); do
  VSCE_OUT="$(npx --yes @vscode/vsce show "${EXTENSION_ID}" 2>&1)" || fail "VS Code listing not found for ${EXTENSION_ID}" 3
  REMOTE_EXTENSION_VERSION="$(
    printf '%s\n' "$VSCE_OUT" \
      | sed -n 's/^[[:space:]]*Version:[[:space:]]*//p' \
      | head -n 1 \
      | sed 's/[[:space:]]*$//'
  )"
  [[ -n "$REMOTE_EXTENSION_VERSION" ]] || fail "Could not parse remote extension version for ${EXTENSION_ID}" 4

  if [[ "$REMOTE_EXTENSION_VERSION" == "$LOCAL_EXTENSION_VERSION" ]]; then
    echo "post-release-verify: extension version match: ${REMOTE_EXTENSION_VERSION} (attempt ${attempt}/${VSCE_VERIFY_ATTEMPTS})"
    break
  fi

  if [[ "$attempt" -lt "$VSCE_VERIFY_ATTEMPTS" ]]; then
    echo "post-release-verify: extension version not visible yet (local=${LOCAL_EXTENSION_VERSION}, remote=${REMOTE_EXTENSION_VERSION}); retrying in ${VSCE_VERIFY_DELAY_SECONDS}s..."
    sleep "$VSCE_VERIFY_DELAY_SECONDS"
  fi
done

if [[ "$REMOTE_EXTENSION_VERSION" != "$LOCAL_EXTENSION_VERSION" ]]; then
  fail "Extension version mismatch after retries: local=${LOCAL_EXTENSION_VERSION} remote=${REMOTE_EXTENSION_VERSION}" 5
fi

if [[ "$VERIFY_PYTHON" != "0" ]]; then
  case "$PYTHON_REPOSITORY" in
    testpypi)
      PYPI_JSON_URL="https://test.pypi.org/pypi/persona-counsel/json"
      ;;
    pypi)
      PYPI_JSON_URL="https://pypi.org/pypi/persona-counsel/json"
      ;;
    *)
      fail "Unsupported PYTHON_REPOSITORY=${PYTHON_REPOSITORY} (expected testpypi or pypi)" 6
      ;;
  esac

  REMOTE_PYTHON_VERSION="$(
    python3 - "$PYPI_JSON_URL" <<'PY'
import json
import sys
from urllib.request import urlopen

url = sys.argv[1]
with urlopen(url, timeout=30) as response:
    payload = json.load(response)

print(payload["info"]["version"])
PY
  )"

  if [[ "$REMOTE_PYTHON_VERSION" != "$LOCAL_PYTHON_VERSION" ]]; then
    fail "Python version mismatch on ${PYTHON_REPOSITORY}: local=${LOCAL_PYTHON_VERSION} remote=${REMOTE_PYTHON_VERSION}" 7
  fi
  echo "post-release-verify: python version match on ${PYTHON_REPOSITORY}: ${REMOTE_PYTHON_VERSION}"
else
  echo "post-release-verify: python version check skipped (VERIFY_PYTHON=0)"
fi

echo "post-release-verify: OK"
