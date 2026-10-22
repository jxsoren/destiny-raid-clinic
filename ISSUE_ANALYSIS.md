# Issue Analysis: #6 — Allow rotating the arena for a full isometric view

> **Branch:** `6-rotate-arena-isometric-view`
> **Date:** 2026-10-22

## Issue Summary

In the Atheon arena trainer, the camera is locked to a single fixed angle; the player wants to rotate the view around the arena (orbit-style) to get a fuller isometric read of the encounter, at any point during the fight.

## Affected Areas

| File | Why |
|------|-----|
| `prototype/vault-of-glass/atheon/atheon.js` | Owns the single `THREE.PerspectiveCamera`, the fixed `base0`/`look0` vectors set in `resize()`, and the per-frame camera update (`camera.position.copy(base0) ... camera.lookAt(look0)`) around line 1184-1259. This is the only camera in the project with a fixed angle and an "arena" (the Atheon encounter room). No rotation/orbit control currently exists. |
| `prototype/vault-of-glass/atheon/atheon.js` (input section, ~line 1217-1229) | Existing `pointerdown` handler on `canvas` is used for tap-to-move and oracle-shoot; any new drag-to-rotate gesture needs to coexist with this without breaking taps (e.g. distinguish a drag beyond a threshold from a tap). |
| `packages/ui/src/space/SpaceRenderer.ts` | Has an *orthographic* camera and a `View`/`setView` tween system, but this is the home-screen "space" (galaxy) scene, not the raid arena — confirmed unrelated via `apps/site/src/pages/index.astro`, which explicitly calls the Atheon trainer "just prototype". Not expected to need changes for this issue. |

## Proposed Changes

1. `prototype/vault-of-glass/atheon/atheon.js` — Introduce a user-controlled yaw (and optionally pitch) offset applied when computing `camera.position` each frame: rotate the `base0` offset around `look0` by the current yaw angle instead of using `base0` directly, so the existing shake/sway math layers on top of the new orbit.
2. `prototype/vault-of-glass/atheon/atheon.js` — Add a drag gesture (pointerdown + pointermove + pointerup/cancel) on `canvas` that updates the yaw angle, with a movement-distance threshold so short taps still register as move/shoot actions (don't regress existing `tap`/`shootOracle` behavior).
3. `prototype/vault-of-glass/atheon/atheon.js` — Ensure the rotation state persists and keeps working across all encounter phases/phases transitions (`S.phase`), since acceptance criteria require rotation to work "at any point during the encounter."

## Open Questions

- Should rotation be constrained (e.g. a limited arc to preserve the isometric framing and avoid clipping into the stone meshes) or fully free 360°? The issue says "full isometric-style view," suggesting the intent is a wider range of fixed-elevation angles rather than true free-fly, but no exact bounds are specified.
- Should there be an explicit UI affordance (drag-to-rotate only, or also buttons/keys) given this is a touch + mouse + keyboard trainer (existing keyboard movement via `keydown`/`keyup` at line 547)?
- Should rotation reset on respawn/encounter restart, or persist across restarts within a session?

## Next Steps

1. Review this analysis in the Draft PR
2. Resolve Open Questions (if any) before implementing
3. Run `/develop-issue` to begin implementation

## Confidence

**Medium** — The affected file and exact camera update code are clearly identified with no ambiguity, but the UX shape of "rotate" (drag vs. buttons, bounded vs. free, persistence) is not specified in the issue and needs a product decision before implementation.
