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

1. `prototype/vault-of-glass/atheon/atheon.js` — Add a `yaw` state variable (radians, clamped to roughly ±45–60°) and rotate the `base0` offset around `look0` by `yaw` each frame instead of using `base0` directly, so the existing shake/sway math layers on top of the new orbit.
2. `prototype/vault-of-glass/atheon/atheon.js` — Add a drag gesture (pointerdown + pointermove + pointerup/cancel) on `canvas` that updates `yaw` from horizontal drag delta, clamped to the arc; use a movement-distance threshold so short taps still register as move/shoot actions (don't regress existing `tap`/`shootOracle` behavior).
3. `prototype/vault-of-glass/atheon/atheon.js` — Add two on-screen buttons (rotate-left / rotate-right) that nudge `yaw` by a fixed step, clamped to the same arc, for accessibility alongside the drag gesture.
4. `prototype/vault-of-glass/atheon/atheon.js` — Ensure `yaw` is read every frame regardless of `S.phase`, so rotation keeps working through all encounter phases/transitions (acceptance criteria: works "at any point during the encounter").
5. `prototype/vault-of-glass/atheon/atheon.js` — Reset `yaw` to `0` whenever the encounter restarts/respawns (wherever that reset path lives, e.g. alongside `window.__resetScene`).

## Open Questions

None — resolved via clarification:

- **Input method:** Drag-to-rotate on the canvas (short taps still move/shoot as today) **plus** explicit on-screen rotate-left/rotate-right buttons for accessibility.
- **Rotation range:** Constrained arc, roughly ±45–60° yaw from the default facing — not a full 360° orbit — to keep the isometric framing readable and avoid clipping into geometry behind the arena.
- **Persistence:** Rotation resets to the default angle on encounter restart/respawn; it does not persist across attempts.

## Next Steps

1. Review this analysis in the Draft PR
2. Resolve Open Questions (if any) before implementing
3. Run `/develop-issue` to begin implementation

## Confidence

**High** — The affected file and exact camera update code are clearly identified, and the UX shape of "rotate" (drag + buttons, constrained arc, reset on restart) has been resolved via clarification.
