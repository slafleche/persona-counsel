#!/usr/bin/env python3
"""Verify backend manifest + hash integrity inside a packaged VSIX."""

from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import PurePosixPath


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json_from_zip(zf: zipfile.ZipFile, member: str) -> dict:
    try:
        raw = zf.read(member)
    except KeyError as exc:
        raise RuntimeError(f"Missing required file in VSIX: {member}") from exc
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Invalid JSON in VSIX member: {member}") from exc


def normalize_relpath(value: str) -> str:
    return str(PurePosixPath(value))


def verify_vsix(vsix_path: str, target: str) -> None:
    with zipfile.ZipFile(vsix_path, "r") as zf:
        manifest = read_json_from_zip(zf, "extension/backend/manifest.json")
        targets = manifest.get("targets")
        if not isinstance(targets, list):
            raise RuntimeError("Invalid backend manifest: targets array missing.")

        entry = next((item for item in targets if item.get("target") == target), None)
        if not entry:
            declared = [str(item.get("target")) for item in targets]
            raise RuntimeError(
                f"Target {target} not declared in backend manifest. Declared: {declared}",
            )

        relpath = normalize_relpath(str(entry.get("relativePath", "")))
        filename = str(entry.get("filename", ""))
        expected_sha = str(entry.get("sha256", ""))
        if not relpath or not filename or not expected_sha:
            raise RuntimeError(
                f"Invalid manifest entry for target {target}: missing relativePath/filename/sha256.",
            )

        if PurePosixPath(relpath).name != filename:
            raise RuntimeError(
                f"Manifest filename mismatch for target {target}: relativePath={relpath}, filename={filename}",
            )

        binary_member = f"extension/backend/{relpath}"
        try:
            binary = zf.read(binary_member)
        except KeyError as exc:
            raise RuntimeError(
                f"Bundled backend binary missing in VSIX for target {target}: {binary_member}",
            ) from exc

        actual_sha = sha256_bytes(binary)
        if actual_sha != expected_sha:
            raise RuntimeError(
                f"SHA-256 mismatch for target {target}: expected={expected_sha} actual={actual_sha}",
            )

        print(f"vsix-integrity: ok ({target})")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify packaged VSIX backend integrity against manifest hashes.",
    )
    parser.add_argument("vsix_path", help="Path to .vsix file")
    parser.add_argument("target", help="Target triplet (e.g. darwin-arm64)")
    args = parser.parse_args()

    verify_vsix(args.vsix_path, args.target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
