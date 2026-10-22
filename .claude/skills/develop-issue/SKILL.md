---
name: develop-issue
description: >
  Partner to /analyze-issue. Reads ISSUE_ANALYSIS.md, gates on High confidence
  (or runs a clarification loop), sets up a git worktree, writes an
  implementation plan, and executes it. Use this whenever the user says
  'develop issue', 'implement issue', 'work on issue', 'start developing',
  'continue working on', "let's implement", or any phrase indicating they're
  ready to write code for an issue — even if they don't say 'develop-issue'
  explicitly.

use_when:
  - "/analyze-issue has already run and ISSUE_ANALYSIS.md exists on the branch"
  - "user says 'develop issue', 'implement issue', 'work on issue', 'start developing'"
  - "user wants to move from analysis into actual implementation"
not_for:
  - "first-time issue setup — run /analyze-issue first"
  - "issues without an ISSUE_ANALYSIS.md"
  - "quick one-liner fixes (just do them)"

outputs: "worktree with implemented code, plan file marked complete, Draft PR updated"

see_also:
  - name: /analyze-issue
    when: "no ISSUE_ANALYSIS.md exists yet"
  - name: /writing-plans
    when: "invoked internally to produce the implementation plan"
  - name: /executing-plans
    when: "invoked internally to execute the plan"
---

# Develop Issue

Partner command to `/analyze-issue`. Takes the committed `ISSUE_ANALYSIS.md`, validates confidence is High (or runs an interactive clarification loop until it is), then wraps `/writing-plans` → `/executing-plans` inside an isolated git worktree.

**Announce at start:** "I'm using the develop-issue skill."

---

## Step 0 — Preflight Check

```bash
git status --porcelain
```

If non-empty: **abort** and ask the user to stash or commit first.

## Step 1 — Identify the Branch

```bash
git branch --show-current
```

Ask: "You're on `<branch>`. Is this the issue you want to develop? (y/n)"

### If yes
Confirm `ISSUE_ANALYSIS.md` exists at repo root. If missing, abort:
> "No `ISSUE_ANALYSIS.md` found on this branch. Run `/analyze-issue` first."

### If no
Prompt: "Enter the issue number — e.g. `42`"

```bash
git branch -a | grep <number>
```
- One match → confirm, then `git checkout <branch-name>`
- Multiple → list and ask
- None → abort: "No branch found for issue `<number>`. Run `/analyze-issue` first."

## Step 2 — Read ISSUE_ANALYSIS.md

Read the full file. Extract:
- `## Confidence` — value (`**High**`/`**Medium**`/`**Low**`) and rationale
- `## Open Questions` — all listed questions
- Issue number(s) from the title line

**Multiple issues:** Gate on the **worst** confidence found across all sections.

## Step 3 — Confidence Gate

| Confidence | Action |
|------------|--------|
| **High**   | Skip to Step 5 |
| **Medium** | Run Step 4 |
| **Low**    | Run Step 4 |

## Step 4 — Confidence Review Loop

> Only when confidence is Medium or Low.

### 4a — Present the situation

```
Confidence is [Medium/Low]: <rationale>

Open Questions:
  1. <question>
  2. <question>
```

Ask all clarifying questions **as a single group** (not one at a time). Base questions on Open Questions plus any gaps you noticed.

### 4b — Receive user input

Wait for the response. Free-form text — do not prompt for structure.

### 4c — Update ISSUE_ANALYSIS.md

Revise: answer/remove resolved questions, update Proposed Changes if scope changed, update Confidence + rationale. Don't rewrite untouched sections.

```bash
git add ISSUE_ANALYSIS.md
git commit -m "#<number>: Update issue analysis after clarification"
```

### 4d — Re-evaluate

- **High** → Step 5
- **Still Medium/Low** → ask: "Confidence is still [level]. Keep refining, or override and proceed?"
  - Keep refining → return to 4a with remaining gaps
  - Override → Step 5 with warning: "⚠️ Proceeding with [Medium/Low] confidence. The plan will note unresolved questions."

## Step 5 — Set Up Worktree

`<branch-slug>` = current branch name with `/` → `-`.

```bash
git worktree list | grep <branch-slug>
```
If found → reuse. If not:
```bash
mkdir -p tmp/worktrees
git worktree add tmp/worktrees/<branch-slug> <branch-name>
```

## Step 6 — Write the Plan

Invoke `/writing-plans`. Pass `ISSUE_ANALYSIS.md` as the design doc input:
- **Issue Summary** → Goal
- **Affected Areas** → Reference files
- **Proposed Changes** → Task list
- **Open Questions** → Non-goals / constraints

The plan is saved to `.claude/docs/plans/active/<feature-slug>/YYYY-MM-DD-<feature-name>-plan.md`.

Wait for the plan to reach **APPROVED**. If `/writing-plans` returns **DRAFT**, surface issues and wait for resolution.

## Step 7 — Execute the Plan

Invoke `/executing-plans` with the approved plan. Follow the skill exactly:
- Pause at every Review checkpoint and wait for user feedback
- Mark tasks `[x]` as they complete
- Don't guess through blockers — stop and ask

## Step 8 — Clean Up ISSUE_ANALYSIS.md

```bash
git -C tmp/worktrees/<branch-slug> rm ISSUE_ANALYSIS.md
git -C tmp/worktrees/<branch-slug> commit -m "#<number>: Remove issue analysis after implementation"
```

## Step 8.5 — UI Fix Preview Comment

Check whether the issue touched UI: any changed file under a frontend path (e.g. components, views, pages, styles) or the `ISSUE_ANALYSIS.md` Affected Areas mentioning UI/frontend. If not a UI fix, skip to Step 9.

If it is a UI fix, first classify it:

- **Static UI fix** (layout, copy, color, spacing, a single element's appearance) → capture **screenshots**.
- **Motion/rendering fix** (animation, camera/isometric rotation, canvas/WebGL rendering, transitions, drag interactions, anything where the bug or fix is only visible over time) → capture a **screen recording**.

### 8.5a — Static UI fix: screenshots

1. Use the `run` skill (or the project's `start-dev` skill) to launch the app in the worktree and navigate to the affected screen(s).
2. Capture a screenshot of the changed UI showing the fix in effect (chrome-devtools-mcp `take_screenshot`). Capture a "before" screenshot too if feasible (e.g. base branch in a scratch checkout) — skip the before-shot if impractical and just post the after-shot with a text description.

### 8.5b — Motion/rendering fix: Playwright recording

1. Check for Playwright in the worktree: `npx --no-install playwright --version`. If missing, install it scoped to the worktree (`npm install -D playwright && npx playwright install chromium --with-deps`) — do not add it as a permanent dependency unless the user asks; it's a one-off tool for this capture.
2. Write a small throwaway script (in the scratchpad, not committed) that:
   - Launches Chromium via Playwright with `recordVideo: { dir: <scratch-dir> }`.
   - Navigates to the affected screen and drives the interaction that shows the change (e.g. triggers the rotation/animation).
   - Closes the context so the video file flushes to disk.
3. Repeat against the base branch (checked out in a scratch worktree) for a "before" clip if practical; otherwise just capture "after" and describe the prior behavior in words.
4. Convert the recorded `.webm` to a short GIF with `ffmpeg` **only if GIF is specifically wanted**; otherwise prefer posting the `.webm`/`.mp4` directly — GitHub renders both inline, video compresses better, and it skips a lossy conversion step. Keep clips short (a few seconds, trimmed to the relevant motion).
5. Delete the scratch worktree/script when done; keep only the final video file.

### 8.5c — Post it everywhere it's useful

`gh` can't attach files to the PR body or comments directly, so the file must already be reachable (e.g. uploaded via a `gh pr comment`/`gh api` asset upload flow, or dragged into the GitHub UI if doing this interactively). Once you have an embeddable URL or asset reference for the screenshot(s)/video:

1. Post a Draft PR comment showcasing the change:
   ```bash
   gh pr comment <branch-name> --body-file <comment-file>
   ```
   Comment body: a short description of what changed, plus the embedded screenshot(s) or video.
2. **Also update the PR description itself** so the preview is visible without scrolling to comments:
   ```bash
   gh pr edit <branch-name> --body-file <updated-body-file>
   ```
   Append a `## Preview` section to the existing PR body (read current body with `gh pr view <branch-name> --json body` first, don't clobber it) with the same media embedded.

If media can't be captured or embedded (no dev server, no image/asset hosting available), skip 8.5b/8.5c and note in the final report that no preview was posted.

If the dev server can't be started or the screenshot can't be captured, skip this step and note in the final report that a UI preview comment was not posted.

## Step 9 — Report

```bash
gh pr view <branch-name> --json url,title
```

```
Issue #<number> development complete (Draft PR remains open for your review).

Branch:    <branch-name>
Worktree:  tmp/worktrees/<branch-slug>
           (remove with `git worktree remove tmp/worktrees/<branch-slug>`)
Plan:      .claude/docs/plans/active/<feature-slug>/<plan-file>
Draft PR:  <url>

All tasks complete. Review the Draft PR when ready — mark ready for review manually.
```

---

## Guardrails

- **Never proceed with a dirty working tree** (Step 0).
- **Never mark the Draft PR ready for review** — leave that for the user.
- **Never skip the confidence gate** — even one unresolved blocking question can derail an entire plan.
- **Worktree on the existing branch** — do not create a new branch; `/analyze-issue` already created it.
- **Reuse existing worktrees** — never fail if one exists; resume instead.
- **If `/writing-plans` returns DRAFT** — surface blockers, do not proceed.
- **At any Review checkpoint in `/executing-plans`** — stop and wait.
- **Override is a last resort** — if confidence is overridden, note unresolved questions in the plan's Non-goals.
