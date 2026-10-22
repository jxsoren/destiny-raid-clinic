# Raid Clinic styleguide

This is the source of truth for how Raid Clinic looks, reads and behaves. It is written for both people and AI agents. Every raid page, encounter briefing and guide follows it. See every token and component live at `/styleguide` (`just dev`, then http://localhost:4321/styleguide).

## Rules agents must follow

1. **Never hard-code a color or font.** Use a token from `packages/ui/src/tokens.css` (`var(--brass)`, `var(--font-ui)`). `just lint` fails otherwise. The only exceptions are planet colors in `raid.json` and shader files under a `shaders/` folder.
2. **Use the components in `@raid-clinic/ui`.** Don't restyle them locally and don't copy their CSS. If one is missing something, change the component and its test.
3. **Never call the site a fan project** anywhere in the UI (`just lint` rejects that wording). The legal line "Not affiliated with Bungie" belongs on the About page only, once it exists.
4. **Add raids and encounters with `just new-raid` and `just new-encounter`.** Never by hand.
5. **Run `just check`** before every commit.

## Brand

- **Name:** Raid Clinic. As a mark: Roboto 700, uppercase, letter-spacing .18em. As a page title: the Name role.
- **Logo:** `<Logo />`, a white diamond outline with a brass core. On the gold item tile, both parts turn dark.
- **Site tagline:** "Learn it before the pull."
- **Raid flavor lines:** each raid's real, well-known tagline, stored in `raid.json` `planet.tagline` (Vault of Glass: "Guardians make their own fate."). Never quote longer lore text.
- **Voice:** short, plain and confident. Use the words players use (pull, wipe, callout, DPS, plate, seat). No marketing filler and no exclamation marks.

## Color tokens

| Token | Use |
|---|---|
| `--void` | Every page background |
| `--haze` | Soft haze at the top of space screens |
| `--panel` | Small translucent panels (status icons) |
| `--brass` | Arena lines, logo core, construction accents |
| `--glow` | White light sources, links on the void |
| `--gold-hi` `--gold-lo` `--gold-edge` | Featured highlights, item tile, boss bar, phase markers |
| `--perk-blue` | Playable |
| `--live` | Positive or live states, tooltip cost row |
| `--done` | Completed |
| `--danger` | Wipes and debuffs |
| `--perk-pale` `--perk-pale-ink` | Guide-only status |
| `--perk-ghost` `--perk-ghost-edge` `--perk-ghost-ink` | Coming-soon status |
| `--ink` `--ink-dark` `--muted` | Text, text on white buttons, secondary text |
| `--frame` `--divider` | Selection frames and dividers |
| `--tip-title` `--tip-body` `--tip-text` `--tip-edge` `--tip-shadow` | Tooltips and info panels |
| `--cube-hi` `--cube-lo` | Tooltip cost-row cube |
| `--prompt` `--prompt-ink` `--round-bg` | Prompt bar, key glyphs, round buttons |

There is one theme, dark. Raid colors (planet tints, Mars red and Venus green gates) are content, not tokens.

## Type

Roboto only (self-hosted, weights 300, 300 italic, 400, 500 and 700). Use the role classes from `roles.css`:

| Class | Use |
|---|---|
| `.t-name` | Page, raid, encounter and phase titles (bold caps) |
| `.t-type` | The type line under a name ("Venus · Raid") |
| `.t-flavor` | Taglines, in curly quotes |
| `.t-head` | Section headings, labels on nodes, button text |
| `.t-status` | Small caps status text and stat labels |
| `.t-big` | Big numbers |
| `.t-label` | Medium-weight labels |
| `.t-planet` | Planet labels on space screens |

Body text is 400 at 15px with line-height 1.55. Don't add other typefaces or invent new roles.

## Components

Import from `@raid-clinic/ui`:

| Component | Use |
|---|---|
| `ItemHeader` | Top-left of every page: tile (`logo` or `arena`), Name, Type, Flavor |
| `Tooltip` | Thorn-style card for raids, encounters and info. Positions itself; pass `avoid` rects so it never covers planets |
| `PromptBar` | Bottom prompts with real keyboard shortcuts (`F`, `E`, `Esc`, `/`). `variant="floating"` on space screens |
| `KeyGlyph` | A key pill inside text or buttons |
| `Button` | `primary` (solid white), `secondary` (outline), `round` (26px circle) |
| `PerkNode` | Encounter nodes: `playable`, `guide`, `soon`, `done`, plus `selected` |
| `StatusIcon` | The small square icons next to planet labels |
| `SelectionBrackets` | D1 corner brackets around the selected planet |
| `StatsStrip` | Big-number stats (seats, sets, damage window) |
| `PhaseHeading` | Gold kicker plus title for each phase in a briefing |
| `Divider` | 2px rule, max-width 700px |
| `Logo` | The mark |

Shapes:
- Panels are square.
- Circles are only for planets, perk nodes, round buttons and key glyphs.
- Hover and focus show a 2px white frame. Planets use corner brackets.

## Space scenes

Every space screen (the Director, raid pages) uses `SpaceScene` from `@raid-clinic/ui/space`. Never draw planets, stars or nebula any other way.

- **Import:** `import { SpaceScene } from '@raid-clinic/ui/space'` plus `import '@raid-clinic/ui/space.css'`. Render it with `client:only="solid-js"`. It loads three.js lazily and falls back to CSS planets in the same positions when WebGPU and WebGL2 are both unavailable.
- **Planets** come from each raid's `planet` block in `raid.json`: surface, tint, atmosphere, ring, size, position, location and tagline. Pass them as `ScenePlanet` objects with `status`, plus `featured` (the newest playable raid) and `dimmed` (nothing playable).
- **Overlay:** labels, status icons, brackets and hit areas are DOM, positioned from the renderer. Use `onLayout` for tooltips and keyboard navigation, and `onHover` and `onSelect` for interaction. Put the title block, tooltip and prompts in `children`.
- **Camera:** `view` (`{ cx, cy, zoom }`) frames the camera. The first value applies instantly; changes animate over about 600ms (cut with reduced motion).
- **Height:** the scene fills its parent (`height: 100%` with `container-type: size`), so the parent must have an explicit height or the scene collapses to 0. The CSS fallback always shows the home view (it ignores `view`).
- **Colors:** shader colors live in `packages/ui/src/space/shaders/` (`palette.ts`). It is the only place outside `tokens.css` where color literals are allowed.
- **Motion:** planets spin slowly, clouds drift, stars twinkle, and the pointer adds up to 8px of parallax. `prefers-reduced-motion` turns all of it off.
- **Performance:** quality drops automatically on phones, small screens and weak CPUs (fewer stars, cheaper noise, no parallax). Check renderer changes on a real GPU before merging.
- See it live: `/styleguide`, under "Space scene".

## Pages

- **Home (Raids):**
  - Every raid is a planet on a space background in the Destiny 1 Director style.
  - The title block "RAIDS" sits bottom-left, the wordmark bottom-right, and floating prompts `F Select` and `/ Search` sit bottom-center.
  - There is no top nav.
  - Raids with nothing playable are dimmed.
- **Raid page:**
  - The raid's planet sits large on the right.
  - The encounters are perk nodes along a dotted path in raid order.
  - The ItemHeader uses the `arena` tile.
  - Prompts: `F Open briefing`, `E Take a seat` (playable only) and `Esc Back to raids`.
- **Encounter briefing:**
  - The guide is on the left, and the live sim on the right follows the section you're reading.
  - Each phase has a `Play this moment` button.
  - On phones the sim becomes a sticky strip above the text.
  - Guide-only encounters show a static brass arena map instead of the sim.
- **Trainer:** full-screen sim with a HUD built from these tokens and roles, and a prompt bar.

## Motion and accessibility

- **Motion on space screens:** planets rotate slowly, stars twinkle, slight parallax, and a zoom into the selected planet. Tooltips fade in over 120ms.
- **Reduced motion:** `prefers-reduced-motion` turns all of it off (roles.css already stops CSS animation; renderers must check it too).
- **Keyboard:** every action has a keyboard path. Arrow keys move between planets and nodes.
- **Images:** every image-like status (perk nodes, status icons) has an accessible label.

## Checklist: add a raid

1. Run `just new-raid <id> "<Name>" "<Location>"`.
2. In `content/raids/<id>/raid.json`, fill in `planet`:
   - `surface`: one of venus, gas, ice, moon, lush, lush-dark, violet, pale, desert;
   - `tint` and `atmosphere`: `#rrggbb` colors that match where the raid takes place;
   - `ring`;
   - `size`: 0.5–1.6;
   - `position`: a Director spot at least 0.12 from other planets;
   - `tagline`.
3. Fill in `released`, `glossary` and `sources`, and the raid `guide.mdoc`.
4. Run `just check`.

## Checklist: add an encounter

1. Run `just new-encounter <raid> <NN> <id> "<Name>"`.
2. Fill in `encounter.json` (arena, markers, roles, phases, mechanics, wipe conditions, damage, drills) from cited sources in `sources.md`.
3. Write `guide.mdoc` in the fixed section order. Each phase gets a `###` heading that matches the data, and generated sections stay as their `{% … /%}` tags.
4. Give each phase a sim moment (start state) so the briefing can sync and `Play this moment` works.
5. Run `just check`.

## Do and don't

- Do: `color: var(--muted)`. Don't: `color: #9aa3ad`.
- Do: `<Tooltip …>`. Don't: a hand-made dark box with a title strip.
- Do: "Hold the plate". Don't: "Make sure you hold the plate!!"
- Do: link and credit reference maps in `sources.md`. Don't: commit someone else's images.
