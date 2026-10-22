# Review Code Skill

Human-style code review for PR readiness. Checks things automated tools can't catch: SOLID violations, over/under-engineering, consistency with codebase patterns, data/perf scale issues.

Ported from the `ehub` repo's `review-code` skill, adapted for this repo's stack (plain JS/Node, browser-based trainers, GitHub issues/PRs instead of Rails/GitLab MRs).

## Architecture

Uses **parallel subagent dispatch**: each of 9 checks runs independently as a separate `Explore` agent.

```
review-code/
├── SKILL.md                           # Orchestration logic - dispatches subagents
├── README.md                          # This file
├── support/
│   ├── review_integrity.md           # Rules for honest review
│   └── report_format.md              # Output structure template
└── checks/
    ├── requirements_alignment.md
    ├── solid_principles.md
    ├── codebase_consistency.md
    ├── over_engineering.md
    ├── under_engineering.md
    ├── test_coverage_gaps.md
    ├── refactor_artifacts.md
    ├── red_flags.md
    └── data_scale.md
```

## Output
`.claude/docs/plans/active/{slug}/{slug}-review.md`, or inline if no slug context exists.
