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

See:

- `vscode/BACKEND.md`
- `epics/00_vision/spec.md`
