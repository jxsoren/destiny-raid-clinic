---
name: analyze-issue
description: >
  Automates the upfront analysis phase of a GitHub issue: fetches issue details,
  creates a branch, analyzes codebase impact via targeted Grep/Glob + reads,
  commits an ISSUE_ANALYSIS.md, and opens a Draft PR. Use this whenever the user
  mentions a GitHub issue number, says 'start on', 'kick off', 'look into',
  'analyze', or 'pick up' any issue — even if they don't explicitly say
  'analyze issue'.

use_when:
  - "user provides a GitHub issue number to start work on"
  - "user says 'analyze issue', 'kick off issue', 'start on issue'"
  - "user wants a branch + PR created from an issue before writing code"
not_for:
  - "implementing the actual code changes (use /develop-issue after)"
  - "issues that are already in progress on an existing branch"

outputs: "git branch + committed ISSUE_ANALYSIS.md + Draft PR URL"
---

# Analyze Issue

Automates the upfront analysis phase of a GitHub issue: branch creation, codebase impact analysis, and Draft PR — before any implementation begins.

**Announce at start:** "I'm using the analyze-issue skill."

## Invocation

```
/analyze-issue 42
/analyze-issue 42 43 44
```

Args are GitHub issue numbers in this repo (`jxsoren/destiny-raid-clinic`). Multiple issue numbers → one branch, one analysis file with a section per issue.
If no args are given, ask for the issue number(s) interactively.

## Reference files (load on demand)

- `templates/issue_analysis_single.md` — analysis file template

---

## Step 1 — Preflight Check

```bash
git status --porcelain
```

If non-empty: **abort** and ask the user to stash or commit first.

## Step 2 — Fetch Issue(s) from GitHub

```bash
gh issue view <number> --json title,body,labels,number
```

Extract per issue: `title`, `body`, `labels`, `number`. If `gh` errors (auth, not found): report and abort.

## Step 3 — Create Branch

Branch naming: `<issue-number>-<title-slug>` (lowercase, hyphens, 60 char max).
Multiple issues: `<first-number>-<second-number>-<first-title-slug-max-40-chars>`.

```bash
git checkout main
git pull
git checkout -b <branch-name>
```

## Step 4 — Analyze the Codebase

**No Explore agents. No broad searches.** Token-efficient only.

1. Extract symbols from the issue title + body: function/component names, file names, route paths, encounter/trainer names.
2. **Targeted Grep/Glob** against the monorepo (`apps/`, `packages/`, `crates/`, `prototype/`, `scripts/`) to locate definitions and usages.
3. **Read** the identified files directly.

If grep finds nothing → note in Open Questions as "no existing implementation found — may be net-new". Do **not** escalate to broad sweeps. If the issue is too vague (no clear symbols) → skip to noting it in Open Questions and mark Confidence as Low.

## Step 5 — Write `ISSUE_ANALYSIS.md`

Use `templates/issue_analysis_single.md` as the template. Fill in the sections from Step 4 findings, then commit at the repo root:

```bash
git add ISSUE_ANALYSIS.md
git commit -m "#<number>: Add issue analysis"
```

For multiple issues: one `## Issue #<number>` section per issue, each with its own Summary / Affected Areas / Proposed Changes / Open Questions / Next Steps.

## Step 6 — Push and Create Draft PR

The PR body's first line(s) must be a closing keyword for every issue the branch covers, one per line:

```markdown
Closes #<number>
Closes #<other-number>
```

That links the PR in each issue's Development panel and closes the issue automatically when the PR merges into `main`. Write `Closes` exactly; a bare `#<number>` or "Related to #<number>" links without closing.

Those lines must be the **only** closing keywords anywhere in the body or in commit messages headed for `main`. GitHub treats close, closes, closed, fix, fixes, fixed, resolve, resolves and resolved followed by `#<number>` as a closing link, wherever it appears and in any case. Prose like "the Closes line closed #10" links #10 too. When prose has to mention another issue or PR, keep the verb away from the number ("issue 10 was shut by PR 15", or "see #10").

```bash
git push -u origin <branch-name>

gh pr create \
  --title "#<number>: <issue-title>" \
  --body "$(cat /tmp/pr_body.md)" \
  --draft
```

Then confirm GitHub linked **exactly** the right issues: `gh pr view <branch-name> --json closingIssuesReferences --jq '[.closingIssuesReferences[].number] | sort'` must equal the sorted list of issues this branch covers, no more and no fewer. If one is missing, restore its `Closes` line; if there is an extra one, reword the prose that caused it. Fix either with `gh pr edit <branch-name> --body-file <file>` and check again. A PR that covers no issue must come back `[]`.

If `gh pr create` fails: report the branch name and instruct the user to open the PR manually. Do not retry silently.

## Step 7 — Report

```
Branch:   <branch-name>
Draft PR: <url>

ISSUE_ANALYSIS.md committed. Review the PR when ready, then run /develop-issue to implement.
```

---

## Guardrails

- **Never proceed with a dirty working tree.**
- **Always create a Draft PR** — never ready-to-merge/ready-for-review.
- **Never spawn Explore agents** — the user does that themselves.
- **Thin issue description** → still create branch + PR, but make Open Questions prominent and Confidence Low.
- **Multiple issues** → one branch, one file, one PR, with a `Closes #<number>` line for each.
- **Every PR closes its issues, and only those** — the body carries `Closes #<number>` for each, no other closing keyword sits next to an issue number, and `closingIssuesReferences` is checked for an exact match.
- **`gh` failures** → report clearly, surface manual fallback; never fail silently.
