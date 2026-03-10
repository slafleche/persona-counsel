#!/usr/bin/env python3
"""Verify VSIX upgrade-path compatibility between an old and new package."""

from __future__ import annotations

import argparse
import json
import re
import zipfile
from dataclasses import dataclass

SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$")


@dataclass(frozen=True)
class VsixInfo:
    extension_id: str
    version: str
    command_ids: set[str]
    targets: set[str]


def parse_semver(value: str) -> tuple[int, int, int, str]:
    match = SEMVER_RE.match(value)
    if not match:
        raise RuntimeError(f"Unsupported semver format: {value}")
    major = int(match.group(1))
    minor = int(match.group(2))
    patch = int(match.group(3))
    prerelease = match.group(4) or ""
    return (major, minor, patch, prerelease)


def semver_is_newer(old: str, new: str) -> bool:
    o = parse_semver(old)
    n = parse_semver(new)
    if n[:3] != o[:3]:
        return n[:3] > o[:3]
    # Same major/minor/patch: stable release is newer than prerelease.
    if o[3] and not n[3]:
        return True
    return False


def read_json(zf: zipfile.ZipFile, path: str) -> dict:
    try:
        raw = zf.read(path)
    except KeyError as exc:
        raise RuntimeError(f"Missing required VSIX member: {path}") from exc
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Invalid JSON for VSIX member: {path}") from exc


def load_vsix(path: str) -> VsixInfo:
    with zipfile.ZipFile(path, "r") as zf:
        package_json = read_json(zf, "extension/package.json")
        manifest_json = read_json(zf, "extension/backend/manifest.json")

    publisher = str(package_json.get("publisher", "")).strip()
    name = str(package_json.get("name", "")).strip()
    version = str(package_json.get("version", "")).strip()
    if not publisher or not name or not version:
        raise RuntimeError(f"Invalid extension package metadata in {path}")
    ext_id = f"{publisher}.{name}"

    commands = package_json.get("contributes", {}).get("commands", [])
    command_ids = {
        str(item.get("command", "")).strip()
        for item in commands
        if isinstance(item, dict) and str(item.get("command", "")).strip()
    }

    targets = {
        str(item.get("target", "")).strip()
        for item in manifest_json.get("targets", [])
        if isinstance(item, dict) and str(item.get("target", "")).strip()
    }

    return VsixInfo(
        extension_id=ext_id,
        version=version,
        command_ids=command_ids,
        targets=targets,
    )


def verify_upgrade(old_vsix: str, new_vsix: str, target: str) -> None:
    old = load_vsix(old_vsix)
    new = load_vsix(new_vsix)

    if old.extension_id != new.extension_id:
        raise RuntimeError(
            f"Extension ID changed across upgrade path: old={old.extension_id}, new={new.extension_id}",
        )

    if not semver_is_newer(old.version, new.version):
        raise RuntimeError(
            f"Version did not increase for upgrade path: old={old.version}, new={new.version}",
        )

    missing_commands = sorted(old.command_ids - new.command_ids)
    if missing_commands:
        raise RuntimeError(
            f"Upgrade removed command IDs required for compatibility: {missing_commands}",
        )

    if target not in old.targets:
        raise RuntimeError(f"Old VSIX is missing target {target}")
    if target not in new.targets:
        raise RuntimeError(f"New VSIX is missing target {target}")

    print(
        "vsix-upgrade-check: ok "
        f"(id={new.extension_id}, old={old.version}, new={new.version}, target={target})",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify VSIX upgrade compatibility between old and new packages.",
    )
    parser.add_argument("old_vsix", help="Path to baseline/old VSIX")
    parser.add_argument("new_vsix", help="Path to new/current VSIX")
    parser.add_argument("target", help="Target triplet (e.g. linux-x64)")
    args = parser.parse_args()

    verify_upgrade(args.old_vsix, args.new_vsix, args.target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
