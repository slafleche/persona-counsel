#!/usr/bin/env python3
"""Generate a minimal SBOM/license report for persona-counsel runtime deps."""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime
from importlib import metadata
from pathlib import Path


REQ_NAME_RE = re.compile(r"^\s*([A-Za-z0-9_.-]+)")


@dataclass(frozen=True)
class DistInfo:
    canonical_name: str
    name: str
    version: str
    requires: list[str]
    license: str
    license_classifiers: list[str]
    summary: str
    home_page: str


def canonicalize(name: str) -> str:
    return name.strip().lower().replace("_", "-")


def parse_requirement_name(requirement: str) -> str | None:
    # Strip environment markers and extras, keep only base name.
    raw = requirement.split(";", 1)[0].strip()
    if not raw:
        return None
    match = REQ_NAME_RE.match(raw)
    if not match:
        return None
    return canonicalize(match.group(1))


def extract_license(md: metadata.PackageMetadata) -> tuple[str, list[str]]:
    license_field = (md.get("License") or "").strip()
    classifiers = md.get_all("Classifier") or []
    license_classifiers = [
        item.strip()
        for item in classifiers
        if item.startswith("License :: ")
    ]
    return (license_field or "UNKNOWN", license_classifiers)


def build_dist_index() -> dict[str, DistInfo]:
    result: dict[str, DistInfo] = {}
    for dist in metadata.distributions():
        dist_name = dist.metadata.get("Name") or dist.metadata.get("Summary") or ""
        if not dist_name:
            continue
        canonical = canonicalize(dist_name)
        if canonical in result:
            continue
        license_value, license_classifiers = extract_license(dist.metadata)
        result[canonical] = DistInfo(
            canonical_name=canonical,
            name=dist.metadata.get("Name", dist_name),
            version=dist.version,
            requires=list(dist.requires or []),
            license=license_value,
            license_classifiers=license_classifiers,
            summary=(dist.metadata.get("Summary") or "").strip(),
            home_page=(dist.metadata.get("Home-page") or "").strip(),
        )
    return result


def collect_runtime_closure(
    index: dict[str, DistInfo],
    roots: list[str],
    root_requirements: list[str],
) -> list[DistInfo]:
    visited: set[str] = set()
    queue: deque[str] = deque()

    for root in roots:
        queue.append(root)
    for req in root_requirements:
        req_name = parse_requirement_name(req)
        if req_name:
            queue.append(req_name)

    while queue:
        current = queue.popleft()
        if current in visited:
            continue
        if current not in index:
            # Requirement may be optional/marker-filtered on this platform.
            continue
        visited.add(current)
        for req in index[current].requires:
            req_name = parse_requirement_name(req)
            if req_name and req_name not in visited:
                queue.append(req_name)

    dists = [index[name] for name in sorted(visited)]
    return dists


def load_project_deps_from_pyproject(pyproject_path: Path) -> list[str]:
    if not pyproject_path.exists():
        return []
    parsed = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    project = parsed.get("project", {})
    deps = project.get("dependencies", [])
    if not isinstance(deps, list):
        return []
    return [str(item) for item in deps]


def generate_report(project_dist_name: str) -> dict[str, object]:
    index = build_dist_index()
    root = canonicalize(project_dist_name)
    project_roots: list[str] = []
    root_requirements: list[str] = []

    if root in index:
        root_dist = index[root]
        project_roots = [root]
        root_requirements = list(root_dist.requires)
        project_name = root_dist.name
        project_version = root_dist.version
    else:
        root_requirements = load_project_deps_from_pyproject(Path("pyproject.toml"))
        project_name = project_dist_name
        project_version = "UNKNOWN"

    runtime_dists = collect_runtime_closure(index, project_roots, root_requirements)

    return {
        "schema_version": 1,
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "python": {
            "version": sys.version.split()[0],
            "implementation": sys.implementation.name,
        },
        "project": {
            "name": project_name,
            "version": project_version,
        },
        "declared_requirements": sorted(
            filter(None, (parse_requirement_name(item) for item in root_requirements)),
        ),
        "packages": [
            {
                "name": dist.name,
                "version": dist.version,
                "license": dist.license,
                "license_classifiers": dist.license_classifiers,
                "summary": dist.summary,
                "home_page": dist.home_page,
                "requires": sorted(
                    filter(
                        None,
                        (parse_requirement_name(req) for req in dist.requires),
                    ),
                ),
            }
            for dist in runtime_dists
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate runtime Python SBOM/license JSON report.",
    )
    parser.add_argument(
        "--project",
        default="persona-counsel",
        help="Installed project distribution name (default: persona-counsel).",
    )
    parser.add_argument(
        "--out",
        default="build/reports/python-sbom.json",
        help="Output JSON path (default: build/reports/python-sbom.json).",
    )
    args = parser.parse_args()

    report = generate_report(args.project)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"python-sbom: wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
