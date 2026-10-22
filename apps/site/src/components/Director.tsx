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

  const labelBeside = (o: PlanetScreen): Rect => ({
    x: o.labelX,
    y: o.labelY - LABEL_H / 2,
    w: LABEL_W,
    h: LABEL_H,
  });
  /** Portrait: the label is centered under the planet, shifted left by its x fraction (see CSS). */
  const labelBelow = (o: PlanetScreen): Rect => {
    const px = planets().find((p) => p.id === o.id)?.planet.position[0] ?? 0.5;
    return { x: o.x - px * LABEL_W, y: o.y + o.r * 1.5 + 6, w: LABEL_W, h: LABEL_H };
  };
  /** The active planet's label: measured from the DOM when present, else the computed box. */
  const activeLabel = (id: string, s: PlanetScreen): Rect => {
    const r = root
      ?.querySelector(`[data-planet="${id}"] .rc-planet__label`)
      ?.getBoundingClientRect();
    const origin = root?.getBoundingClientRect();
    if (r && origin && r.width > 0 && r.height > 0) {
      return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
    }
    return portrait() ? labelBelow(s) : labelBeside(s);
  };

  const active = () => hovered() ?? selected();
  const tip = createMemo(() => {
    const id = active();
    const s = screens().find((x) => x.id === id);
    const raid = id ? raids().get(id) : undefined;
    if (!s || !raid || size().w === 0) return null;
    const target: Rect = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
    const body = (o: PlanetScreen): Rect => ({
      x: o.x - o.r,
      y: o.y - o.r,
      w: o.r * 2,
      h: o.r * 2,
    });
    const others = screens().filter((o) => o.id !== id);
    const label = activeLabel(s.id, s);
    // Portrait hides every label but the selected one, which sits below its planet; elsewhere
    // all labels are visible beside their planets.
    const avoid: Rect[] = portrait()
      ? [
          ...(id === selected() ? [label] : []),
          ...others.flatMap((o) => (o.id === selected() ? [body(o), labelBelow(o)] : [body(o)])),
        ]
      : [label, ...others.flatMap((o) => [body(o), labelBeside(o)])];
    return { raid, target, avoid };
  });

  // True from the moment a raid is opening until the page is left (or restored from bfcache).
  let navigating = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = (id: string | null) => {
    if (!id || navigating) return;
    const p = planets().find((x) => x.id === id);
    if (!p) return;
    navigating = true;
    setSelected(id);
    const url = `/raids/${id}/`;
    // The zoom only exists with the live renderer; without it there is nothing to wait for.
    const live = Boolean(root.querySelector('.rc-space--live'));
    const reduce =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!live || reduce) {
      window.location.assign(url);
      return;
    }
    const { w, h } = size();
    const [cx, cy] = worldPosition(p.planet.position, w && h ? w / h : 16 / 9);
    setView({ cx, cy, zoom: OPEN_ZOOM });
    timer = setTimeout(() => window.location.assign(url), OPEN_MS);
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
  let beforeMenu: HTMLElement | null = null;
  const onEscape = () => {
    if (searching()) {
      closeSearch();
    } else if (menu()) {
      setMenu(false);
      beforeMenu?.focus();
      beforeMenu = null;
    } else {
      beforeMenu = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setMenu(true);
      queueMicrotask(() => root.querySelector<HTMLElement>('#director-menu a')?.focus());
    }
  };

  const prompts = (): Prompt[] => [
    { key: 'F', keys: ['enter'], label: 'Select', onPress: () => open(hovered() ?? selected()) },
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
    // Back from a raid can restore this page from the bfcache mid-zoom: reset it.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      navigating = false;
      clearTimeout(timer);
      setView({ cx: 0, cy: 0, zoom: 1 });
    };
    window.addEventListener('pageshow', onPageShow);
    const measure = () => setSize({ w: root.clientWidth, h: root.clientHeight });
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    onCleanup(() => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pageshow', onPageShow);
      clearTimeout(timer);
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
        describedBy="director-tip"
        view={view()}
        onLayout={setScreens}
        onHover={setHovered}
        onSelect={(id) => (id === selected() ? open(id) : setSelected(id))}
      >
        <Show when={tip()}>
          {(t) => (
            <Tooltip
              id="director-tip"
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
            <span class="t-status" aria-live="polite">
              {matches() === null
                ? ''
                : `${matches()?.length ?? 0} match${matches()?.length === 1 ? '' : 'es'}`}
            </span>
          </div>
        </Show>

        <Show when={menu()}>
          <nav id="director-menu" class="director__menu" aria-label="Menu">
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
