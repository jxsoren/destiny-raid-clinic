# Review Report Format

## Output Location
`.claude/docs/plans/active/{slug}/{slug}-review.md`

If running outside a plan/feature context (no slug), present the report inline.

## Principles
- **Capture everything.** This file is the permanent record of the review. Every finding from every subagent goes in — no filtering, no deduplication, no "omit if empty."
- **Mark empty checks.** If a check found nothing, include it with "No issues found" so the reader knows it ran.
- **Preserve source.** Each finding notes which check produced it.

## Structure

```markdown
# Code Review: {feature name}

**Date:** YYYY-MM-DD
**Files reviewed:** [count]
**Checks run:** 9/9

## Summary
[1-2 sentences: overall assessment, ready to merge or not]

---

## Must Fix
[Blocking issues that must be resolved before merge]

- **Issue title** (`check: {check_name}`) - `file:line`
  - What's wrong
  - Why it matters

## Should Discuss
[Design decisions and tradeoffs worth exploring]

- **Topic title** (`check: {check_name}`)
  - The decision made
  - Question to consider

## Consider
[Minor observations, style preferences, future improvements]

- **Item** (`check: {check_name}`) - `file:line` - brief note

---

## Raw Findings by Check

### Requirements Alignment
[All findings from this check, or "No issues found"]

### SOLID Principles
[All findings from this check, or "No issues found"]

### Codebase Consistency
[All findings from this check, or "No issues found"]

### Over-Engineering
[All findings from this check, or "No issues found"]

### Under-Engineering
[All findings from this check, or "No issues found"]

### Test Coverage Gaps
[All findings from this check, or "No issues found"]

### Refactor Artifacts
[All findings from this check, or "No issues found"]

### Red Flags
[All findings from this check, or "No issues found"]

### Data & Perf Scale
[All findings from this check, or "No issues found"]

---

## Discussion Topics
[Numbered list from Should Discuss, with recommendation for where to start]
```

## Empty Report
If no issues found across all checks:
```markdown
# Code Review: {feature name}

**Date:** YYYY-MM-DD
**Files reviewed:** [count]
**Checks run:** 9/9

## Summary
Code is ready for PR. No blocking issues or design concerns found.

## Raw Findings by Check

### Requirements Alignment
No issues found.

### SOLID Principles
No issues found.

### Codebase Consistency
No issues found.

### Over-Engineering
No issues found.

### Under-Engineering
No issues found.

### Test Coverage Gaps
No issues found.

### Refactor Artifacts
No issues found.

### Red Flags
No issues found.

### Data & Perf Scale
No issues found.
```
