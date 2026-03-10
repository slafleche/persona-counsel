# Release Channels Runbook

This runbook defines how persona-counsel releases move through prerelease
(`alpha`) and stable channels.

## Channel Modes

Release behavior is controlled in `scripts/release.mjs`:

- `ALLOW_STABLE_RELEASE=false` (default): prerelease lock mode
- `ALLOW_STABLE_RELEASE=true`: stable mode

## Prerelease (Alpha) Flow

Use this mode for active development and early user testing.

### Version behavior

- Python: `X.Y.ZaN` -> `X.Y.Za(N+1)`
- VS Code: Marketplace-compatible prerelease format `X.Y.N`
- `npm run release:dry` shows the next synchronized bump.

### Target repositories/channels

- Python upload target: `testpypi`
- VS Code publish channel: `--pre-release`

### Required env vars

- `VSCE_PAT` (required if VS Code publish is enabled)
- `TWINE_USERNAME`/`TWINE_PASSWORD` (required if Python publish is enabled)
- Signing/notary vars are optional in prerelease mode:
  - `APPLE_CODESIGN_IDENTITY`
  - `APPLE_NOTARY_KEYCHAIN_PROFILE`

### Expected outputs

- New prerelease version on TestPyPI (unless `SKIP_PYTHON_PUBLISH=1`)
- New prerelease extension on Marketplace (unless `SKIP_VSCODE_PUBLISH=1`)
- Post-release verification runs automatically after successful dual publish.

## Stable Flow

Use this mode only for production-ready releases.

### Version behavior

- Stable base-version bump selection is enabled (`patch`/`minor`/`major`).

### Target repositories/channels

- Python upload target: `pypi`
- VS Code publish channel: stable

### Required env vars (hard guardrails)

- `APPLE_CODESIGN_IDENTITY`
- `APPLE_NOTARY_KEYCHAIN_PROFILE`
- `VSCE_PAT`
- Python publishing credentials (`TWINE_USERNAME`/`TWINE_PASSWORD`)

Stable release exits early if required signing/notary vars are missing.

## Rollback Behavior on Failure

If a failure happens after version bump:

- `scripts/release.mjs` restores both local versions to previous synchronized
  values (`pyproject.toml` + `extension/package.json`).
- Legacy local release venv (`.release-tools-venv`) is cleaned up if present.

## Useful Flags

- `SKIP_PYTHON_PUBLISH=1` to skip Python publish
- `SKIP_VSCODE_PUBLISH=1` to skip VS Code publish
- `RUN_POST_RELEASE_VERIFY=0` to skip automatic post-release verification
