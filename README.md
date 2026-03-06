# persona-counsel

Multi-agent CLI + VS Code plugin tool.

## npm namespace placeholders

This repo now includes placeholder npm packages so these names can be
reserved/published early:

- `persona-counsel`
- `counsel-cli`
- `@persona-counsel/*` (via `@persona-counsel/core`)


## Reserve the names on npm

Use the release script (from repo root):

```bash
npm run release:dry
npm run release
```

The release script:

- verifies `npm whoami` (you are logged in)
- confirms all package versions are aligned
- asks for confirmation, then publishes:
  - `persona-counsel`
  - `counsel-cli`
  - `@persona-counsel/core`

Direct `npm publish` inside package folders is intentionally blocked by
`prepublishOnly` guards.
