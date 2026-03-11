# Epic 01: Artifact Matrix Implementation

## Target architecture

### 1) Build stage (matrix jobs)

For each target (`darwin-arm64`, `linux-x64`, `win32-x64`):

- build backend binary with existing scripts/toolchain
- publish artifact to workflow artifacts with canonical target folder layout:
  - `build/vscode-backend-artifacts/<target>/counsel(.exe)`

### 2) Release stage (single orchestrator job)

- download all matrix artifacts
- assemble `build/vscode-backend-artifacts/`
- run release orchestration in CI (non-interactive mode)
- publish channels (Python + VS Code)
- run post-release verification
- write tracking files and tag
- push commit/tag back to repo

### 3) Recovery model

- keep `.release-state.local.json` semantics, but CI-owned for release runs
- if failure after partial publish, rerun pipeline in resume mode
- do not bump version until previous canonical version is complete/finalized

## CI responsibilities vs local responsibilities

### Local (`npm run release`)

- preflight/debug usage
- optional local single-target smoke workflow
- never assumed to produce full matrix for official release

### CI (official release)

- source of truth for full matrix release
- artifact build + publish + verification + finalize

## Security and secrets

Required CI secrets:

- `VSCE_PAT`
- `TWINE_USERNAME`
- `TWINE_PASSWORD` (or equivalent token handling)

Optional:

- signing/notarization secrets for stable release phase (future stage)

## Operator prerequisites (when CI release jobs are enabled)

- Add repository secrets in GitHub Actions:
  - `VSCE_PAT`
  - `TWINE_USERNAME` (typically `__token__`)
  - `TWINE_PASSWORD`
- Optional split by channel (recommended):
  - `TWINE_PASSWORD_TESTPYPI`
  - `TWINE_PASSWORD_PYPI`
- No additional personal GitHub token is required for this epic by default.
  - Use workflow `GITHUB_TOKEN` with `contents: write` for release tracking commit/tag push.
