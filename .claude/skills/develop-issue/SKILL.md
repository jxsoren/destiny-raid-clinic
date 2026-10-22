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
  - name: /review-code
    when: "invoked internally after implementation, before the UI preview/report steps"
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

## Step 8.1 — Review Code

Invoke `/review-code` (run it from inside the worktree, `git -C tmp/worktrees/<branch-slug> ...` for its diff/file commands) to get an architectural review of the implementation before it's reported as done.

- If it reports **Must Fix** items, surface them to the user and ask whether to address them now or proceed anyway. Don't silently skip them.
- **Should Discuss**/**Consider** items: summarize briefly in the final report (Step 9); don't block on them or run the full Phase 2 discussion loop unless the user wants to.
- If the review file was written to `.claude/docs/plans/active/<feature-slug>/`, mention its path in the final report.

## Step 8.5 — UI Fix Preview Comment

Check whether the issue touched UI: any changed file under a frontend path (e.g. components, views, pages, styles) or the `ISSUE_ANALYSIS.md` Affected Areas mentioning UI/frontend. If not a UI fix, skip to Step 9.

If it is a UI fix, every preview gets a **screenshot** and, when the change moves or is only visible over time (animation, pulsing/bobbing effects, camera rotation, canvas/WebGL rendering, transitions, drag interactions), a **short clip**. One script captures both.

Facts this step relies on (each one cost a failed attempt to learn):
- `gh` has no way to upload files. GitHub only accepts attachments through its web comment box, so the upload needs a browser signed in to GitHub (8.5c).
- GitHub plays **mp4/mov** inline. A `.webm` attachment shows up as a download link. Playwright records webm, and its bundled ffmpeg can only write VP8, so converting needs a full `ffmpeg` on PATH.
- Headless Playwright Chromium renders the three.js/WebGL scenes fine for a preview. It is not a substitute for the real-GPU check in the README.
- Never commit media to the repo or park it in release assets to get a URL.

### 8.5a — Capture

1. **Tools, once per machine.** Playwright already ships with `apps/site`, so install nothing into the repo. Its Chromium: `pnpm --filter site exec playwright install chromium`. ffmpeg: `ffmpeg -version`; if missing, `brew install ffmpeg` (macOS) or `winget install Gyan.FFmpeg` (Windows).
2. **Serve the worktree** in the background: `just prototype` (`http://localhost:8080`) for prototype changes, `just dev` (`http://localhost:4321`) for the site. Confirm the page answers before recording.
3. **Record** into a fresh scratch folder (not the repo):
   ```bash
   node .claude/skills/develop-issue/scripts/record-preview.mjs \
     --url <page-url> --out <scratch-dir> --click "<text to click>" --seconds 12
   ```
   `--click` can repeat (e.g. pick a seat, then a button). Pick a view where the change is obvious: for a player-visibility change, a seat that stays in the crowd. The script writes `preview.png` and `preview.mp4` (H.264, about 1 MB for 12 s), deletes its intermediate files, and warns about any page errors. The mp4 starts once the clicks have landed; page load and clicks can take 20+ seconds under headless WebGL, and that time is cut. Keep clips short: GitHub caps free-plan video uploads at 10 MB.
4. **Look at `preview.png` before posting.** If it doesn't show the change, adjust the clicks or duration and record again.
5. A "before" capture from the base branch is optional. Only do it when the difference is hard to describe in words.

### 8.5b — Upload to GitHub

Use a browser tool that is signed in to GitHub as the user (Claude in Chrome, or another browser MCP):

1. Open the PR page and find the **new comment** box's file input (the "Paste, drop, or click to add files" control under the comment textarea).
2. Upload `preview.png` and `preview.mp4` to that input with the browser tool's file-upload action. Don't click the input; that opens a native file picker the agent can't use.
3. Wait a few seconds, then read the attachment URLs out of the textarea with a page script, not by eye (long ids are easy to misread):
   ```js
   [...document.querySelectorAll('textarea')].map(t => t.value)
     .join('\n').match(/https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+/g)
   ```
   The image URL comes first if the png was uploaded first.
4. **Clear the textarea without posting.** The uploads stay valid; the draft is only a way to get URLs.

If no signed-in browser tool is available, stop here: send the user the two files, say the preview isn't posted, and skip to the cleanup at the end of 8.5c only after they confirm they have the files.

### 8.5c — Post, verify, clean up

1. Write the comment body to a scratch file and post it with `gh`, so the text is exact:
   ```markdown
   UI preview for #<number>: <one or two sentences on what to look for, and anything odd in the clip, e.g. an unplayed seat failing its mechanic>.

   <img width="1280" alt="<short description>" src="<image-url>" />

   <video-url>
   ```
   The video URL goes **on its own line, bare** (no Markdown link syntax). That is what makes GitHub render a player.
   ```bash
   gh pr comment <branch-name> --body-file <comment-file>
   ```
2. **Also add the preview to the PR description** so it is visible without scrolling: read the body with `gh pr view <branch-name> --json body --jq .body`, append a `## Preview` section with the same image and video lines, and write it back with `gh pr edit <branch-name> --body-file <updated-body-file>`. Don't clobber the existing body.
3. **Verify** the post: `gh api repos/{owner}/{repo}/issues/comments/<id> --jq .body` shows both URLs. If a browser tool is available, load the comment and check the video element loaded (`readyState` 4, non-zero `duration`).
4. **Delete the local media** once the post is verified, so captures don't pile up on disk:
   ```bash
   node .claude/skills/develop-issue/scripts/record-preview.mjs --clean --out <scratch-dir>
   ```
   It only deletes a folder holding nothing but its own `preview.*` files, so point `--out` at a folder made just for this capture. Also delete the comment and body scratch files and stop the dev server. GitHub keeps its own copy of the uploads. Do this even when the post failed and the user took the files, once they confirm they have them.

If the dev server can't start or nothing can be captured, skip this step and say in the final report that no UI preview was posted.

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
Review:    .claude/docs/plans/active/<feature-slug>/<feature-slug>-review.md (or inline summary)
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
- **Don't skip Step 8.1** — even a quick review catches issues before they reach the PR; Must Fix findings need explicit user acknowledgment, not silent pass-through.
