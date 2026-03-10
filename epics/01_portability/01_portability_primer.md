# Epic 01: Portability

## Problem

Current releases can succeed partially (for example one channel/target publishes
while another fails), which creates version drift and unclear recovery steps.
Also, VSIX portability expectations across Linux/Windows/macOS need stronger
target guarantees.

## Goals

- Keep a single canonical release version and derive Python/VS Code versions
  from it.
- Ensure failed releases retry the same reserved version until all required
  channels are green.
- Improve cross-platform VSIX portability by packaging target-specific builds.
- Make release completion auditable via tag + tracked release ledger.

## Non-Goals

- Add `darwin-x64` to required publish targets in this epic.
- Redesign core CLI orchestration/runtime behavior.
- Introduce Apple paid signing/notarization requirements.

## Constraints

- Preserve existing release entrypoints (`npm run release`, `release:dry`).
- Keep Python/VS Code publish skip flags supported.
- Work with current prerelease lock defaults.

## Risks

- State machine bugs could deadlock release flow.
- Target-specific packaging changes may alter Marketplace behavior unexpectedly.
- Strict clean-tree finalization gate may block users if workflow docs are
  unclear.

## Success Criteria

- Full release retries reuse the same reserved canonical version after failures.
- No version drift between Python and VS Code for a finalized release.
- VSIX packaging is explicitly target-specific for required targets.
- On successful finalize, local state clears, a release tag is created, and a
  tracked ledger entry is appended.
