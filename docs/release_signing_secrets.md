# Release Signing Secrets Contract

This document defines the required secrets/env vars for macOS signing and
notarization in persona-counsel release flows.

## Scope

- Applies to backend binary signing/notarization for bundled VS Code extension
  artifacts.
- Stable release mode requires signing/notarization configuration.
- Pre-release lock mode remains permissive when secrets are not configured.

## Required Variables

### `APPLE_CODESIGN_IDENTITY`

- Purpose: certificate identity used by `codesign`.
- Used by: `scripts/sign_macos_backend.sh`
- CI wiring: `.github/workflows/ci.yml` (macOS build/package jobs)
- Example value:
  - `Developer ID Application: Your Name (TEAMID1234)`

### `APPLE_NOTARY_KEYCHAIN_PROFILE`

- Purpose: keychain profile name consumed by `xcrun notarytool`.
- Used by: `scripts/notarize_macos_backend.sh`
- CI wiring: `.github/workflows/ci.yml` (macOS build/package jobs)
- Example value:
  - `AC_NOTARY_PROFILE`

## CI Setup (GitHub Actions)

Add repository or environment secrets:

- `APPLE_CODESIGN_IDENTITY`
- `APPLE_NOTARY_KEYCHAIN_PROFILE`

These are optional for alpha/pre-release lock mode, but required for stable
mode guardrails.

## Local Setup (optional)

For local testing of signing/notarization scripts:

```bash
export APPLE_CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID1234)"
export APPLE_NOTARY_KEYCHAIN_PROFILE="AC_NOTARY_PROFILE"
```

## Behavior Matrix

- Pre-release lock mode (`ALLOW_STABLE_RELEASE=false`):
  - Missing secrets: signing/notarization steps skip.
  - Present secrets: signing/notarization steps run.

- Stable mode (`ALLOW_STABLE_RELEASE=true`):
  - Missing required vars: release script fails before publishing.
  - Required vars present: release can proceed.
