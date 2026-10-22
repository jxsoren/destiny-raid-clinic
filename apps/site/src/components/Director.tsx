// Home: the "Raids" Director (spec §5.1). Planets come from content; this island adds selection,
// the hover tooltip, arrow keys, search, the menu and the zoom-then-open action.
import { Logo, type Prompt, PromptBar, type Rect, Tooltip } from '@raid-clinic/ui';
import {
  nearestInDirection,
  type PlanetScreen,
  type ScenePlanet,
  SpaceScene,
  type View,
  worldPosition,
} from '@raid-clinic/ui/space';
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import type { DirectorRaid } from '../lib/raids';
import './Director.css';

/** Camera zoom when opening a raid, and how long the move takes (spec §3.4). */
const OPEN_ZOOM = 2.6;
const OPEN_MS = 600;
/** Approximate label box for tooltip avoidance (CSS px). */
const LABEL_W = 150;
const LABEL_H = 40;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName));

export function Director(props: {
  planets: ScenePlanet[];
  raids: DirectorRaid[];
  featured: string | null;
  repoUrl: string;
}) {
  let root!: HTMLDivElement;
  let search: HTMLInputElement | undefined;
  const [selected, setSelected] = createSignal<string | null>(
    props.featured ?? props.planets[0]?.id ?? null,
  );
  const [hovered, setHovered] = createSignal<string | null>(null);
  const [screens, setScreens] = createSignal<PlanetScreen[]>([]);
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  const [view, setView] = createSignal<View>({ cx: 0, cy: 0, zoom: 1 });
  const [searching, setSearching] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [menu, setMenu] = createSignal(false);

  const raids = createMemo(() => new Map(props.raids.map((r) => [r.id, r])));
  const matches = createMemo(() => {
    const q = query().trim().toLowerCase();
    return q ? props.raids.filter((r) => r.search.includes(q)).map((r) => r.id) : null;
  });
  const portrait = () => size().w > 0 && size().w < size().h;
  // Phones in portrait: transpose the wide layout so planets don't pile up horizontally.
  const planets = createMemo(() => {
    const hits = matches();
    return props.planets.map((p) => ({
      ...p,
      dimmed: hits ? !hits.includes(p.id) : p.dimmed,
      planet: portrait()
        ? {
            ...p.planet,
            position: [p.planet.position[1], p.planet.position[0]] as [number, number],
          }
        : p.planet,
    }));
  });

  const active = () => hovered() ?? selected();
  const tip = createMemo(() => {
    const id = active();
    const s = screens().find((x) => x.id === id);
    const raid = id ? raids().get(id) : undefined;
    if (!s || !raid || size().w === 0) return null;
    const target: Rect = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
    const avoid: Rect[] = [
      { x: s.labelX, y: s.labelY - LABEL_H / 2, w: LABEL_W, h: LABEL_H },
      ...screens()
        .filter((o) => o.id !== id)
        .flatMap((o) => [
          { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 },
          { x: o.labelX, y: o.labelY - LABEL_H / 2, w: LABEL_W, h: LABEL_H },
        ]),
    ];
    return { raid, target, avoid };
  });

  const open = (id: string | null) => {
    if (!id) return;
    const p = planets().find((x) => x.id === id);
    if (!p) return;
    setSelected(id);
    const { w, h } = size();
    const [cx, cy] = worldPosition(p.planet.position, w && h ? w / h : 16 / 9);
    setView({ cx, cy, zoom: OPEN_ZOOM });
    const reduce =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => window.location.assign(`/raids/${id}/`), reduce ? 0 : OPEN_MS);
  };

  const openSearch = () => {
    setMenu(false);
    setSearching(true);
    queueMicrotask(() => search?.focus());
  };
  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };
  const onEscape = () => {
    if (searching()) closeSearch();
    else setMenu(!menu());
  };

  const prompts = (): Prompt[] => [
    { key: 'F', keys: ['enter'], label: 'Select', onPress: () => open(selected()) },
    { key: '/', label: 'Search', onPress: openSearch },
    { key: 'Esc', label: menu() || searching() ? 'Close' : 'Menu', onPress: onEscape },
  ];

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      const dir = ARROWS[event.key];
      if (
        !dir ||
        menu() ||
        isTyping(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      setHovered(null);
      setSelected(nearestInDirection(screens(), selected(), dir));
    };
    window.addEventListener('keydown', onKey);
    const measure = () => setSize({ w: root.clientWidth, h: root.clientHeight });
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    onCleanup(() => {
      window.removeEventListener('keydown', onKey);
      observer?.disconnect();
    });
  });

  return (
    <div ref={root} class="director" classList={{ 'director--compact': portrait() }}>
      <SpaceScene
        planets={planets()}
        seed={11}
        label="Raids"
        selected={selected()}
        view={view()}
        onLayout={setScreens}
        onHover={setHovered}
        onSelect={(id) => (id === selected() ? open(id) : setSelected(id))}
      >
        <Show when={tip()}>
          {(t) => (
            <Tooltip
              target={t().target}
              avoid={t().avoid}
              viewport={size()}
              title={t().raid.name}
              sub={t().raid.sub}
              cost={t().raid.cost ?? undefined}
            >
              <Show when={t().raid.tagline}>
                <span class="t-flavor">“{t().raid.tagline}”</span>
              </Show>
              <span>{t().raid.statusLine}</span>
            </Tooltip>
          )}
        </Show>

        <Show when={searching()}>
          <div class="director__search">
            <input
              ref={search}
              type="search"
              aria-label="Search raids and encounters"
              placeholder="Search raids"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') open(matches()?.[0] ?? null);
              }}
            />
            <span class="t-status">
              {matches() === null
                ? ''
                : `${matches()?.length ?? 0} match${matches()?.length === 1 ? '' : 'es'}`}
            </span>
          </div>
        </Show>

        <Show when={menu()}>
          <nav class="director__menu" aria-label="Menu">
            <a href="/styleguide/">Styleguide</a>
            <a href={props.repoUrl}>Source on GitHub</a>
          </nav>
        </Show>

        <div class="director__title">
          <h1 class="t-name">Raids</h1>
          <p class="t-type">Select a raid to see its encounters</p>
        </div>
        <div class="director__mark">
          <Logo size={22} decorative />
          <span>Raid Clinic</span>
        </div>
        <PromptBar variant="floating" prompts={prompts()} />
      </SpaceScene>
    </div>
  );
}
