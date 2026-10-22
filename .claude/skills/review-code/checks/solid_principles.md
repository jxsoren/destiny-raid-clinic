# SOLID Principles Review

## Check For
- **S**: Module/class/function doing too many things? Multiple reasons to change?
- **O**: Must modify existing code to add new behavior? Missing extension point (strategy/config)?
- **L**: Subtype/variant breaks the base contract? Unexpected behavior when substituted (e.g. a trainer encounter module that doesn't honor the shared interface other encounters use)?
- **I**: Forced to depend on methods/props not used? Fat interface or prop object?
- **D**: Hardcoded concrete imports where an interface/callback would decouple? High-level UI code reaching into low-level data/DOM details directly?

## Common Violations in JS/TS Browser Apps
- God modules/components with many unrelated responsibilities (state, rendering, data fetching, DOM manipulation all mixed)
- Components that know too much about siblings or the global app shell
- Utility files that accumulate unrelated helpers over time ("misc.js" grab bags)
- Direct DOM manipulation scattered through business logic instead of isolated in a render layer

## Socratic Questions
- "If requirement X changes, how many files need updating?"
- "Could this module be split by the reasons it might change?"
