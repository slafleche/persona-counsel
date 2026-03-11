# Release Runbook

This is the operator runbook for publishing persona-counsel.

## Current model (CI-driven publish)

Official publish is CI-only.

Release requirements:

1. Clean git working tree.
2. Required backend artifacts present for selected VSIX targets (built in CI).
3. Required GitHub Actions secrets configured.

Primary commands:

```bash
npm run release:dry
npm run release -- --check-only
npm run release:reset
```

`npm run release` is blocked locally by default and should run in CI workflow context.

## Release modes

| Mode | Command | Purpose |
|---|---|---|
| Local dry run | `npm run release:dry` | Show synchronized release plan only |
| Local preflight | `npm run release -- --check-only` | Validate local release prerequisites without publishing |
| Local reset | `npm run release:reset` | Clear local release state and restore latest published pair |
| CI publish | GitHub Actions workflow run | Build matrix, publish, verify, tag, track |

## Branch policy

- `main`: development / experimentation
- `prerelease`: prerelease publication pipeline
- `release`: stable publication pipeline (future-ready lane)
- Open PRs from feature branches into `prerelease` (or `release`) to trigger release-lane CI.

## Operator checklist

1. Open PR into target release lane (`prerelease` or `release`).
2. Ensure CI checks pass on PR.
3. Merge PR to trigger workflow:
   - `.github/workflows/release_artifact_matrix.yml`
4. Confirm workflow publish/verify completion.
5. Confirm release tracking outputs:
   - `releases/history.jsonl`
   - `releases/latest.json`
   - git tag `release/<canonicalVersion>`
6. If interrupted/stuck, run `npm run release:reset` locally before retrying diagnostics.

## Artifact matrix note

Default VSIX target matrix is:

- `darwin-arm64`
- `linux-x64`
- `win32-x64`

Matrix artifacts are expected from CI build jobs for official publish.
Local single-target builds can still be used for debug preflight.

Expected artifact layout:

```text
build/vscode-backend-artifacts/<platform>-<arch>/counsel(.exe)
```

## Required GitHub Actions secrets

Required:

- `VSCE_PAT`
- `TWINE_USERNAME` (typically `__token__`)
- `TWINE_PASSWORD`

Optional split by channel (recommended):

- `TWINE_PASSWORD_TESTPYPI`
- `TWINE_PASSWORD_PYPI`

## Release tracking

Successful finalization updates:

- `releases/history.jsonl`
- `releases/latest.json`
- git tag: `release/<canonicalVersion>`

## Common failures

1. `Release publish is CI-only`
   - Run local preflight commands only, then trigger CI release workflow.
2. Missing matrix artifacts
   - Ensure CI produced all required targets under `build/vscode-backend-artifacts/...`.
3. Missing secrets
   - Add required repository secrets in GitHub Actions settings.
4. Stuck local release state
   - Use `npm run release:reset` to clear local state and resync versions.

## Related docs

- `docs/release_channels.md`
- `docs/release-readiness-checklist.md`
- `docs/release_signing_secrets.md`
- `epics/01_artifactmatrix/01_artifactmatrix_plan.md`
