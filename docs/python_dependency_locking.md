# Python Dependency Locking

This project uses a pinned runtime lock file for reproducible installs in CI
and release-adjacent scripts.

## Approach

- Source-of-truth inputs: `requirements/runtime.in`
- Resolved pins: `requirements/runtime.lock`
- Lock generation is done via isolated virtual environment + `pip freeze`
  (no additional lock tooling dependency required).

Rationale:

- Keeps the runtime stack deterministic enough for CI/release validation.
- Avoids introducing additional dependency management tooling right now.

## Files

- `requirements/runtime.in`: human-maintained top-level runtime dependencies
- `requirements/runtime.lock`: generated pinned dependency set

## Refresh Command

```bash
./scripts/refresh_runtime_lock.sh
```

## Validation Command

```bash
./scripts/validate_runtime_lock.sh
```

## Cadence

- Refresh lock at least monthly.
- Refresh lock after intentional dependency updates.
- Refresh lock immediately if security advisories require upgrades.
