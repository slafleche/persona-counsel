- [x] Build supported target backends in CI (`darwin-arm64`, `linux-x64`, `win32-x64`).
- [x] Add multi-platform packaging strategy (single universal `.vsix` with all binaries or per-platform `.vsix` outputs).
- [x] Test extension on clean machines with no Python/counsel preinstalled.
- [x] Add Windows clean-machine VSIX smoke test for bundled `counsel.exe`.
- [x] Expand smoke tests to cover `--help/--version` and path compatibility (spaces + Unicode).
- [x] Add first-run bootstrap UX in extension for missing/incompatible backend detection and guided remediation.
- [x] Add explicit unsupported-platform handling when no bundled backend target matches host platform/arch.
- [x] Harden backend launch policy with strict mode to disable PATH fallback for marketplace builds.
- [x] Add extension E2E automation for `openTerminal`, `doctor`, `setup`, and failure paths.
- [x] Add Linux clean-machine VSIX smoke test (even if not officially supported yet).
- [x] Add SBOM/license report for bundled Python dependencies.
- [x] Pin and verify build toolchain versions (PyInstaller, Python minor, Node major) in CI.
- [x] Add artifact integrity check in CI (verify manifest/hash against packaged VSIX contents post-build).
- [x] Add upgrade/migration check (install old VSIX -> update to new VSIX -> commands still work).
- [x] Add `win32-x64` VSIX to the standard release packaging outputs (not smoke-only).
- [x] Lock release metadata (final publisher/name/repository/license links and changelog flow).
- [x] Add crash diagnostics bundle command (`Persona Counsel: Export Diagnostics`) for supportability.
- [x] Add minimal in-extension user docs and troubleshooting commands (install, backend diagnostics, recovery).

- [x] Refactor release script to stop npm publishing and publish to Python package indexes + VS Code Marketplace while keeping generic release orchestration logic.

- [x] Define signing/notarization strategy for distributed backend binaries (especially macOS).

Signing/notarization implementation checklist (next phase):

- [x] Add macOS code-signing step in CI for bundled backend binary (`counsel`).
- [x] Add macOS notarization + staple + verification step in CI.
- [x] Add release-mode guardrails: stable mode requires signing/notarization success.
- [x] Add secrets contract doc for Apple signing/notary credentials.
- [ ] Add user-facing note in release docs describing signed vs unsigned build expectations.

- [x] Restore `darwin-x64` backend CI build when an Intel macOS runner configuration is available.
