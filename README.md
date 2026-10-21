# destiny-raid-clinic

Fan-made, browser-based trainers for Destiny 2 raid encounters. Pick a seat in the fireteam, bots play the other five correctly, and every wipe ends with an explanation of what went wrong.

**Encounters**

| Raid | Encounter | Path |
|---|---|---|
| Vault of Glass | Atheon, Time's Conflux | [`encounters/vault-of-glass/atheon/`](encounters/vault-of-glass/atheon/) |

## Run it locally

Requires Node 20+. There are no dependencies to install.

```sh
npm start        # http://localhost:8080
npm test         # headless simulation checks
```

The pages use ES modules, so open them through the dev server. Opening the HTML file directly (`file://`) won't work. three.js loads from the jsDelivr CDN, so you need a connection.

## How an encounter page is built

Each encounter lives in `encounters/<raid>/<encounter>/` and is plain HTML, CSS and JS. There is no build step.

| File | What's in it |
|---|---|
| `index.html` | Page shell, HUD markup, research notes, three.js import map |
| `<name>.css` | All styles. Dark single theme, Destiny-style HUD |
| `<name>.js` | Everything else, in labeled sections (below) |

Sections inside `atheon.js`, in order:

1. **Simulation**: arena polygons traced from community maps (map pixels × 0.5 = sim units), walkability grid with A* pathfinding, height levels, roster, phase state machine and bot behavior. Pure logic with no WebGL, which is what the tests drive.
2. **HUD and overlay**: objective tracker, buffs, boss bar, radar, Ghost guidance, seat picker and wipe screens.
3. **Audio**: Web Audio, all synthesized, including a distinct tone for each Oracle spot.
4. **Engine**: three.js r160 scene, materials, arena geometry built from the same polygons as the simulation, particles, post-processing (ambient occlusion, bloom, tone mapping, SMAA, color grade) and automatic quality tiers.

The renderer only reads simulation state (`S`). Gameplay changes go in the simulation section, visual changes in the engine section.

## Tests

`npm test` runs `tests/atheon.test.mjs`, which loads the page script with DOM stubs and plays the encounter headless:

- Every seat, played correctly, clears 20 out of 20 runs.
- Each seat left idle wipes for the expected reason. For example, an idle plate holder wipes with "The time gate closed".

Run it before opening a pull request. If you change mechanics or timings, update the expectations in the test.

## Contributing

- Branch from `main` and open a pull request. Keep visual and gameplay changes in separate PRs when you can.
- Check the page in a real browser on a real GPU. Some rendering bugs, like overflowing highlights turning the scene black, only show up on hardware GPUs, not in software rendering.
- If you change the arena layout, cite your reference (map, video timestamp) in the PR.

## Credits and disclaimer

This is an unofficial fan project, not affiliated with or endorsed by Bungie. Destiny, Vault of Glass and related names belong to Bungie, Inc. No Bungie art, models, fonts or audio are included. Everything is built in code.

Encounter layout references: two community Atheon maps, including one by TheRedDelilah. Mechanics are from community guides ([PCGamesN](https://www.pcgamesn.com/destiny-2/vault-of-glass-guide), [Dexerto](https://www.dexerto.com/destiny/ultimate-destiny-2-vault-of-glass-raid-guide-1578682/), [Destinypedia](https://www.destinypedia.com/Atheon,_Time%27s_Conflux), [Game Rant](https://gamerant.com/destiny-2-how-to-beat-atheon-in-the-vault-of-glass/)). The reference images themselves aren't stored in this repo.
# destiny-raid-clinic
