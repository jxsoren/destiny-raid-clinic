---
name: review-code
description: "Human-style code review for PR readiness. Checks things automated tools can't catch: SOLID violations, over/under-engineering, consistency with codebase patterns, data/perf scale issues. Use when code is ready for review."

use_when:
  - "code is ready for review or pull request"
  - "user says 'review', 'ready for PR', 'check my code', 'is this good?'"
  - "at a Review checkpoint during plan execution"
  - "after implementation to check architectural soundness"
not_for:
  - "fixing linter/formatter violations (use biome/existing lint scripts)"
  - "plan validation (handled by writing-plans)"
  - "GitHub issue pipeline orchestration (use analyze-issue / develop-issue / work-issue)"

outputs: "complete review file at .claude/docs/plans/active/{slug}/{slug}-review.md with ALL findings from every check, or inline if no slug context"

see_also:
  - name: work-issue
    when: "running the full issue-to-PR pipeline; review-code can be used as a step before finishing it"
  - name: writing-plans
    when: "validating a plan document structure before execution"
---

# Review Code

Human-style code review focused on architectural and design quality. Focus: **What would a senior reviewer question or reject?**

**This skill performs conceptual review, not tool execution.** It checks for things automated tools can't catch: architectural issues, over-engineering, missing edge cases, codebase inconsistencies, and scale/performance problems.

**Announce at start:** "I'm using the review-code skill to run a human-style architectural review."

## Phase 1: Generate Report

### 1. Load Review Integrity
Read: `support/review_integrity.md`

### 2. Identify Changed Files
```bash
git diff --name-only origin/main...HEAD
```
If there's no upstream `origin/main` (e.g. local-only branch), fall back to:
```bash
git diff --name-only main...HEAD
```

### 3. Dispatch Parallel Review Checks

Launch **all checks in parallel** using a single message with multiple Agent tool calls (`subagent_type: "Explore"`). Each gets the list of changed files and its review module content.

| Check | Module | Focus |
|-------|--------|-------|
| Requirements Alignment | `checks/requirements_alignment.md` | Does code do what was asked? |
| SOLID Principles | `checks/solid_principles.md` | SRP, OCP, DIP violations |
| Codebase Consistency | `checks/codebase_consistency.md` | Matches existing patterns? |
| Over-Engineering | `checks/over_engineering.md` | Unnecessary abstractions? |
| Under-Engineering | `checks/under_engineering.md` | Missing error handling, edge cases? |
| Test Coverage Gaps | `checks/test_coverage_gaps.md` | Untested paths? |
| Refactor Artifacts | `checks/refactor_artifacts.md` | Dead code, leftover TODOs? |
| Red Flags | `checks/red_flags.md` | Security, performance, logic issues? |
| Data & Perf Scale | `checks/data_scale.md` | Work that should be batched/streamed/indexed? Will it survive real input sizes? |

For each, use the Agent tool with `subagent_type: "Explore"`:
```
Prompt: "Review these changed files for {check} issues: {files}.
Read the review module at .claude/skills/review-code/checks/{module}.
Return findings as: file:line - issue - severity (must_fix/should_discuss/consider)"
```

### 4. Compile Findings
- Collect results from **all** subagents — include every finding, no filtering or deduplication
- Categorize by severity: **Must Fix** / **Should Discuss** / **Consider**
- Preserve which check each finding came from

### 5. Write Report
Follow format in `support/report_format.md`.

**Output location:** If a plan/feature slug exists under `.claude/docs/plans/active/{slug}/`, write to `.claude/docs/plans/active/{slug}/{slug}-review.md`. Otherwise present the report inline in the conversation.

**Capture everything.** The review file is the permanent record. Include all findings from every subagent — even duplicates across checks and minor items. Do not omit empty categories; mark them "No issues found" so the reader knows the check ran.

## Phase 2: Discussion

Present discussion topics with recommendations:
```
## Discussion Topics
1. [Topic from Should Discuss]
2. [Topic from Should Discuss]

**Recommended first:** #X - [why]

Which to explore? (or "done")
```

For each topic: ask a Socratic question, wait for response. Don't prescribe — help the developer think through the tradeoff.

## Success Criteria
- All 9 review checks dispatched in parallel
- Findings compiled with file:line references
- Report categorized by severity
- User addressed or acknowledged discussion items
