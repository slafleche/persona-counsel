- [ ] Configure GitHub Actions secrets for macOS signing/notarization and verify CI uses them.
- [ ] Add `APPLE_CODESIGN_IDENTITY` secret to repo/environment settings.
- [ ] Add `APPLE_NOTARY_KEYCHAIN_PROFILE` secret to repo/environment settings.
- [ ] Run CI on a branch and confirm macOS signing step runs (not skipped).
- [ ] Run CI on a branch and confirm macOS notarization step runs (not skipped).
- [ ] Capture one successful signed/notarized run URL in docs.

- [x] Add `post-release` verification script (Marketplace listing, package index version, extension ID consistency).
- [x] Create `scripts/post_release_verify.sh` with clear pass/fail exit codes.
- [x] Verify VS Code listing exists for `PersonaCouncel.persona-counsel-vscode`.
- [x] Verify VS Code version matches local extension version.
- [ ] Verify TestPyPI/PyPI version matches local Python version based on release mode.
- [x] Add script usage docs to README release section.

- [x] Write one-page release channels runbook (`alpha/prerelease` flow vs `stable` flow).
- [x] Add `docs/release_channels.md`.
- [x] Document prerelease path: version bump behavior, targets, required env vars, expected outputs.
- [x] Document stable path: required signing/notary env vars and hard-fail guardrails.
- [x] Document rollback behavior on release failure.
- [x] Link runbook from README and release checklist.

- [x] Lock Python runtime dependency baseline for reproducible releases.
- [x] Choose locking approach (`pip-tools` or equivalent) and document rationale.
- [x] Generate lock file(s) for runtime dependencies.
- [x] Update install/release scripts to consume lock file(s) where appropriate.
- [x] Add lock refresh workflow (manual command + cadence).
- [x] Validate lock flow in CI.

-- Stop Here --

- [ ] Implement first real counsel execution loop (`list`, `summon`, `run`) with markdown trace output.
- [ ] Define minimal v1 domain schema for persona and counsel configs.
- [ ] Implement config loader + validation for `personas/` and `counsels/`.
- [ ] Implement `counsel list` output for available counsels/personas.
- [ ] Implement `counsel summon <name>` to resolve a counsel definition.
- [ ] Implement `counsel run` happy-path orchestration loop.
- [ ] Write markdown trace output to `sessions/` with deterministic structure.
- [ ] Add CLI tests for `list`, `summon`, `run`, and trace file generation.
