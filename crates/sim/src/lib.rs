//! Deterministic raid-encounter simulation engine.
//!
//! Runs unchanged in three hosts: a browser Web Worker (WebAssembly), the game server (native)
//! and tests. Given the same seed, inputs and content version it must produce bit-identical
//! results on every target, so this crate has no I/O, no clocks, no threads and no web APIs.
//! `clippy.toml` in this crate turns the determinism rules into lint errors.
//!
//! The engine itself (world, fixed-tick step, math/RNG wrappers, nav grid, state hash) lands in
//! build step 2; see the architecture notes for the design.

/// Simulation version. Bump whenever a change can alter results for the same seed and inputs;
/// replays record it so they're re-run against the build that produced them.
pub const SIM_VERSION: u32 = 0;

/// Fixed simulation rate. Rendering interpolates between ticks.
pub const TICK_HZ: u32 = 30;
