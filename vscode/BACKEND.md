# VS Code Backend Packaging Contract

This project is CLI-first, but can be bundled for VS Code extension use without
requiring Python on end-user machines.

## Build Standalone Backend Binary

From repo root:

```bash
./scripts/build_vscode_backend.sh
```

Output:

- `build/vscode-backend/counsel`

## Extension Integration Model

- Ship platform-specific binaries inside the extension package.
- Extension launches backend as a child process.
- Backend remains the source of truth for orchestration and config behavior.

## Health Check Contract

The extension should call:

```bash
counsel doctor --json
```

Expected JSON fields:

- `status`
- `checks.backend_version`
- `checks.python_version` (useful for non-bundled fallback)
- `checks.platform`
- `checks.arch`
- `checks.paths.personas_exists`
- `checks.paths.counsels_exists`
- `checks.paths.sessions_exists`

## Setup Contract

The extension may call:

```bash
counsel setup
```

This creates baseline directories:

- `personas/`
- `counsels/`
- `sessions/`

## Design Rule

Do not put core business logic in the extension. The extension is a thin UI and
process launcher; the CLI backend is the product runtime.
