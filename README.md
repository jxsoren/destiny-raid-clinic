# destiny-raid-clinic

Browser-based trainers and guides for Destiny 2 raid encounters. Pick a seat in the fireteam, bots play the other five correctly, and every wipe ends with an explanation of what went wrong. Every raid and encounter follows the same template: a deterministic simulation plus a written guide, generated from the same data.

> Status: **foundation**. The repo layout, tooling, CI and content templates are in place. The TypeScript encounter-trainer engine (simulation, renderer, HUD, all templated across raids) is next; see `docs/superpowers/specs/2026-10-22-encounter-trainer-engine-design.md`. A single-page Atheon prototype lives in `prototype/` until it's ported and retired.

## Getting started

You need:

- **Rust via [rustup](https://rustup.rs)**, for `raidlint` (the content linter/scaffolder — the only Rust in this repo). It installs the exact toolchain pinned in `rust-toolchain.toml`. Homebrew's Rust works fine for this.
- **Node >=22.12** and **pnpm**: `npm install -g pnpm@12.10.1` (or `brew install pnpm`), matching `packageManager` in `package.json`. Don't use `corepack enable`. The Corepack bundled with Node 23 can't run pnpm 12 (`Cannot find module …/bin/pnpm.cjs`).
- **[just](https://just.systems)**, the task runner (`brew install just` or `cargo install just`).

```sh
just setup        # install JS tooling
just dev          # the site at http://localhost:4321 (styleguide at /styleguide)
just check        # everything CI runs
just e2e          # browser tests for the site; run `pnpm --filter site exec playwright install chromium` once first
just              # list all tasks
```

## Repository layout

```
crates/
  raidlint/     validates content against the templates; scaffolds raids and encounters
content/
  raids/<raid>/                    raid.json · guide.mdoc · encounters/
    encounters/<NN>-<encounter>/   encounter.json · guide.mdoc · sources.md · replays/ · mechanics.ts (optional)
templates/      the files every new raid and encounter starts from
prototype/      the original single-page Atheon trainer (reference until ported and retired)
apps/site/      the Astro site (pages, layouts)
packages/ui/    design tokens, type roles and Solid components
packages/sim/   (planned) TypeScript encounter simulation engine and mechanics primitives
packages/renderer/  (planned) three.js scene-building, shared across every encounter
packages/hud/   (planned) Solid HUD components (objectives, radar, callouts)
scripts/        repo scripts (style lint)
STYLEGUIDE.md   how everything looks, reads and behaves (read before any UI work)
```

The simulation, renderer and HUD are plain TypeScript, not Rust/WASM — see
`docs/superpowers/specs/2026-10-22-encounter-trainer-engine-design.md` for why, and for how
encounters share a mechanics-primitives library instead of each being a one-off build.

## Adding a raid or an encounter

Never create these files by hand. Scaffold them so every raid and encounter has the same structure:

```sh
just new-raid kings-fall "King's Fall" "Dreadnaught"
just new-encounter kings-fall 6 oryx "Oryx, the Taken King"
```

This creates the folders from `templates/`, fills in ids and names, and keeps `raid.json`'s encounter list in order.

A new raid appears on the Director (the home page) automatically, dimmed until a trainer exists for one of its encounters.

`just content` (part of `just check` and CI) then enforces the template:

- **Folder names:** encounter folders are named `NN-slug`.
- **Exact files:** each raid and encounter has its required files and nothing else.
- **JSON keys:** `raid.json` and `encounter.json` have exactly the required top-level keys.
- **Matching ids:** ids, raids and orders agree between folders, data and guide frontmatter.
- **Guide sections:** each guide has all required sections in order (12 per encounter, 7 per raid).
- **Finished files:** no template placeholders are left unfilled, and no `TODO` remains in a guide marked `status: reviewed`.

### Guide sections

| Encounter guide (in order) | Raid guide (in order) |
|---|---|
| TL;DR · Overview · Roles & loadout · Map & callouts · Mechanics glossary · Phase walkthrough · Damage phase · Wipe conditions · Challenges & triumphs · Master / Contest differences · Common mistakes · Practice drills | Overview · Encounter flow · Role matrix · Shared glossary · Loadout & builds · Challenges, triumphs & secret chests · Changelog |

Sections tagged with `{% … /%}` in the templates (roles, callout map, glossary, phase table, damage windows, wipe conditions, difficulty differences, drills) render from `encounter.json`, so the guide and the trainer can't disagree. Write the prose around them, and don't hand-type numbers the data file owns.

## Simulation rules

The simulation (`packages/sim`, TypeScript) is deterministic given the same seed, inputs and
content version — no multiplayer server is in scope, so determinism exists for reproducible
replays and regression tests within a single run, not cross-host bit-identity. The renderer and
HUD never own gameplay state; they read a one-way snapshot the sim produces each tick. See
`docs/superpowers/specs/2026-10-22-encounter-trainer-engine-design.md` for the full design.

## The Atheon prototype

```sh
just prototype    # http://localhost:8080
```

`prototype/tests/` drives the prototype headless: every seat played correctly clears 20 out of 20 runs, and each seat left idle wipes for the expected reason. These tests run in `just check` and CI.

## Contributing

- Read STYLEGUIDE.md before touching anything visual.
- Branch from `main` and open a pull request. CI runs `fmt`, clippy (warnings are errors), tests, Biome and content validation.
- Run `just check` before pushing.
- For arena or mechanic changes, cite your reference (guide, map or video timestamp) in the encounter's `sources.md`. Link and credit; don't copy images into the repo.
- Check visual changes in a real browser on a real GPU. Some rendering bugs only appear on hardware GPUs.

Atheon references: two community Atheon maps, including one by TheRedDelilah. Mechanics are from community guides ([PCGamesN](https://www.pcgamesn.com/destiny-2/vault-of-glass-guide), [Dexerto](https://www.dexerto.com/destiny/ultimate-destiny-2-vault-of-glass-raid-guide-1578682/), [Destinypedia](https://www.destinypedia.com/Atheon,_Time%27s_Conflux), [Game Rant](https://gamerant.com/destiny-2-how-to-beat-atheon-in-the-vault-of-glass/)).
