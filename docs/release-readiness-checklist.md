# Release Readiness Checklist

## Backend Artifacts

- [ ] `./scripts/build_vscode_backend.sh` completed for target platform(s)
- [ ] Artifacts exist under `build/vscode-backend-artifacts/<platform>-<arch>/`
- [ ] Binary name is correct (`counsel` or `counsel.exe`)

## Release Metadata

- [ ] `python scripts/verify_release_metadata.py` passes
- [ ] `CHANGELOG.md` updated under `## [Unreleased]` before tagging

## Extension Build

- [ ] `cd extension && npm install`
- [ ] `cd extension && npm run build`
- [ ] `Persona Counsel` commands are present in command palette

## Validation

- [ ] `./scripts/validate_local_cli.sh` passes
- [ ] Manual runbook checks in `docs/extension-verification.md` completed

## Packaging

- [ ] `./scripts/release_vscode_extension.sh` succeeds
- [ ] Target VSIX files produced under `extension/`:
  - `persona-counsel-vscode-darwin-arm64.vsix`
  - `persona-counsel-vscode-linux-x64.vsix`
  - `persona-counsel-vscode-win32-x64.vsix`
- [ ] Included backend folder in each package matches target platform

## Safety

- [ ] `personaCounsel.requireTrustedWorkspace` behavior verified
- [ ] `personaCounsel.backendPath` override behavior verified
- [ ] `personaCounsel.allowPathFallback` behavior verified

## Signed vs Unsigned Build Expectations

- [ ] Pre-release lock mode (`ALLOW_STABLE_RELEASE=false`): release notes clearly
      indicate whether shipped macOS binaries are signed/notarized or unsigned.
- [ ] Stable release mode (`ALLOW_STABLE_RELEASE=true`): macOS backend binaries
      are signed and notarized; do not ship unsigned stable builds.
- [ ] If signing/notary secrets are missing, only prerelease builds are allowed.
