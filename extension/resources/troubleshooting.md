# Persona Counsel Troubleshooting

This guide covers the most common extension issues and quick recovery steps.

## Install and Baseline

1. Run `Persona Counsel: Open Terminal`.
2. Confirm `counsel --help` works in the terminal.
3. Run `Persona Counsel: Setup`.
4. Run `Persona Counsel: Doctor`.

If these four checks pass, your local setup is healthy.

## Backend Not Found or Not Executable

Symptom:

- Error mentions missing bundled backend.
- Error mentions `backendPath` is invalid or not executable.

Fix:

1. Open VS Code Settings and search for `Persona Counsel`.
2. If you set `personaCounsel.backendPath`, use an absolute path to a real executable.
3. If needed, clear `personaCounsel.backendPath` and retry.
4. If using PATH fallback locally, ensure `counsel` is installed and available in your shell PATH.

## Workspace Trust Block

Symptom:

- Command says workspace is not trusted.

Fix:

1. Trust the workspace in VS Code.
2. Retry `Doctor` or `Setup`.

## Collect Diagnostics for Support

1. Run `Persona Counsel: Export Diagnostics`.
2. Attach the generated JSON file when reporting an issue.
3. Include command used and expected behavior.

## Recovery Sequence

If things feel inconsistent, run in this order:

1. `Persona Counsel: Show Output`
2. `Persona Counsel: Doctor`
3. `Persona Counsel: Setup`
4. `Persona Counsel: Export Diagnostics`

This sequence usually provides enough signal to identify path, trust, or backend packaging issues.
