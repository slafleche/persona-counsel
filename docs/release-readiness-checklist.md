# Release Readiness Checklist

## Backend Artifacts

- [ ] `./scripts/build_vscode_backend.sh` completed for target platform(s)
- [ ] Artifacts exist under `build/vscode-backend-artifacts/<platform>-<arch>/`
- [ ] Binary name is correct (`counsel` or `counsel.exe`)

## Extension Build

- [ ] `cd extension && npm install`
- [ ] `cd extension && npm run build`
- [ ] `Persona Counsel` commands are present in command palette

## Validation

- [ ] `./scripts/validate_local_cli.sh` passes
- [ ] Manual runbook checks in `docs/extension-verification.md` completed

## Packaging

- [ ] `./scripts/package_vscode_extension.sh` succeeds
- [ ] `.vsix` produced under `extension/`
- [ ] Included backend folder in package matches target platform(s)

## Safety

- [ ] `personaCounsel.requireTrustedWorkspace` behavior verified
- [ ] `personaCounsel.backendPath` override behavior verified
- [ ] `personaCounsel.allowPathFallback` behavior verified
