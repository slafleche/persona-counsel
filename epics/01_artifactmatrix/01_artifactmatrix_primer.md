# Epic 01: Artifact Matrix Release Pipeline

## Why this epic exists

Local `npm run release` cannot reliably produce all required VS Code backend artifacts for:

- `darwin-arm64`
- `linux-x64`
- `win32-x64`

That creates release friction and false starts.

This epic moves release execution to CI so matrix artifacts are built where they belong, then published/verified/tagged in one deterministic pipeline.

## Goal

A single, repeatable release workflow where:

1. CI builds all required artifacts.
2. CI publishes Python + VS Code extension.
3. CI runs post-release verification.
4. CI records release state in-repo (`releases/history.jsonl`, `releases/latest.json`) and tags.

## Non-goals

- Supporting out-of-scope targets (for now).
- Reworking product features or CLI domain logic.
- Replacing existing release state model (we reuse and adapt it).

## Constraints

- Keep prerelease lock behavior.
- Keep synchronized canonical version model.
- Keep clean-repo and explicit guardrails.
