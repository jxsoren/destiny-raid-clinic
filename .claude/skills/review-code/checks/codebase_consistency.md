# Codebase Consistency Review

## Check For
- Naming patterns (does new code match existing conventions in this repo?)
- File placement (correct directory for this type of module — e.g. encounter logic vs UI vs shared utils?)
- Function signatures (similar functions elsewhere use the same arg order/shape?)
- Error handling (matches how sibling modules handle errors/edge cases?)
- Test structure (follows existing test file organization under `prototype/**/*.test.mjs` or `scripts/*.test.mjs`?)
- Formatting/lint conventions (consistent with Biome config, `biome.json`, rather than introducing a new style)

## How to Evaluate
- Find 2-3 similar existing files
- Compare patterns: naming, structure, style
- Flag deviations without clear justification

## Common Inconsistencies
- New trainer/encounter module doesn't follow the shared structure other encounters use
- Test file placed outside the established `prototype/` or `scripts/` test layout
- Inconsistent casing or module boundaries vs. neighboring files

## Socratic Questions
- "Similar module X does this differently - intentional divergence?"
- "What existing pattern did you follow for this?"
