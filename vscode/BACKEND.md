# VS Code Backend Packaging Contract

This project is CLI-first, but can be bundled for VS Code extension use without
requiring Python on end-user machines.

## Build Standalone Backend Binary

From repo root:

```bash
./scripts/build_vscode_backend.sh
```

Output:

- `build/vscode-backend-artifacts/<platform>-<arch>/counsel`
- `build/vscode-backend-artifacts/<platform>-<arch>/counsel.exe` (Windows)
- `build/vscode-backend-artifacts/manifest.json`

## Bundled Binary Layout (Extension)

The extension resolves bundled backends with this convention:

- `backend/<platform>-<arch>/counsel`
- Windows: `backend/<platform>-<arch>/counsel.exe`

Examples:

- `backend/darwin-arm64/counsel`
- `backend/linux-x64/counsel`
- `backend/win32-x64/counsel.exe`

## Package the Extension (.vsix)

From repo root:

```bash
./scripts/package_vscode_extension.sh
```

What it does:

- validates backend artifacts are present
- regenerates backend manifest (`manifest.json`)
- copies artifacts into `extension/backend/`
- builds extension TypeScript output
- packages `.vsix` via `vsce` (or `npx @vscode/vsce`)

## Backend Artifact Manifest

Generated file:

- `build/vscode-backend-artifacts/manifest.json`

Copied into extension package at:

- `extension/backend/manifest.json`

Manifest contents:

- schema version
- available target list
- per-target binary path
- size and SHA-256 hash

## Platform Matrix Preflight

Check required backend targets:

```bash
./scripts/check_vscode_backend_matrix.sh
```

Default required targets:

- `darwin-arm64`
- `darwin-x64`
- `linux-x64`
- `win32-x64`

Enforce this gate during packaging:

```bash
STRICT_MATRIX=1 ./scripts/package_vscode_extension.sh
```

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

## Security and Runtime Settings

Extension settings:

- `personaCounsel.backendPath`
  - optional absolute path to backend executable override
- `personaCounsel.allowPathFallback`
  - allow fallback to `counsel` from PATH when no bundled backend is present
- `personaCounsel.requireTrustedWorkspace`
  - block backend execution in untrusted workspaces when enabled
- `personaCounsel.commandTimeoutMs`
  - timeout for backend command execution
