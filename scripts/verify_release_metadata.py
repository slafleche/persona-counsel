#!/usr/bin/env python3
"""Validate locked release metadata across Python package and VS Code extension."""

from __future__ import annotations

import json
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EXPECTED_REPO = "https://github.com/slafleche/persona-counsel"
EXPECTED_REPO_GIT = f"{EXPECTED_REPO}.git"
EXPECTED_ISSUES = f"{EXPECTED_REPO}/issues"
EXPECTED_CHANGELOG = f"{EXPECTED_REPO}/blob/main/CHANGELOG.md"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def verify_pyproject() -> None:
    pyproject = ROOT / "pyproject.toml"
    data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    project = data.get("project", {})
    urls = project.get("urls", {})

    require(
        project.get("name") == "persona-counsel", "pyproject: project.name must be persona-counsel"
    )
    require(project.get("readme") == "README.md", "pyproject: project.readme must be README.md")
    require(
        project.get("license", {}).get("file") == "LICENSE",
        "pyproject: project.license.file must be LICENSE",
    )
    require(urls.get("Homepage") == EXPECTED_REPO, "pyproject: project.urls.Homepage mismatch")
    require(urls.get("Repository") == EXPECTED_REPO, "pyproject: project.urls.Repository mismatch")
    require(urls.get("Issues") == EXPECTED_ISSUES, "pyproject: project.urls.Issues mismatch")
    require(
        urls.get("Changelog") == EXPECTED_CHANGELOG, "pyproject: project.urls.Changelog mismatch"
    )


def verify_extension_package() -> None:
    package_json = ROOT / "extension" / "package.json"
    data = json.loads(package_json.read_text(encoding="utf-8"))

    require(
        data.get("publisher") == "PersonaCouncel",
        "extension/package.json: publisher must be PersonaCouncel",
    )
    require(data.get("license") == "MIT", "extension/package.json: license must be MIT")
    require(data.get("homepage") == EXPECTED_REPO, "extension/package.json: homepage mismatch")
    require(
        data.get("repository", {}).get("url") == EXPECTED_REPO_GIT,
        "extension/package.json: repository.url mismatch",
    )
    require(
        data.get("bugs", {}).get("url") == EXPECTED_ISSUES,
        "extension/package.json: bugs.url mismatch",
    )


def verify_changelog() -> None:
    changelog = ROOT / "CHANGELOG.md"
    require(changelog.exists(), "CHANGELOG.md is required")
    text = changelog.read_text(encoding="utf-8")
    require("## [Unreleased]" in text, "CHANGELOG.md must include an [Unreleased] section")


def main() -> int:
    verify_pyproject()
    verify_extension_package()
    verify_changelog()
    print("release-metadata-check: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
