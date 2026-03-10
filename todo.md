- [ ] Configure GitHub Actions secrets for macOS signing/notarization and verify CI uses them.
- [ ] Add `APPLE_CODESIGN_IDENTITY` secret to repo/environment settings.
- [ ] Add `APPLE_NOTARY_KEYCHAIN_PROFILE` secret to repo/environment settings.
- [ ] Run CI on a branch and confirm macOS signing step runs (not skipped).
- [ ] Run CI on a branch and confirm macOS notarization step runs (not skipped).
- [ ] Capture one successful signed/notarized run URL in docs.

- [ ] Add `post-release` verification script (Marketplace listing, package index version, extension ID consistency).
- [ ] Create `scripts/post_release_verify.sh` with clear pass/fail exit codes.
- [ ] Verify VS Code listing exists for `PersonaCouncel.persona-counsel-vscode`.
- [ ] Verify VS Code version matches local extension version.
- [ ] Verify TestPyPI/PyPI version matches local Python version based on release mode.
- [ ] Add script usage docs to README release section.

- [ ] Write one-page release channels runbook (`alpha/prerelease` flow vs `stable` flow).
- [ ] Add `docs/release_channels.md`.
- [ ] Document prerelease path: version bump behavior, targets, required env vars, expected outputs.
- [ ] Document stable path: required signing/notary env vars and hard-fail guardrails.
- [ ] Document rollback behavior on release failure.
- [ ] Link runbook from README and release checklist.

- [ ] Lock Python runtime dependency baseline for reproducible releases.
- [ ] Choose locking approach (`pip-tools` or equivalent) and document rationale.
- [ ] Generate lock file(s) for runtime dependencies.
- [ ] Update install/release scripts to consume lock file(s) where appropriate.
- [ ] Add lock refresh workflow (manual command + cadence).
- [ ] Validate lock flow in CI.

- [ ] Implement first real counsel execution loop (`list`, `summon`, `run`) with markdown trace output.
- [ ] Define minimal v1 domain schema for persona and counsel configs.
- [ ] Implement config loader + validation for `personas/` and `counsels/`.
- [ ] Implement `counsel list` output for available counsels/personas.
- [ ] Implement `counsel summon <name>` to resolve a counsel definition.
- [ ] Implement `counsel run` happy-path orchestration loop.
- [ ] Write markdown trace output to `sessions/` with deterministic structure.
- [ ] Add CLI tests for `list`, `summon`, `run`, and trace file generation.
