# persona-counsel

`persona-counsel` is a Python CLI-first orchestration project for running a
team of AI personas (a "counsel") in a deterministic workflow.

The core idea:

- terminal-first product
- config-driven personas and counsels
- deterministic orchestrator (no hidden LLM control flow)
- future VS Code UX as a thin client on top of the same backend

## Current Status

This repo is in foundation stage.

Implemented now:

- Python CLI package (`counsel`)
- `counsel setup`
- `counsel doctor` and `counsel doctor --json`
- VS Code extension shell that calls backend CLI
- backend bundling and `.vsix` packaging scripts
- release/validation scripts and CI workflow scaffolding

Not implemented yet:

- full multi-persona orchestration loop
- interpreter persona flow
- persona/counsel config loading and execution

## Why This Project

Most agent projects are either IDE-bound or nondeterministic to debug at scale.
persona-counsel is aiming for a simpler contract:

- standalone CLI is the product
- editor integrations are optional clients
- runtime behavior is explicit, inspectable, and scriptable

## Quickstart (CLI)

```bash
python3.11 -m pip install -e .
counsel setup
counsel doctor --json
```

Sanity check:

```bash
which counsel
counsel --help
```

## VS Code Backend Packaging

Build backend artifact for current platform:

```bash
./scripts/build_vscode_backend.sh
```

Package extensions (per target):

```bash
./scripts/package_vscode_extension.sh
```

This emits one `.vsix` per target, for example:

- `extension/persona-counsel-vscode-darwin-arm64.vsix`
- `extension/persona-counsel-vscode-linux-x64.vsix`

Strict matrix-gated packaging:

```bash
STRICT_MATRIX=1 ./scripts/package_vscode_extension.sh
```

Release flow helper:

```bash
./scripts/release_vscode_extension.sh
```

Full publish orchestrator (Python package + VS Code Marketplace):

```bash
npm run release:dry
npm run release
```

Notes:

- Python upload target defaults to `pypi`; set `PYTHON_REPOSITORY=testpypi` for TestPyPI.
- VS Code publish requires `VSCE_PAT` in environment.
- You can skip either channel with:
  - `SKIP_PYTHON_PUBLISH=1`
  - `SKIP_VSCODE_PUBLISH=1`

Custom CI target set example:

```bash
REQUIRED_TARGETS="darwin-arm64 linux-x64" ./scripts/release_vscode_extension.sh
```

Package only selected target outputs:

```bash
PACKAGE_TARGETS="darwin-arm64 linux-x64" ./scripts/package_vscode_extension.sh
```

## Validation

Run local backend validation:

```bash
./scripts/validate_local_cli.sh
```

## Docs

- Vision/spec: `epics/00_vision/spec.md`
- Tech stack v1: `epics/00_vision/persona-counsel-tech-stack_v1.md`
- VS Code backend contract: `vscode/BACKEND.md`
- Extension verification runbook: `docs/extension-verification.md`
- Release checklist: `docs/release-readiness-checklist.md`
