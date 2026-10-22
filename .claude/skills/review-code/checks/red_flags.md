# Red Flags Review

Scan changed code for issues that automated tools and tests won't catch.

## Check For

### Security
- Unescaped/unsanitized user input rendered into the DOM (`innerHTML`, template strings building HTML)
- Hardcoded secrets, tokens, or API keys
- URL params or query strings used directly without validation
- Third-party scripts/resources loaded without integrity checks

### Performance
- Expensive work (layout thrashing, large loops, heavy recomputation) inside render/animation loops
- Missing `requestAnimationFrame`/debounce on frequent events (scroll, resize, pointer move)
- Unbounded growth of in-memory collections (event listeners never removed, arrays that only grow)
- Re-fetching or re-computing data that could be cached/memoized

### Logic
- Nil-safety issues (missing optional chaining where needed)
- Wrong method calls / typos
- Missing required arguments
- Conditional logic that doesn't cover all cases (e.g. encounter state machine missing a branch)

## Warning Signs
- `innerHTML =` built from untrusted or user-controlled strings
- Event listeners added without a corresponding removal (leak on re-render/navigation)
- `JSON.parse` on external/stored data without a try/catch
- Silent `catch` blocks that swallow errors

## Evaluate
- Trace data from entry to exit through changed code
- Check every place user input or external data enters the system
- Verify external calls (fetch, storage) have error handling

## Socratic Questions
- "What happens if this input is manipulated by a user?"
- "How does this perform with a large encounter dataset or long session?"
- "What if this external resource/fetch fails or is slow?"
