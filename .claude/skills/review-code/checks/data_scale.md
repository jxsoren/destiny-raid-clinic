# Data & Perf Scale Review

Catch code that works fine with a handful of test records/elements but will struggle under real usage — large encounter datasets, long sessions, many DOM nodes, or frequent re-renders.

## Check For

### Inefficient collection work
- `.map`/`.filter`/`.reduce` chains re-run on every frame or every event instead of once/cached
- Repeated linear scans (`.find`, `.indexOf`) over large arrays in a hot path — could use a `Map`/`Set` for lookup
- Building up arrays/objects inside a loop that itself runs inside another loop (accidental O(n²))

### Memory-loading / leak patterns
- Event listeners, intervals, or `requestAnimationFrame` loops started but never cleaned up on teardown/navigation
- Large data structures (full encounter state history, logs) kept forever instead of capped or pruned
- DOM nodes created per update without removing the old ones (accumulating orphaned nodes)

### Hidden repeated work
- Looping over elements and querying the DOM (`querySelector`) per iteration — should query once and reuse
- Recomputing the same derived value on every render instead of memoizing
- Fetching the same static data repeatedly instead of caching it

### Batch/streaming gaps
- Code that assumes "a few items" without a plan for a larger set the data model allows
- Processing an entire dataset synchronously in one tick when chunking/yielding would keep the UI responsive

## Warning Signs
- `document.querySelectorAll` or `querySelector` called inside a loop
- `addEventListener` with no matching `removeEventListener` on cleanup
- Nested loops over the same or related collections
- State that only grows (arrays pushed to, never trimmed) across a long-running session

## Evaluate
- For each hot-path function: what's the realistic upper bound on input size (number of raid participants, encounter ticks, log entries)?
- Trace whether a simple-looking function triggers cascading DOM queries or recomputation
- Check whether listeners/timers set up on mount have a matching teardown

## Socratic Questions
- "This recomputes on every frame — what's the realistic frequency, and could it be cached?"
- "This queries the DOM per iteration — could it query once and reuse the reference?"
- "Does this listener/interval get cleaned up, or does it accumulate across re-renders?"
