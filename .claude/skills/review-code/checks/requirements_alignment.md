# Requirements Alignment Review

## Source of Truth
- The GitHub issue being implemented (title/body, fetch with `gh issue view <n>` if a number is known)
- `ISSUE_ANALYSIS.md` on the branch, if present (written by `/analyze-issue`)
- Any plan file under `.claude/docs/plans/active/{slug}/`

## Check For
- Missing requirements (something the issue/plan asked for isn't implemented)
- Scope creep (implemented beyond what was asked, with no stated reason)
- Misinterpretation (implemented differently than specified)

## Evaluate
- Compare each requirement/acceptance criterion to actual code
- Verify the file list touched matches what the analysis/plan expected
- Check that any plan task checkboxes align with the diff

## Socratic Questions
- "The issue says X, but I see Y - was this intentional?"
- "This wasn't in the original scope - what drove this addition?"
