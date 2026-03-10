# Epic 01: Portability Implementation

## Core Approach

Implement a release state machine with a canonical version source and explicit
finalization rules:

- Canonical version format: `MAJOR.MINOR.PATCH-alpha.N`
- Derived versions:
  - Python: `MAJOR.MINOR.PATCHaN`
  - VS Code: `MAJOR.MINOR.N` (Marketplace-compatible prerelease pattern)

## Release State

Use an untracked local state file:

- `.release-state.local.json` (gitignored)

State fields:

- `canonicalVersion`
- `pythonVersion`
- `vscodeVersion`
- `status` (`in_progress`, `failed`, `complete`)
- `channels`:
  - `python`
  - `vscode_darwin_arm64`
  - `vscode_linux_x64`
  - `vscode_win32_x64`
- `lastError`
- `updatedAt`

Semantics:

- If active state exists (`in_progress`/`failed`), release reuses reserved
  versions.
- No new version bump while active state is unresolved.

## Packaging / Portability

Make VSIX packages explicitly target-specific:

- Use `vsce package --target <platform-arch>` per selected target.
- Keep strict matrix validation as release guardrail.
- Required targets for this epic:
  - `darwin-arm64`
  - `linux-x64`
  - `win32-x64`

`darwin-x64` remains out of scope for now.

## Finalization Contract

Finalize only if required channels for the run mode are successful.

Run modes:

- Full: Python + all required VSIX targets.
- VS Code-only: all required VSIX targets.
- Python-only: Python only.

Finalization gate:

- Working tree must be clean (no staged/unstaged changes).
- If dirty: fail finalize, keep local state for retry.

Finalize actions:

- Append tracked entry to `releases/history.jsonl`.
- Create local git tag `release/<canonicalVersion>`.
- Print manual push command for tag.
- Clear local `.release-state.local.json`.

## Audit Artifacts

- Tracked ledger: `releases/history.jsonl` (one entry per successful finalized
  release).
- Tag format: `release/<canonicalVersion>`.

## Error Handling

- Preserve existing rollback of local version file edits on release failure.
- Do not clear release state on partial failures.
- Keep retry path deterministic (same reserved version).

## Backward Compatibility

- Keep existing release commands and env flags.
- Preserve `RUN_POST_RELEASE_VERIFY` behavior (with current VS Code-first check
  semantics).
