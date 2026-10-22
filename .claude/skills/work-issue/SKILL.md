---
name: work-issue
description: >
  Runs the full issue pipeline end-to-end: /analyze-issue followed by
  /develop-issue, back to back, for one or more GitHub issue numbers. Use this
  whenever the user wants to take a ticket from a bare issue number all the way
  to implemented code in one go — phrases like 'work issue', 'take care of
  issue', 'do issue end to end', 'analyze and develop issue', or 'pick this up
  and build it'.

use_when:
  - "user gives an issue number and wants it fully handled, not just analyzed"
  - "user says 'work issue', 'do this issue end to end', 'analyze and develop'"
not_for:
  - "user only wants the analysis/branch/PR without implementation (use /analyze-issue alone)"
  - "ISSUE_ANALYSIS.md already exists on the current branch (use /develop-issue alone)"

outputs: "same outputs as /analyze-issue followed by /develop-issue"

see_also:
  - name: /analyze-issue
    when: "run standalone when only the analysis phase is wanted"
  - name: /develop-issue
    when: "run standalone when ISSUE_ANALYSIS.md already exists"
---

# Work Issue

Thin sequencing wrapper around `/analyze-issue` and `/develop-issue`. No new logic of its own — it just runs one after the other so a ticket can go from issue number to implemented code in a single request.

**Announce at start:** "I'm using the work-issue skill to run analyze-issue then develop-issue."

## Invocation

```
/work-issue 42
/work-issue 42 43 44
```

Args are GitHub issue numbers in this repo, passed straight through to `/analyze-issue`.

## Step 1 — Run `/analyze-issue`

Invoke `/analyze-issue` with the given issue number(s) exactly as that skill defines. Let it run to completion (branch created, `ISSUE_ANALYSIS.md` committed, Draft PR opened).

If `/analyze-issue` aborts (dirty tree, `gh` failure, etc.) — **stop here** and surface its error. Do not proceed to Step 2.

## Step 2 — Run `/develop-issue`

Invoke `/develop-issue` on the branch `/analyze-issue` just created. Let it run its own confidence gate — if confidence is Medium/Low, its clarification loop still applies and may need user input before continuing.

If `/develop-issue` pauses for a Review checkpoint or a clarification question, stop and wait like it normally would — `work-issue` does not skip or auto-answer those pauses.

For UI issues, `/develop-issue` ends by recording a screenshot and clip, posting them on the PR and deleting the local copies (its Step 8.5). That step needs ffmpeg, Playwright's Chromium and a browser tool signed in to GitHub. When the issue is UI work, check those up front so the run doesn't stall at the end: `ffmpeg -version`, `pnpm --filter site exec playwright install chromium`, and the browser tool's tab context.

## Step 3 — Report

Pass through `/develop-issue`'s final report as-is. No extra summary needed.

---

## Guardrails

- **This skill adds no steps of its own** — it is a sequence, not a replacement for either skill's guardrails.
- **Never auto-answer a confidence clarification or Review checkpoint** — those pauses are for the user, even inside this combined flow.
- **A failure in `/analyze-issue` halts the whole pipeline** — never fall through to `/develop-issue` on a partial/failed analysis.
- **The pipeline ends at Josh's review, never at a merge.** `/develop-issue` marks the PR ready and requests `jxsoren`'s review, and the PR body closes its issue(s). Nothing in this flow merges.
