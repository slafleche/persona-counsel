
## Portability / Installability

- [ ] Finalize release lanes flow: PR->merge to `prerelease` auto-publishes prerelease in CI; manual promotion to `release` publishes stable.
  - [ ] Add CI release orchestrator skeleton job after matrix build (download artifacts + validate layout only).
  - [ ] Wire CI orchestrator to run non-interactive release publish + post-release verification.
  - [ ] Add manual promotion path for stable publish on `release` lane.
- [ ] Add CI release workflow concurrency guard (prevent overlapping release runs).
- [ ] Add CI secret preflight checks (`VSCE_PAT`, `TWINE_USERNAME`, `TWINE_PASSWORD`).
- [ ] Add artifact integrity verification before packaging/publish (sha256 check).
- [ ] Restrict auto release-tracking commit scope to release files only (no broad `git add -A`).
- [ ] Add CI release summary artifact/output (version, channels, URLs, commit, tag).

== Blocking ==

- [ ] Implement first real counsel execution loop (`list`, `summon`, `run`) with markdown trace output.
- [ ] Define minimal v1 domain schema for persona and counsel configs.
- [ ] Implement config loader + validation for `personas/` and `counsels/`.
- [ ] Implement `counsel list` output for available counsels/personas.
- [ ] Implement `counsel summon <name>` to resolve a counsel definition.
- [ ] Implement `counsel run` happy-path orchestration loop.
- [ ] Write markdown trace output to `sessions/` with deterministic structure.
- [ ] Add CLI tests for `list`, `summon`, `run`, and trace file generation.
