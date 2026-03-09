#!/usr/bin/env python3
"""Verify expected toolchain versions for CI/build reproducibility."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys


SEMVER_RE = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)")


def parse_semver(raw: str, label: str) -> tuple[int, int, int]:
  match = SEMVER_RE.match(raw.strip())
  if not match:
    raise RuntimeError(f"Could not parse {label} version: {raw!r}")
  return (int(match.group(1)), int(match.group(2)), int(match.group(3)))


def check_python(expected_minor: str) -> None:
  actual = f"{sys.version_info.major}.{sys.version_info.minor}"
  if actual != expected_minor:
    raise RuntimeError(
      f"Python minor mismatch: expected {expected_minor}.x, got {sys.version.split()[0]}",
    )
  print(f"toolchain-check: python ok ({sys.version.split()[0]})")


def check_node(expected_major: int) -> None:
  raw = subprocess.check_output(["node", "--version"], text=True).strip()
  major, minor, patch = parse_semver(raw, "node")
  if major != expected_major:
    raise RuntimeError(
      f"Node major mismatch: expected {expected_major}.x, got {major}.{minor}.{patch}",
    )
  print(f"toolchain-check: node ok ({major}.{minor}.{patch})")


def check_pyinstaller(expected_major: int) -> None:
  raw = subprocess.check_output(
    [
      sys.executable,
      "-c",
      "import PyInstaller; print(PyInstaller.__version__)",
    ],
    text=True,
  ).strip()
  major, minor, patch = parse_semver(raw, "pyinstaller")
  if major != expected_major:
    raise RuntimeError(
      f"PyInstaller major mismatch: expected {expected_major}.x, got {major}.{minor}.{patch}",
    )
  print(f"toolchain-check: pyinstaller ok ({major}.{minor}.{patch})")


def main() -> int:
  parser = argparse.ArgumentParser(description="Verify CI/build toolchain versions.")
  parser.add_argument("--check-python", action="store_true")
  parser.add_argument("--check-node", action="store_true")
  parser.add_argument("--check-pyinstaller", action="store_true")
  args = parser.parse_args()

  check_python_flag = args.check_python
  check_node_flag = args.check_node
  check_pyinstaller_flag = args.check_pyinstaller

  if not (check_python_flag or check_node_flag or check_pyinstaller_flag):
    check_python_flag = True
    check_node_flag = True
    check_pyinstaller_flag = True

  expected_python_minor = os.environ.get("EXPECTED_PYTHON_MINOR", "3.11")
  expected_node_major = int(os.environ.get("EXPECTED_NODE_MAJOR", "20"))
  expected_pyinstaller_major = int(os.environ.get("EXPECTED_PYINSTALLER_MAJOR", "6"))

  if check_python_flag:
    check_python(expected_python_minor)
  if check_node_flag:
    check_node(expected_node_major)
  if check_pyinstaller_flag:
    check_pyinstaller(expected_pyinstaller_major)

  return 0


if __name__ == "__main__":
  raise SystemExit(main())
