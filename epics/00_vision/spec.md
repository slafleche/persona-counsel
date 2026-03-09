# persona-counsel Spec (v1 Direction)

## Product Positioning

persona-counsel is a **standalone Python CLI product** first.

- Primary mode: terminal-only usage.
- Future mode: VS Code extension as a thin client on top of the same CLI.
- No UI implementation in v1.

## Core Principles

- CLI-first and editor-agnostic.
- Deterministic orchestration (orchestrator is regular code, not LLM).
- Config-driven personas and counsels on disk.
- Human-readable markdown session traces.
- Extensible toward VS Code without changing core runtime behavior.

## Runtime Stack (v1)

- Python
- Typer (CLI)
- LiteLLM (provider abstraction)
- Pydantic (config validation)
- PyYAML (config loading)
- In-memory sequential queue (no Redis/Celery in v1)

Langfuse is planned for v2; architecture should stay observability-ready.

## CLI Product Requirement (Critical)

The CLI must be independently usable and publishable as its own product.

This means:

- A user can install and use persona-counsel with no VS Code extension.
- All core workflows are available through terminal commands.
- Extension integration is optional and additive, never required.

## VS Code Readiness from Day 1

Even without building UI now, the CLI must be ready for later VS Code
integration.

Required design choices:

- Headless command execution support (non-interactive mode).
- Machine-readable outputs (`--json`) for extension parsing.
- Stable command contracts and exit codes.
- Environment/dependency diagnostics command.

## Dependency and Environment Strategy

Dependency setup should be explicit and safe.

- Provide a `counsel setup` command to install/check runtime prerequisites.
- Provide a `counsel doctor --json` command to report health status:
  - Python/version checks
  - package/runtime checks
  - env var checks
  - clear remediation commands

Normal runtime commands should not silently mutate user environments.

## Proposed v1 Command Surface

- `counsel setup`
- `counsel doctor [--json]`
- `counsel list`
- `counsel summon <counsel-name>`
- `counsel run ... [--json]`

Interactive REPL remains CLI-based; JSON mode supports automation and future
extension transport.

## Config Model (v1)

Two levels:

- `personas/` (reusable persona definitions)
- `counsels/` (teams referencing personas + optional overrides)

Validation is mandatory at load time via Pydantic.

## Distribution

Target: publish on PyPI as installable CLI.

Recommended user install path:

- `pipx install persona-counsel`

## Non-Goals for v1

- Building VS Code UI.
- Distributed queueing/persistence (Redis/Celery).
- Complex permission model or per-persona filesystem sandboxing.
- Full production observability rollout.

## Success Criteria

- A user can install the CLI and run a counsel entirely from terminal.
- Intent -> interpreter -> deterministic orchestrator -> persona sequence works.
- Session markdown trace is written to disk.
- `doctor` and `setup` make environment readiness clear for both terminal users
  and future VS Code integration.
