# Refactor Artifacts Review

## Check For
- Dead code (unused functions, unreachable branches)
- Orphaned files (created then never imported/used)
- Leftover TODOs or FIXMEs
- Commented-out code
- Unused imports/exports
- Backwards-compatibility shims no longer needed

## Warning Signs
- Function only called from code that was deleted in this same diff
- New file not imported anywhere
- `_unused` prefix variables
- Empty catch blocks
- Conditionals that always evaluate the same way given current call sites

## How to Find
- Search for functions/exports, check call sites (`grep`/Grep)
- Grep for TODO/FIXME/HACK in changed files
- Check the diff for removals that left orphaned helpers behind

## Socratic Questions
- "This function has no callers - should it exist?"
- "Is this TODO still relevant or should it be removed?"
- "This file was created but never imported - intentional?"
