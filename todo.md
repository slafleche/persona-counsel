
## Portability / Installability

- [ ] Tracked in Epic 01: `epics/01_artifactmatrix/01_artifactmatrix_plan.md`

== Blocking ==

- [ ] Implement first real counsel execution loop (`list`, `summon`, `run`) with markdown trace output.
- [ ] Define minimal v1 domain schema for persona and counsel configs.
- [ ] Implement config loader + validation for `personas/` and `counsels/`.
- [ ] Implement `counsel list` output for available counsels/personas.
- [ ] Implement `counsel summon <name>` to resolve a counsel definition.
- [ ] Implement `counsel run` happy-path orchestration loop.
- [ ] Write markdown trace output to `sessions/` with deterministic structure.
- [ ] Add CLI tests for `list`, `summon`, `run`, and trace file generation.
