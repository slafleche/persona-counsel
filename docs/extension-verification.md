# Extension Verification Runbook

Use this runbook to verify the VS Code extension + backend behavior before
release.

## Prerequisites

- Extension built (`cd extension && npm run build`)
- Backend packaged for at least one platform (`./scripts/build_vscode_backend.sh`)
- Extension packaged (`./scripts/package_vscode_extension.sh`) if validating .vsix

## CLI Baseline Check

Run:

```bash
./scripts/validate_local_cli.sh
```

Expected:

- `counsel` command available
- `counsel doctor --json` returns parseable JSON
- `counsel setup` succeeds
- `personas/`, `counsels/`, `sessions/` directories exist

## VS Code Manual Checks

1. Command: `Persona Counsel: Open Terminal`
- Expected: integrated terminal opens and runs `counsel --help` using resolved backend.

2. Command: `Persona Counsel: Doctor`
- Expected: success info message when backend healthy.
- On backend preflight failure: guided remediation message with actions
  (`Show Output`, `Open Settings`, plus targeted fixes when applicable).
- On command failure: error message shown, details available in output channel.

3. Command: `Persona Counsel: Setup`
- Expected: setup success message and baseline folders created.

4. Command: `Persona Counsel: Show Output`
- Expected: output channel opens and shows command logs (exec path, stdout/stderr, elapsed time).

## Negative Path Checks

1. Missing backend and PATH fallback disabled
- Set `personaCounsel.allowPathFallback = false`
- Ensure no bundled backend exists for current platform
- Expected: clear error about missing bundled backend.

2. Invalid `personaCounsel.backendPath`
- Set to a non-executable or relative path
- Expected: clear error indicating backend path must be absolute executable, with
  a guided `Clear backendPath` action.

3. Untrusted workspace block (if enabled)
- Set `personaCounsel.requireTrustedWorkspace = true`
- Open an untrusted workspace
- Expected: command execution blocked with explicit trust error.

4. Unsupported host target for bundled backend
- Package/install a `.vsix` that does not include current `platform-arch` target
- Expected: clear error like `Unsupported platform target for bundled backend: ...`
  with guidance actions (`Show Output`, `Open Settings`).

## Packaging Check

Run:

```bash
./scripts/package_vscode_extension.sh
```

Expected:

- preflight passes only when backend artifacts are present
- extension builds
- `.vsix` is generated in `extension/`
