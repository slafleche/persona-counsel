# Epic 01: Portability Plan

- [ ] Add canonical version parsing/formatting support to release flow.
  - [ ] Define canonical prerelease parser (`X.Y.Z-alpha.N`).
  - [ ] Define Python derivation (`X.Y.ZaN`).
  - [ ] Define VS Code derivation (`X.Y.N`).
  - [ ] Validate round-trip consistency in dry-run output.

- [ ] Add local release state file lifecycle.
  - [ ] Create `.release-state.local.json` read/write helpers.
  - [ ] Add state initialization for first attempt.
  - [ ] Reuse reserved version when state is `in_progress` or `failed`.
  - [ ] Persist per-channel result statuses and last error.

- [ ] Integrate retry-safe execution semantics into `npm run release`.
  - [ ] Prevent bumping to a new version while prior reserved version is
    unresolved.
  - [ ] Ensure rollback keeps reserved state intact after failure.
  - [ ] Ensure skip flags still work and are reflected in state.

- [ ] Make VSIX packaging explicitly target-specific.
  - [ ] Pass `--target <target>` to `vsce package`.
  - [ ] Keep one VSIX output per target.
  - [ ] Verify target metadata in packaged VSIX output.

- [ ] Enforce required portability target set for this epic.
  - [ ] Use required targets: `darwin-arm64 linux-x64 win32-x64`.
  - [ ] Fail release if required backend artifacts/targets are missing.
  - [ ] Keep `darwin-x64` excluded for now.

- [ ] Add finalization gate and outputs.
  - [ ] Enforce clean git tree before finalize.
  - [ ] Add tracked ledger append to `releases/history.jsonl`.
  - [ ] Create local tag `release/<canonicalVersion>`.
  - [ ] Print explicit `git push origin <tag>` command.
  - [ ] Clear local state only after successful finalize.

- [ ] Update docs for new release contract.
  - [ ] Update README release section with canonical version + retry model.
  - [ ] Update release channels runbook with finalization rules.
  - [ ] Document local state file and tracked ledger responsibilities.

- [ ] Add validation coverage.
  - [ ] Dry-run tests for first-attempt reservation and retry reuse.
  - [ ] Failure/retry test path with same reserved version.
  - [ ] Finalization test for dirty tree (must block).
  - [ ] Finalization test for clean tree (ledger + tag + state clear).
