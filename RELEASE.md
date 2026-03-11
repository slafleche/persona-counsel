# Release Runbook

This is the operator runbook for publishing persona-counsel.

## Current model (local-driven release)

`npm run release` is the release entrypoint.

Release requirements:

1. Clean git working tree.
2. Required backend artifacts present for selected VSIX targets.
3. Required credentials in environment (`VSCE_PAT`, `TWINE_*`).

Primary commands:

```bash
npm run release:dry
npm run release
npm run release -- --check-only
npm run release:reset
```

## Quick flow

1. Run `npm run release:dry` to inspect plan.
2. Run `npm run release -- --check-only` to preflight.
3. Run `npm run release` to publish/finalize.
4. If interrupted/stuck, run `npm run release:reset`.

## Artifact matrix note

Default VSIX target matrix is:

- `darwin-arm64`
- `linux-x64`
- `win32-x64`

On macOS local runs, only `darwin-arm64` can be built locally by default.
`linux-x64` and `win32-x64` artifacts must come from CI/other build hosts.

Expected artifact layout:

```text
build/vscode-backend-artifacts/<platform>-<arch>/counsel(.exe)
```

## Release tracking

Successful finalization updates:

- `releases/history.jsonl`
- `releases/latest.json`
- git tag: `release/<canonicalVersion>`

## Related docs

- `docs/release_channels.md`
- `docs/release-readiness-checklist.md`
- `docs/release_signing_secrets.md`
- `epics/01_artifactmatrix/01_artifactmatrix_plan.md`
