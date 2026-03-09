# Agent Instructions for `persona-counsel`

This file defines repo-level collaboration rules for planning and implementation.

## Epic Planning Source of Truth

- Must: Use [`epics/AGENTS.md`](epics/AGENTS.md) as the authoritative guide for
  epic structure, naming, and planning workflow in this repository.
- Must: When creating or updating epic docs, follow the conventions in
  `epics/AGENTS.md` (file prefixes, required docs, and task checklist format).
- Should: Keep implementation work tied to an explicit epic plan item whenever
  possible.

## Scope

- This root file is intentionally minimal.
- Epic-specific planning/process details live in `epics/AGENTS.md`.

## Dependency Approval Policy

- Must: Any new third-party library/dependency requires explicit user approval
  before adding it.
- Must: Do not assume a library choice is acceptable unless the user explicitly
  asks for that library or approves the proposed option first.
