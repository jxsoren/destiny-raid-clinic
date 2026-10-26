# Issue Analysis: #38 - Build raid encounter selection screen

## Issue Summary
Replace the temporary raid detail page with the space-scene encounter selector specified by STYLEGUIDE.md. Prioritize the existing Vault of Glass to Atheon trainer route rather than new placeholder activities.

## Affected Areas
- apps/site/src/pages/raids/[id].astro: replace temporary list with hydrated raid screen.
- apps/site/src/components/RaidDirector.tsx and RaidDirector.css: new scene overlay, encounter selection, details and launch actions.
- apps/site/e2e/raid.spec.ts: cover encounter selection, trainer navigation, empty content and responsive behavior.
- packages/ui/src/space/SpaceScene.tsx: existing renderer and fallback to reuse without shared changes.
- packages/ui/src/PerkNode.tsx, ItemHeader.tsx, PromptBar.tsx: existing shared components to reuse.

## Proposed Changes
Use the raid content already loaded by raids.ts. Render the planet on the right and an ordered dotted encounter path beside it. Select the first playable encounter by default, otherwise the first encounter. Show real availability and a direct launch action only for existing trainers. Preserve Back to raids, add keyboard navigation among encounter controls, and provide a narrow-screen layout. Keep guide links absent until guide routes exist.

## Open Questions
None blocking. User approved this scope and supplied the inline planning/execution fallback. The plan still requires explicit approval before execution.

## Confidence
**High** - The intended screen is specified in the style guide and the existing raid data, UI components and Atheon route provide a bounded implementation.
