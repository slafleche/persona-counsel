
## Portability / Installability

- [ ] Build and publish VSIX targets for `linux-x64` and `win32-x64` (not only `darwin-arm64`).
- [ ] Run VSIX smoke tests on clean Linux and Windows machines for the same published version.
- [ ] Verify extension runtime behavior on non-macOS in production mode (strict PATH fallback rules).
- [ ] Add a fresh-machine install validation checklist for VS Code extension + CLI paths.

== Blocking ==

- [ ] Implement first real counsel execution loop (`list`, `summon`, `run`) with markdown trace output.
- [ ] Define minimal v1 domain schema for persona and counsel configs.
- [ ] Implement config loader + validation for `personas/` and `counsels/`.
- [ ] Implement `counsel list` output for available counsels/personas.
- [ ] Implement `counsel summon <name>` to resolve a counsel definition.
- [ ] Implement `counsel run` happy-path orchestration loop.
- [ ] Write markdown trace output to `sessions/` with deterministic structure.
- [ ] Add CLI tests for `list`, `summon`, `run`, and trace file generation.
