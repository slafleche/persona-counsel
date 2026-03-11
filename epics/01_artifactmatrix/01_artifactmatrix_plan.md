# Epic 01: Artifact Matrix Plan

## Exit criteria

- [ ] CI can build all in-scope backend targets in one workflow run.
- [ ] CI release job can publish synchronized prerelease end-to-end.
- [ ] Release tracking commit + tag are pushed automatically on success.
- [ ] Resume behavior works after partial failure without version drift.
- [ ] CI release is idempotent for already-published target versions.

## Phase 1: Workflow skeleton

- [ ] Define branch/trigger policy for prerelease vs stable pipelines.
- [ ] Create GitHub Actions workflow for matrix backend build.
- [ ] Upload each target artifact with normalized naming.
- [ ] Add release job that downloads all artifacts and reconstructs expected layout.
- [ ] Add workflow concurrency group to prevent overlapping release runs.
- [ ] Add dry-run CI workflow mode that builds/downloads/verifies without publishing.

## Phase 2: Non-interactive release execution

- [ ] Add non-interactive mode to release script (CI-safe defaults, no prompts).
- [ ] Ensure release script can run fully from downloaded artifact layout.
- [ ] Ensure matrix preflight is strict in CI mode.
- [ ] Add idempotency precheck for existing published versions (PyPI + Marketplace).
- [ ] Add reconcile command/path to recover from externally published versions.

## Phase 3: Publish and verify in CI

- [ ] Configure CI secrets for VS Code Marketplace + (Test)PyPI.
- [ ] Add fail-fast CI secret validation before build/publish steps.
- [ ] Run publish path in CI job.
- [ ] Run post-release verification in CI job.
- [ ] Validate artifact integrity (SHA256) before VSIX packaging/publish.

## Phase 4: Finalization

- [ ] Ensure `releases/history.jsonl` and `releases/latest.json` are updated in CI.
- [ ] Ensure commit + push + tag push happen only after verify success.
- [ ] Restrict release commit scope to release-tracking files only (no broad `git add -A`).
- [ ] Add explicit failure behavior to preserve resume state.
- [ ] Publish CI release summary artifact (versions, channels, URLs, commit, tag).

## Phase 5: Guardrails and docs

- [ ] Document operator flow (how to trigger prerelease vs stable).
- [ ] Document rollback/resume procedure.
- [ ] Document partial-publish roll-forward runbook with explicit commands.
- [ ] Keep local release command positioned as preflight/dev tool.
