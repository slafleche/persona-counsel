# Agent Instructions for `epics`

This directory contains epic-level planning documents for `persona-counsel`.
These files are the main input/output for planning and implementation alignment.

## Folder Structure

- Must: Place each epic in its own folder: `epics/<epic-id>/`
- Must: Prefix epic files with the epic id:
  - `<epic-id>_primer.md`
  - `<epic-id>_implementation.md`
  - `<epic-id>_plan.md`
- May: Add optional files when needed:
  - `<epic-id>_notes.md`
  - `stories/<epic-id>.story.<story-name>.md`
  - `success/<epic-id>.<success-name>.success.md`

## File Roles

- `<epic-id>_primer.md`
  - Problem, goals, constraints, risks, success criteria.
  - No implementation-level details.
- `<epic-id>_implementation.md`
  - Technical approach, key decisions, data shapes, tradeoffs.
  - No direct code edits in this file.
- `<epic-id>_plan.md`
  - Actionable implementation slices as a checklist.
  - Keep tasks small and independently reviewable.

## Task Formatting

- Must: Represent actionable tasks as Markdown checkboxes (`- [ ]`, `- [x]`).
- May: Use plain bullets for context/notes that are not tasks.
- Should: Add brief acceptance notes under each task when helpful.

## Workflow

1. Define/clarify scope in `<epic-id>_primer.md`.
2. Design approach in `<epic-id>_implementation.md`.
3. Break work into slices in `<epic-id>_plan.md`.
4. Implement against plan items and update progress in the plan file.

## Change Discipline

- Must: Treat existing code/docs as current behavior, not necessarily target
  behavior during planning.
- Should: Explicitly call out mismatches between current behavior and planned
  behavior before implementation begins.
- Must: Avoid silently broadening epic scope; split new scope into a separate
  epic when needed.
- Must: Before editing any file, reload/re-read it from disk to ensure changes
  are based on the latest version.
