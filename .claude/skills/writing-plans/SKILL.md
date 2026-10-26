---
name: writing-plans
description: >
  Converts ISSUE_ANALYSIS.md into an implementation plan in
  .claude/docs/plans/active/<feature-slug>/YYYY-MM-DD-<feature-slug>.md,
  then iterates with the user until the plan is explicitly approved.

use_when:
  - "develop-issue needs a concrete implementation plan from ISSUE_ANALYSIS.md"
  - "user asks for a scoped, checkable execution plan before coding"
not_for:
  - "executing tasks from an already approved plan (use /executing-plans)"
  - "creating issue branches or ISSUE_ANALYSIS.md (use /analyze-issue)"

outputs: "plan markdown file in .claude/docs/plans/active/<feature-slug>/ with explicit DRAFT or APPROVED status"

see_also:
  - name: /develop-issue
    when: "invokes this skill after confidence gating and worktree setup"
  - name: /executing-plans
    when: "consumes the APPROVED plan this skill finalizes"
---

# Writing Plans

Builds a concrete, reviewable implementation plan from `ISSUE_ANALYSIS.md`.

**Announce at start:** "I'm using the writing-plans skill."

## Inputs

- Required design doc input: `ISSUE_ANALYSIS.md` (repo/worktree root)

If missing, stop and report:
> "No ISSUE_ANALYSIS.md found. Run /analyze-issue (or /develop-issue Step 2) first."

## Step 1 — Read and map ISSUE_ANALYSIS.md

Extract and map:
- **Issue Summary** → Plan **Goal**
- **Affected Areas** → **Reference Files**
- **Proposed Changes** → initial **Task Checklist**
- **Open Questions** → **Non-goals / Constraints** and unanswered assumptions

If any required section is missing or too vague, keep status **DRAFT** and list what must be clarified.

## Step 2 — Compute plan location

1. Build `<feature-slug>` from the issue title/theme (lowercase, hyphenated, filesystem-safe).
2. Use today's date as `YYYY-MM-DD`.
3. Write to:
   `.claude/docs/plans/active/<feature-slug>/YYYY-MM-DD-<feature-slug>.md`
4. `mkdir -p .claude/docs/plans/active/<feature-slug>`

## Step 3 — Write the DRAFT plan

Create/update the plan with this structure:

```markdown
# <Feature title>

Status: DRAFT
Source: ISSUE_ANALYSIS.md
Issue(s): #<number>[, #<number>...]
Last Updated: YYYY-MM-DD

## Goal
<clear outcome statement>

## Reference Files
- [ ] /absolute/or/repo-relative/path: why it matters

## Non-goals / Constraints
- <what is explicitly out of scope>
- <open question or assumption that still needs confirmation>

## Task Checklist
- [ ] T1. <small, checkable task>
  - Check: <specific existing command/test/lint/manual check>
- [ ] T2. <small, checkable task>
  - Check: <specific existing command/test/lint/manual check>

## Review Checkpoints
- [ ] After <task id>, pause for user confirmation
```

Rules:
- Tasks must be actionable and verifiable.
- Every task needs at least one explicit check.
- Keep tasks ordered for sequential execution (no hidden dependencies).

## Step 4 — Approval gate (DRAFT vs APPROVED)

1. Present plan path and a concise summary of goal + tasks.
2. Ask for explicit approval (for example: "Approve this plan? (yes/no)").
3. If user does **not** explicitly agree:
   - Keep `Status: DRAFT`
   - Revise based on feedback
   - Repeat Step 4
4. Only after explicit user agreement:
   - Update `Status: APPROVED`
   - Refresh `Last Updated`
   - Return approved plan path for `/executing-plans`

Do not mark a plan APPROVED implicitly.

## Guardrails

- Never execute code changes in this skill.
- Never skip unresolved assumptions; track them under Non-goals / Constraints.
- Never invent checks that do not exist in the repository tooling.
- Keep plans inside `.claude/docs/plans/active/` only (runtime artifacts, not committed source files).
