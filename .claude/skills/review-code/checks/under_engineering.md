# Under-Engineering Review

## Check For
- Missing validation at system boundaries (user input, URL params, fetched data, localStorage)
- No error handling for likely failure modes (fetch failures, missing DOM elements, malformed data)
- Edge cases not covered (nil/undefined, empty arrays, duplicate entries)
- Missing guard checks before DOM operations (element may not exist yet)
- Hardcoded values that should be configurable/derived from data

## Warning Signs
- Function assumes input is always well-formed
- No try/catch (or `.catch`) around external calls (fetch, async storage)
- Boolean/conditional logic doesn't handle `null`/`undefined`
- User input flows directly into rendering or state without sanitization/validation

## Evaluate
- Trace data from entry point (user action, fetch response, URL) to where it's used
- Ask: "What if this value is null/undefined/empty?"
- Ask: "What if this fetch/async call fails or the DOM element isn't ready?"

## Socratic Questions
- "What happens if this value is undefined?"
- "How does this fail if the fetch fails or data is malformed?"
- "Who can trigger this action - is that the right guard?"
