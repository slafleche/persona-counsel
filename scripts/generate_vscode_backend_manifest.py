#!/usr/bin/env python3
"""Generate backend artifact manifest for VS Code packaging."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    artifacts_dir = root / "build" / "vscode-backend-artifacts"
    manifest_path = artifacts_dir / "manifest.json"

    if not artifacts_dir.exists():
        raise SystemExit(f"Missing artifacts directory: {artifacts_dir}")

    targets = []
    for target_dir in sorted(p for p in artifacts_dir.iterdir() if p.is_dir()):
        linux_like_bin = target_dir / "counsel"
        windows_bin = target_dir / "counsel.exe"
        binary = windows_bin if windows_bin.exists() else linux_like_bin
        if not binary.exists():
            continue

        targets.append(
            {
                "target": target_dir.name,
                "filename": binary.name,
                "relativePath": f"{target_dir.name}/{binary.name}",
                "sizeBytes": binary.stat().st_size,
                "sha256": sha256_file(binary),
            }
        )

    manifest = {
        "schemaVersion": 1,
        "artifactRoot": "build/vscode-backend-artifacts",
        "targets": targets,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote manifest: {manifest_path}")
    print(f"Targets: {len(targets)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
