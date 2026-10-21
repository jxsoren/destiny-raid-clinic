# destiny-raid-clinic

Fan-made, browser-based trainers and guides for Destiny 2 raid encounters. Pick a seat in the fireteam, bots play the other five correctly, and every wipe ends with an explanation of what went wrong. Every raid and encounter follows the same template: a deterministic simulation plus a written guide, generated from the same data.

> Status: **foundation**. The repo layout, tooling, CI and content templates are in place. The Rust simulation engine is next. A single-page Atheon prototype lives in `prototype/` until it's ported.

## Getting started

You need:

- **Rust via [rustup](https://rustup.rs)**. It installs the exact toolchain pinned in `rust-toolchain.toml`, including the WebAssembly target. Homebrew's Rust works for most tasks, but it can't add the WebAssembly target later.
- **Node 22+** and **pnpm** (`corepack enable`, or see [pnpm.io](https://pnpm.io)). The version is pinned in `package.json`.
- **[just](https://just.systems)**, the task runner (`brew install just` or `cargo install just`).

```sh
just setup        # install JS tooling
just check        # everything CI runs: format, lint, tests, content validation
just              # list all tasks
```

## Repository layout

```
crates/
  sim/          deterministic simulation engine (no I/O, no web APIs)
  raidlint/     validates content against the templates; scaffolds raids and encounters
content/
  raids/<raid>/                    raid.json · guide.mdoc · encounters/
    encounters/<NN>-<encounter>/   encounter.json · guide.mdoc · sources.md · replays/
templates/      the files every new raid and encounter starts from
prototype/      the original single-page Atheon trainer (reference until ported)
```

More crates (`primitives`, `encounters`, `content`, `proto`, `sim-wasm`, `server`) and the `apps/site` web client arrive in later build steps.

## Adding a raid or an encounter

Never create these files by hand. Scaffold them so every raid and encounter has the same structure:

```sh
just new-raid kings-fall "King's Fall"
just new-encounter kings-fall 6 oryx "Oryx, the Taken King"
```

This creates the folders from `templates/`, fills in ids and names, and keeps `raid.json`'s encounter list in order.

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

The simulation must give bit-identical results natively and in WebAssembly, for replays, multiplayer and regression tests. `crates/sim/clippy.toml` makes the main hazards compile errors in CI:

- `std` trig, exp and pow functions (which differ by platform)
- `mul_add`
- `HashMap` and `HashSet` (unspecified iteration order)

## The Atheon prototype

```sh
just prototype    # http://localhost:8080
```

`prototype/tests/` drives the prototype headless: every seat played correctly clears 20 out of 20 runs, and each seat left idle wipes for the expected reason. These tests run in `just check` and CI.

## Contributing

- Branch from `main` and open a pull request. CI runs `fmt`, clippy (warnings are errors), tests, Biome and content validation.
- Run `just check` before pushing.
- For arena or mechanic changes, cite your reference (guide, map or video timestamp) in the encounter's `sources.md`. Link and credit; don't copy images into the repo.
- Check visual changes in a real browser on a real GPU. Some rendering bugs only appear on hardware GPUs.

## Credits and disclaimer

This is an unofficial fan project, not affiliated with or endorsed by Bungie. Destiny, Vault of Glass and related names belong to Bungie, Inc. No Bungie art, models, fonts or audio are included. Everything is built in code.

Atheon references: two community Atheon maps, including one by TheRedDelilah. Mechanics are from community guides ([PCGamesN](https://www.pcgamesn.com/destiny-2/vault-of-glass-guide), [Dexerto](https://www.dexerto.com/destiny/ultimate-destiny-2-vault-of-glass-raid-guide-1578682/), [Destinypedia](https://www.destinypedia.com/Atheon,_Time%27s_Conflux), [Game Rant](https://gamerant.com/destiny-2-how-to-beat-atheon-in-the-vault-of-glass/)).
