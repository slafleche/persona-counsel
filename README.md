# persona-counsel

CLI-first multi-agent runtime (Python), with planned VS Code integration as a
thin client.

## Quickstart

```bash
python3.11 -m pip install -e .
counsel setup
counsel doctor --json
```

## VS Code Readiness

This project supports building a standalone backend binary for extension
packaging so end users do not need to install Python manually.

Build command:

```bash
./scripts/build_vscode_backend.sh
```

This also generates:

- `build/vscode-backend-artifacts/manifest.json`

Package extension command:

```bash
./scripts/package_vscode_extension.sh
```

Strict release gate (all target backends required):

```bash
STRICT_MATRIX=1 ./scripts/package_vscode_extension.sh
```

Release command (strict matrix + packaging):

```bash
./scripts/release_vscode_extension.sh
```

Custom target set (CI/staged release):

```bash
REQUIRED_TARGETS="darwin-arm64 linux-x64" ./scripts/release_vscode_extension.sh
```

Local validation command:

```bash
./scripts/validate_local_cli.sh
```

See:

- `vscode/BACKEND.md`
- `epics/00_vision/spec.md`
- `docs/extension-verification.md`
- `docs/release-readiness-checklist.md`
