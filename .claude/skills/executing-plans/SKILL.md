---
name: executing-plans
description: >
  Executes an APPROVED plan from .claude/docs/plans/active/, completing tasks in
  order with per-task checks, review checkpoints, and blocker escalation.

use_when:
  - "an APPROVED plan exists and implementation should begin"
  - "develop-issue has finished plan writing and needs controlled execution"
not_for:
  - "writing or approving plans (use /writing-plans)"
  - "starting issue analysis/branch setup (use /analyze-issue and /develop-issue)"

outputs: "implemented changes, checked tasks marked complete in the plan, and clear pause/escalation at checkpoints or blockers"

see_also:
  - name: /writing-plans
    when: "creates the plan consumed by this skill"
  - name: /develop-issue
    when: "invokes this skill inside the issue-development flow"
  - name: /review-code
    when: "run after implementation for architectural review"
---

# Executing Plans

Executes an approved implementation plan without skipping safeguards.

**Announce at start:** "I'm using the executing-plans skill."

## Inputs

- Required: plan file path under `.claude/docs/plans/active/<feature-slug>/`
- Required status in plan: `Status: APPROVED`

If status is missing or not APPROVED, stop and report:
> "Plan is not APPROVED. Return to /writing-plans and get explicit approval first."

## Step 1 — Preflight

1. Confirm clean working tree before implementation.
2. Read plan sections in full:
   - Goal
   - Reference Files
   - Non-goals / Constraints
   - Task Checklist
   - Review Checkpoints
3. Follow the existing worktree/branch created by `/develop-issue`; do not create a new branch.

## Step 2 — Execute tasks in order

For each unchecked task from top to bottom:
1. Implement only what the task describes.
2. Run the task's listed check command(s) (tests/lint/manual checks already used by the repo).
3. If checks pass:
   - mark task `[x]` in the plan file
   - proceed to next task
4. If checks fail:
   - fix the task-scoped issue and re-run checks
   - if unresolved after reasonable attempts, treat as blocker (Step 4)

Do not reorder tasks unless the user approves a plan update first.

## Step 3 — Pause at review checkpoints

When a checkpoint task is reached:
1. Stop implementation.
2. Summarize completed tasks and check results.
3. Ask user whether to continue.
4. Resume only after explicit user confirmation.

## Step 4 — Blocker protocol

If blocked by missing requirements, missing access, unclear behavior, or repeated check failures:
1. Stop immediately.
2. Report exactly what is blocked, what was tried, and relevant logs/errors.
3. Ask for user direction.

Never silently work around blockers and never guess through unresolved requirements.

## Step 5 — Completion

When all tasks are `[x]` and checks pass:
1. Verify implemented changes still match plan Goal and constraints.
2. Keep commits focused and consistent with repository conventions:
   - no unrelated files
   - no generated runtime artifacts
   - clear issue-scoped commit messages
3. Hand off to `/review-code` or the parent flow (`/develop-issue`) for final review/reporting.

## Guardrails

- Execute only from an APPROVED plan.
- Run each task's checks before marking it complete.
- Preserve task order and checkpoint pauses.
- Stop on blockers; escalate to user instead of inventing scope changes.
- Keep worktree and commit hygiene aligned with `/develop-issue`.
