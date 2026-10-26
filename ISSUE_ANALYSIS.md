# Issue Analysis: #28 - Add navbar for other sections other than raids

> **Branch:** `28-add-navbar-for-other-sections`
> **Date:** 2026-10-26

## Issue Summary

Extend the Director with activity navigation inspired by the older Destiny 2 Director. Users should be able to switch between Raids and Exotic Missions without losing the existing raid map interaction.

## Affected Areas

| File | Why |
|------|-----|
| `apps/site/src/components/Director.tsx` | Owns the raid-only map, selection, search, menu, and prompts. |
| `apps/site/src/components/Director.css` | Positions viewport overlays and portrait layout. |
| `apps/site/src/pages/index.astro` | Supplies raid content and page metadata. |
| `apps/site/src/lib/raids.ts` | Keep raid-specific loading separate from section navigation. |
| `packages/ui/src/index.ts` | Exports shared components; no activity navigation component exists. |
| `apps/site/e2e/director.spec.ts` | Existing keyboard, search, tooltip, and phone checks need navigation coverage. |
| `STYLEGUIDE.md` | Currently explicitly prohibits a top nav on the Director. |

## Proposed Changes

1. First slice: add Raids and Exotic Missions as an activity navigation strip. Raids remains the default and preserves the current planet scene.
2. Exotic Missions gets a clear empty state stating that guides and trainers are coming, rather than fabricated mission data or inactive links.
3. Support pointer, touch, and keyboard navigation; show the active section accessibly and preserve the selected raid when returning.
4. Keep section state reflected in the URL so refresh and browser back behave predictably; settle exact URL design during planning.
5. Scope search and action prompts to the active section. Do not leave hidden raid actions enabled on the empty mission screen.
6. Use shared UI tokens and update the style guide to permit the agreed navigation. Adapt the strip to narrow screens and reduced motion.
7. Add focused coverage for section switching, empty state, URL history, existing raid navigation, and narrow screens.

## Open Questions

- Proposed initial scope is Raids and Exotic Missions only. Should Dungeons also appear in the first slice?
- Is a clearly labeled coming-soon Exotic Missions screen acceptable while only raid content exists?
- The issue's screenshot has not been visually inspected because the user requested CLI-only work. The proposal follows the written requirement; exact visual matching is not yet established.

## Next Steps

1. Review this proposal and resolve the initial section/empty-state choices with the user.
2. Raise confidence to High, then create an implementation plan in the issue worktree.
3. Implement and verify the navigation while preserving the existing Director behavior.
4. Submit the finished PR for Josh's review; do not merge.

## Confidence

**Medium** - The integration points and existing behavior are clear, but the activity scope and empty-state behavior need agreement before implementation.
