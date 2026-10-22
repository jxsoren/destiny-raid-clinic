# Test Coverage Gaps Review

## Check For
- Untested exported functions/modules
- Missing edge case tests (null/undefined, empty array, boundary values)
- Tests that don't actually verify behavior (weak assertions)
- Happy path only (no error/failure case tests)
- Logic that changes rendered/DOM output but is only covered indirectly, if at all

## Warning Signs
- Assertions that just check truthiness instead of an exact expected value
- No tests for conditional branches
- Mocks/stubs that hide the real behavior being tested
- Test describes what the code does, not what it should do
- Several `test()`/`it()` blocks that just re-run the same setup and each check one unrelated property of the result — could be one test with multiple assertions, or independent unit tests of the underlying function instead

## Evaluate
- Map each exported function/module to its tests under `prototype/**/*.test.mjs` or `scripts/*.test.mjs`
- Check each branch/condition has a test
- Verify assertions are specific (exact value, not just "is truthy")

## Socratic Questions
- "What test fails if this logic breaks?"
- "This branch isn't tested - is it dead code?"
- "What behavior does this assertion actually verify?"
