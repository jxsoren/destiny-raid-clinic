# Over-Engineering Review

## Check For
- Abstractions with only one implementation/caller
- Config/options for behavior that won't vary
- Class/module hierarchies deeper than needed
- Patterns applied without clear benefit (a factory/strategy for 2 cases)
- "Future-proofing" that adds complexity now for a use case that doesn't exist yet

## Warning Signs
- Module exists just to be extended "later"
- Function accepts an options object but only one combination is ever used
- Helper extracted from a single use case
- Comments explaining "flexibility" or "extensibility" with no second caller

## Evaluate
- Count usages of each abstraction
- If only 1: question whether the abstraction earns its keep

## Socratic Questions
- "What's the second use case for this abstraction?"
- "Could this be simpler if we just inlined it?"
