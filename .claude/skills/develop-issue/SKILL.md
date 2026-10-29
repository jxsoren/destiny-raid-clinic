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

outputs: "worktree with implemented code, plan file marked complete, PR marked ready with jxsoren's review requested and Closes #<number> linking the issue"

see_also:
  - name: /analyze-issue
    when: "no ISSUE_ANALYSIS.md exists yet"
  - name: /writing-plans
    when: "invoked internally to produce the implementation plan; not in this repo, Step 6 has an inline fallback"
  - name: /executing-plans
    when: "invoked internally to execute the plan; not in this repo, Step 7 has an inline fallback"
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

If `/writing-plans` is available, invoke it. Pass `ISSUE_ANALYSIS.md` as the design doc input:
- **Issue Summary** → Goal
- **Affected Areas** → Reference files
- **Proposed Changes** → Task list
- **Open Questions** → Non-goals / constraints

The plan is saved to `.claude/docs/plans/active/<feature-slug>/YYYY-MM-DD-<feature-slug>.md`.

Wait for the plan to reach **APPROVED**. If `/writing-plans` returns **DRAFT**, surface issues and wait for resolution.

### Fallback: `/writing-plans` is not installed

Neither `/writing-plans` nor `/executing-plans` ships in this repo; they come from the developer's own setup. If invoking it fails with an unknown-skill error, don't stop and don't invent a skill. Write the plan inline, in the same file path, in this shape:

```markdown
# Plan: <feature name> (#<number>)

Status: DRAFT

## Goal
<Issue Summary, 1 to 3 sentences>

## Reference files
<Affected Areas: path, why>

## Tasks
- [ ] 1. `path/to/file` : <change, and how it will be checked>
- [ ] 2. ...
- [ ] Final: run `just check` (or the CI steps that run locally) and fix what it finds.

## Non-goals and constraints
<Open Questions, plus anything this change must not touch>
```

Each task is one small change that can be checked on its own (a test, a command, or a screenshot). Order them so the tests that prove the change come with it, not at the end. Show the plan to the user, set `Status: APPROVED` only after they agree, and note in the final report that the inline fallback was used.

## Step 7 — Execute the Plan

If `/executing-plans` is available, invoke it with the approved plan and follow the skill exactly:
- Pause at every Review checkpoint and wait for user feedback
- Mark tasks `[x]` as they complete
- Don't guess through blockers — stop and ask

### Fallback: `/executing-plans` is not installed

Work the inline plan the same way by hand:
- Do the tasks in order, one at a time, in the worktree.
- After each task, run what the task said would check it, then mark it `[x]` in the plan file.
- After every second task, or after any task that touches shared code, stop and show the user what changed so far, and wait for their feedback. That is the Review checkpoint.
- If a task turns out to be wrong or blocked, stop and ask. Don't work around it silently, and don't change the plan without telling the user.
- Commit when a task or a pair of tasks is green, with messages that name the issue number.

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

**CI captures prototype previews for you.** The `PR previews` workflow runs on every PR that touches `prototype/`, `packages/ui/`, `apps/site/` or `previews/`, and keeps one sticky comment with a screenshot per scenario in `previews/scenarios.json` (GIF too when a scenario sets `"gif": true`, or for all of them with the `preview:video` label). It never blocks the PR. So for a prototype UI change, add or edit a scenario in `previews/scenarios.json` (id, title, path, `clicks`, `seconds`, and `"gif": true` only when the change moves), push, and check the comment appears. Use 8.5a to 8.5c below when the change is not covered by a scenario, the workflow failed, or you need a before/after. Scenarios run against `prototype/` only for now.

Facts this step relies on (each one cost a failed attempt to learn):
- `gh` has no way to upload files. GitHub only accepts attachments through its web comment box, so the upload needs a browser signed in to GitHub (8.5b).
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

### 8.5b — Upload and post

The capture in 8.5a runs in Playwright's own headless Chromium, so it works the same whatever browser the person uses day to day. Only this upload step needs a browser that is signed in to GitHub as the user, and there are two routes. Use whichever is available; if neither is, stop and tell the user what to set up.

| Route | Browsers | Check it is ready |
|---|---|---|
| **Claude in Chrome** (extension) | Chrome only | `list_connected_browsers` returns a browser |
| **Playwright MCP** | Chrome, Firefox, WebKit or Edge, chosen by the MCP server's `--browser` option | `browser_navigate` to the PR, then `browser_evaluate` on `() => document.querySelector('meta[name="user-login"]')?.content` returns the user's login |

**Setting up the Playwright MCP route for Firefox** (one time, by the user): run the MCP server with `--browser firefox`. Its window is visible (headed) and keeps a persistent profile by default, or one you choose with `--user-data-dir`. The user signs in to GitHub once in that window and it stays signed in. A profile can only be open in one browser at a time. Never sign in for the user. Its extension mode (attach to a running browser) is Chrome and Edge only, so it doesn't help for Firefox.

**What does not work**, so it isn't retried:
- The desktop app's built-in browser can be signed in to GitHub but has no file-upload tool, and a pasted image does not register.
- Copying file bytes into a script by hand corrupts them (the image won't load).
- Moving bytes between pages with `window.name` or `postMessage` is blocked by the safety checks as exfiltration. Don't try to route around that.

Steps, in this order (the tool names for each route are in brackets, Chrome first):
1. **Open the PR page and wait about 3 seconds**, then locate the new comment form's file input, its textarea and its submit button [`find` | `browser_snapshot`]. The first `find` straight after a navigation can fail with a "navigated to a different domain" message; run it again. Refs go stale when the page re-renders, so locate again right before each use and never reuse refs from an earlier step.
2. **Upload first** (`preview.png`, `preview.mp4`, any extra screenshots, under 10 MB combined):
   - Chrome: `file_upload` to the file input ("Add files"). Don't click the input; that opens a native picker the agent can't use.
   - Playwright: click the "Add files" button; the result shows a "File chooser" modal state. Then call `browser_file_upload` with the paths. It only accepts paths inside its allowed roots (the error lists them), so first copy the files into the `.playwright-mcp` folder under the MCP's workspace root, and delete those copies afterwards. Page tools such as `browser_evaluate` refuse to run while the chooser is still open.
3. **Read the attachment markdown back** with a page script, not by eye [`javascript_tool` | `browser_evaluate`]:
   ```js
   document.getElementById('new_comment_field').value
   ```
   Each file appears as a line with a `https://github.com/user-attachments/assets/<id>` URL.
4. **Write the final comment by setting the textarea's value directly** [`form_input` | `browser_type` or `browser_fill_form` with a target], reusing those exact URLs:
   ```markdown
   UI preview for #<number>: <one or two sentences on what to look for>.

   <img width="1280" alt="<short description>" src="<image-url>" />

   <video-url>
   ```
   The video URL goes **on its own line, bare** (no Markdown link syntax). That is what makes GitHub render a player. Setting the value replaces the whole textarea, which is why the upload comes first.
5. **Post it.** Click the submit button of the new comment form. The page also has an "Update comment" button for editing; make sure the label is "Comment".

**Never type into the page.** If a click on the textarea fails and you send key presses anyway, the keystrokes hit GitHub's keyboard shortcuts: once that opened vscode.dev (asking to sign in) and two "Create codespace" pages. Only set values on a specific element. If anything unexpected opens, list the tabs, close the stray ones without clicking Allow or Create, and confirm with `gh` that nothing was changed.

Close the tabs you opened when you are done. If no signed-in route is ready, say so and wait for the user to set it up. Never send the media to the user or leave it on their device; keep the captures in the scratch folder until the post is verified.

### 8.5c — Verify, describe, clean up

1. **Verify** the comment: `gh api repos/{owner}/{repo}/issues/<pr-number>/comments --jq '[.[] | select(.user.login=="<user>")] | last | .body'` shows the image and video URLs. If a browser tool is available, load the comment and check the video element loaded (`readyState` 4, non-zero `duration`).
2. **Also add the preview to the PR description** so it is visible without scrolling: read the body with `gh pr view <branch-name> --json body --jq .body`, append a `## Preview` section with the same image and video lines, and write it back with `gh pr edit <branch-name> --body-file <updated-body-file>`. Don't clobber the existing body, and keep the `Closes #<number>` lines at the top.
3. **Delete the local media** once the post is verified, so captures don't pile up on disk:
   ```bash
   node .claude/skills/develop-issue/scripts/record-preview.mjs --clean --out <scratch-dir>
   ```
   It only deletes a folder holding nothing but its own `preview.*` files, so for other screenshots just delete the scratch folder. Also delete the comment and body scratch files and stop the dev server. GitHub keeps its own copy of the uploads.

A failed attempt can leave an unreferenced upload on GitHub. It is harmless and cannot be deleted; don't retry in a loop to avoid creating more.

If the dev server can't start or nothing can be captured, skip this step and say in the final report that no UI preview was posted.

## Step 8.9 — Submit for Josh's Review

Every PR goes to Josh (`jxsoren`) for approval before it merges. No exceptions, including small fixes and skill or docs changes.

1. **Check the issue links are exact.** Step 8.5 and any other body edits must keep the `Closes #<number>` lines at the top, and must not add closing keywords next to other issue numbers (see `/analyze-issue` Step 6 for the keyword list):
   ```bash
   gh pr view <branch-name> --json closingIssuesReferences --jq '[.closingIssuesReferences[].number] | sort'
   git log main..<branch-name> --format=%B | grep -iE '(close[sd]?|fix(e[sd])?|resolve[sd]?)[[:space:]:]+#[0-9]+'
   ```
   The first must equal the issues the branch covers, no more and no fewer. The second shows the closing keywords in the branch's commit messages, which also close issues once merged into `main`; each one must name an issue the branch covers. Fix the body with `gh pr edit <branch-name> --body-file <file>`; reword a stray commit message before review.
2. **Mark it ready and request Josh's review:**
   ```bash
   gh pr ready <branch-name>
   gh pr edit <branch-name> --add-reviewer jxsoren
   ```
   Then confirm with `gh pr view <branch-name> --json isDraft,reviewRequests`: `isDraft` false and `jxsoren` in the reviewers. Review requests on a draft don't notify anyone, so `gh pr ready` has to come first.
3. **Stop there.** Don't merge, don't enable auto-merge and don't approve. Merging is Josh's call once he approves.

## Step 9 — Report

```bash
gh pr view <branch-name> --json url,title
```

```
Issue #<number> development complete. PR is ready and waiting on Josh's review.

Branch:    <branch-name>
Worktree:  tmp/worktrees/<branch-slug>
           (remove with `git worktree remove tmp/worktrees/<branch-slug>`)
Plan:      .claude/docs/plans/active/<feature-slug>/<plan-file>
Review:    .claude/docs/plans/active/<feature-slug>/<feature-slug>-review.md (or inline summary)
PR:        <url> (closes #<number>, review requested from jxsoren)
```

## After the PR Merges

When the user says the PR merged (or a later run finds it merged), confirm each linked issue actually closed:

```bash
gh issue view <number> --json state,closedByPullRequestsReferences \
  --jq '"\(.state) by \([.closedByPullRequestsReferences[].number])"'
```

`CLOSED by [<pr>]` means it worked. If an issue is still open (the PR merged into a branch other than `main`, or the keyword got lost), close it and link the PR by hand:

```bash
gh issue close <number> --comment "Fixed in #<pr-number>."
```

---

## Guardrails

- **Never proceed with a dirty working tree** (Step 0).
- **Josh approves every PR before it merges.** Step 8.9 marks the PR ready and requests `jxsoren`'s review. Never merge, enable auto-merge or approve a PR yourself, and never mark one ready before Steps 8.1 to 8.5 are done.
- **Every PR closes its issues, and only those** — `Closes #<number>` stays at the top of the body through every edit, no other closing keyword sits next to an issue number in the body or commits, `closingIssuesReferences` matches exactly, and issues are confirmed closed after the merge.
- **Never skip the confidence gate** — even one unresolved blocking question can derail an entire plan.
- **Worktree on the existing branch** — do not create a new branch; `/analyze-issue` already created it.
- **Reuse existing worktrees** — never fail if one exists; resume instead.
- **If `/writing-plans` returns DRAFT** — surface blockers, do not proceed.
- **At any Review checkpoint in `/executing-plans`** (or the fallback's checkpoints) — stop and wait.
- **Missing `/writing-plans` or `/executing-plans` is not a blocker** — use the inline fallbacks in Steps 6 and 7, and say so in the report.
- **Override is a last resort** — if confidence is overridden, note unresolved questions in the plan's Non-goals.
- **Don't skip Step 8.1** — even a quick review catches issues before they reach the PR; Must Fix findings need explicit user acknowledgment, not silent pass-through.
