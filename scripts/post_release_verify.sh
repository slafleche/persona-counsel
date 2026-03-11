#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_REPOSITORY="${PYTHON_REPOSITORY:-testpypi}"
VERIFY_PYTHON="${VERIFY_PYTHON:-1}"
VSCE_VERIFY_ATTEMPTS="${VSCE_VERIFY_ATTEMPTS:-20}"
VSCE_VERIFY_INITIAL_DELAY_SECONDS="${VSCE_VERIFY_INITIAL_DELAY_SECONDS:-45}"
VSCE_VERIFY_DELAY_SECONDS="${VSCE_VERIFY_DELAY_SECONDS:-30}"
VSCE_VERIFY_MAX_DELAY_SECONDS="${VSCE_VERIFY_MAX_DELAY_SECONDS:-120}"
VSCE_SHOW_TIMEOUT_SECONDS="${VSCE_SHOW_TIMEOUT_SECONDS:-25}"

if [[ -t 1 && "${NO_COLOR:-0}" != "1" ]]; then
  C_RESET=$'\033[0m'
  C_DIM=$'\033[2m'
  C_BLUE=$'\033[34m'
  C_CYAN=$'\033[36m'
  C_MAGENTA=$'\033[35m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
else
  C_RESET=''
  C_DIM=''
  C_BLUE=''
  C_CYAN=''
  C_MAGENTA=''
  C_GREEN=''
  C_YELLOW=''
  C_RED=''
fi

fail() {
  echo "post-release-verify: STATUS: ${C_RED}FAIL${C_RESET}" >&2
  echo "post-release-verify: ${C_RED}$1${C_RESET}" >&2
  exit "${2:-1}"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1" 2
}

require_cmd node
require_cmd python3
require_cmd npx

fmt_version() { printf "%b%s%b" "$C_CYAN" "$1" "$C_RESET"; }
fmt_channel() { printf "%b%s%b" "$C_MAGENTA" "$1" "$C_RESET"; }
fmt_url() { printf "%b%s%b" "$C_BLUE" "$1" "$C_RESET"; }
fmt_num() { printf "%b%s%b" "$C_YELLOW" "$1" "$C_RESET"; }
fmt_ok() { printf "%b%s%b" "$C_GREEN" "$1" "$C_RESET"; }
fmt_warn() { printf "%b%s%b" "$C_YELLOW" "$1" "$C_RESET"; }
fmt_hint() { printf "%b%s%b" "$C_DIM" "$1" "$C_RESET"; }

DEFAULT_EXTENSION_ID="$(
  node -e 'const pkg = require("./extension/package.json"); if (!pkg.publisher || !pkg.name) { throw new Error("Missing publisher/name in extension/package.json"); } process.stdout.write(`${pkg.publisher}.${pkg.name}`);'
)"
EXTENSION_ID="${EXTENSION_ID:-$DEFAULT_EXTENSION_ID}"

run_vsce_show() {
  python3 - "$EXTENSION_ID" "$VSCE_SHOW_TIMEOUT_SECONDS" <<'PY'
import subprocess
import sys

extension_id = sys.argv[1]
timeout_seconds = int(sys.argv[2])
cmd = ["npx", "--yes", "@vscode/vsce", "show", extension_id]

try:
    completed = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_seconds)
except subprocess.TimeoutExpired as error:
    if error.stdout:
        sys.stdout.write(error.stdout)
    if error.stderr:
        sys.stderr.write(error.stderr)
    print(f"vsce show timed out after {timeout_seconds}s", file=sys.stderr)
    sys.exit(124)

if completed.stdout:
    sys.stdout.write(completed.stdout)
if completed.stderr:
    sys.stderr.write(completed.stderr)
sys.exit(completed.returncode)
PY
}

countdown_sleep() {
  local total_seconds="$1"
  if [[ "$total_seconds" -le 0 ]]; then
    return
  fi
  while [[ "$total_seconds" -gt 0 ]]; do
    echo "post-release-verify: first marketplace check in $(fmt_num "${total_seconds}s")..."
    sleep 1
    total_seconds=$((total_seconds - 1))
  done
}

LOCAL_EXTENSION_VERSION="$(node -p "require('./extension/package.json').version")"
LOCAL_PYTHON_VERSION="$(
  python3 - <<'PY'
import tomllib
from pathlib import Path

raw = Path("pyproject.toml").read_text(encoding="utf-8")
print(tomllib.loads(raw)["project"]["version"])
PY
)"
if [[ "$LOCAL_EXTENSION_VERSION" =~ -[A-Za-z] ]]; then
  VS_MARKETPLACE_CHANNEL="pre-release"
elif [[ "$LOCAL_PYTHON_VERSION" =~ (a|b|rc)[0-9]+$ ]]; then
  VS_MARKETPLACE_CHANNEL="pre-release (marketplace-compatible version scheme)"
else
  VS_MARKETPLACE_CHANNEL="stable"
fi
if [[ "$LOCAL_PYTHON_VERSION" =~ (a|b|rc)[0-9]+$ ]]; then
  PYTHON_CHANNEL="pre-release"
else
  PYTHON_CHANNEL="stable"
fi

echo "post-release-verify: local extension version: $(fmt_version "${LOCAL_EXTENSION_VERSION}")"
echo "post-release-verify: local python version: $(fmt_version "${LOCAL_PYTHON_VERSION}")"
echo "post-release-verify: release channels: vscode=$(fmt_channel "${VS_MARKETPLACE_CHANNEL}"), python=$(fmt_channel "${PYTHON_CHANNEL}")"
echo "post-release-verify: checking extension id: $(fmt_channel "${EXTENSION_ID}")"
echo "post-release-verify: expected marketplace URL: $(fmt_url "https://marketplace.visualstudio.com/items?itemName=${EXTENSION_ID}")"
echo "post-release-verify: extension metadata command: $(fmt_hint "npx --yes @vscode/vsce show ${EXTENSION_ID}")"
echo "post-release-verify: marketplace check retry policy: attempts=$(fmt_num "${VSCE_VERIFY_ATTEMPTS}"), initial-delay=$(fmt_num "${VSCE_VERIFY_INITIAL_DELAY_SECONDS}s"), base-delay=$(fmt_num "${VSCE_VERIFY_DELAY_SECONDS}s"), max-delay=$(fmt_num "${VSCE_VERIFY_MAX_DELAY_SECONDS}s"), per-check-timeout=$(fmt_num "${VSCE_SHOW_TIMEOUT_SECONDS}s")"

if [[ "$VSCE_VERIFY_INITIAL_DELAY_SECONDS" -gt 0 ]]; then
  echo "post-release-verify: waiting $(fmt_num "${VSCE_VERIFY_INITIAL_DELAY_SECONDS}s") before first marketplace check..."
  countdown_sleep "$VSCE_VERIFY_INITIAL_DELAY_SECONDS"
fi

REMOTE_EXTENSION_VERSION=""
for attempt in $(seq 1 "$VSCE_VERIFY_ATTEMPTS"); do
  echo "post-release-verify: marketplace attempt $(fmt_num "${attempt}/${VSCE_VERIFY_ATTEMPTS}")..."
  REMOTE_EXTENSION_VERSION=""
  if VSCE_OUT="$(run_vsce_show 2>&1)"; then
    REMOTE_EXTENSION_VERSION="$(
      printf '%s\n' "$VSCE_OUT" \
        | sed -n 's/^[[:space:]]*Version:[[:space:]]*//p' \
        | head -n 1 \
        | sed 's/[[:space:]]*$//'
    )"
  else
    VSCE_OUT="$(printf '%s' "$VSCE_OUT" | tail -n 1)"
  fi

  if [[ -n "$REMOTE_EXTENSION_VERSION" && "$REMOTE_EXTENSION_VERSION" == "$LOCAL_EXTENSION_VERSION" ]]; then
    echo "post-release-verify: extension version match: $(fmt_ok "${REMOTE_EXTENSION_VERSION}") (attempt $(fmt_num "${attempt}/${VSCE_VERIFY_ATTEMPTS}"))"
    break
  fi

  if [[ "$attempt" -lt "$VSCE_VERIFY_ATTEMPTS" ]]; then
    sleep_seconds=$((VSCE_VERIFY_DELAY_SECONDS * attempt))
    if [[ "$sleep_seconds" -gt "$VSCE_VERIFY_MAX_DELAY_SECONDS" ]]; then
      sleep_seconds="$VSCE_VERIFY_MAX_DELAY_SECONDS"
    fi
    if [[ -n "$REMOTE_EXTENSION_VERSION" ]]; then
      echo "post-release-verify: $(fmt_warn "extension version not visible yet") (local=$(fmt_version "${LOCAL_EXTENSION_VERSION}"), remote=$(fmt_version "${REMOTE_EXTENSION_VERSION}")); retrying in $(fmt_num "${sleep_seconds}s")..."
    else
      echo "post-release-verify: $(fmt_warn "extension listing not visible yet") ($(fmt_hint "${VSCE_OUT}")); retrying in $(fmt_num "${sleep_seconds}s")..."
    fi
    sleep "$sleep_seconds"
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
  echo "post-release-verify: python metadata URL: $(fmt_url "${PYPI_JSON_URL}")"

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
  echo "post-release-verify: python version match on $(fmt_channel "${PYTHON_REPOSITORY}"): $(fmt_ok "${REMOTE_PYTHON_VERSION}")"
else
  echo "post-release-verify: python version check skipped (VERIFY_PYTHON=0)"
fi

echo "post-release-verify: STATUS: $(fmt_ok "OK")"
