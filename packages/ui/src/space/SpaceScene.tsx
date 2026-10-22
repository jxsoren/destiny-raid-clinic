// The space screen: a lazily loaded three.js renderer with DOM planets on top (labels, status icons,
// selection brackets and buttons). Without 3D, the same DOM draws CSS planets in the same places.
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { SelectionBrackets } from '../SelectionBrackets';
import { AVAILABILITY_LABEL, StatusIcon } from '../StatusIcon';
import { labelClearance, worldRadius } from './layout';
import { pickQuality } from './quality';
import type { SpaceRenderer } from './SpaceRenderer';
import type { PlanetScreen, ScenePlanet, View } from './types';

export interface SpaceSceneProps {
  planets: ScenePlanet[];
  /** Fixes the stars and nebula, so screenshots are stable. */
  seed?: number;
  selected?: string | null;
  /** Camera framing. The first value applies instantly; later changes animate (about 600ms). */
  view?: View;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Planet screen positions, for tooltips and keyboard navigation. */
  onLayout?: (screens: PlanetScreen[]) => void;
  /** Accessible name of the scene, e.g. "Raids". */
  label?: string;
  /** Skip 3D and draw the CSS planets (no-3D mode; also used by tests). */
  fallback?: boolean;
  /** Extra overlay content: title block, tooltip, prompts. */
  children?: JSX.Element;
}

type Mode = 'loading' | 'live' | 'fallback';

const media = (query: string): MediaQueryList | null =>
  typeof matchMedia === 'function' ? matchMedia(query) : null;

function planetLabel(p: ScenePlanet | undefined): string {
  if (!p) return '';
  const status = p.status.map((k) => AVAILABILITY_LABEL[k]).join(', ');
  return `${p.name}, ${p.planet.location}${status ? ` · ${status}` : ''}`;
}

export function SpaceScene(props: SpaceSceneProps) {
  let root!: HTMLDivElement;
  let canvas: HTMLCanvasElement | undefined;
  const [mode, setMode] = createSignal<Mode>(props.fallback ? 'fallback' : 'loading');
  const [renderer, setRenderer] = createSignal<SpaceRenderer>();
  const [screens, setScreens] = createSignal<Record<string, PlanetScreen>>({});
  const [motion, setMotion] = createSignal(true);

  onMount(() => {
    const reduce = media('(prefers-reduced-motion: reduce)');
    setMotion(!reduce?.matches);
    const onMotion = (event: MediaQueryListEvent) => {
      setMotion(!event.matches);
      renderer()?.setMotion(!event.matches);
    };
    reduce?.addEventListener('change', onMotion);
    let disposed = false;
    onCleanup(() => {
      disposed = true;
      reduce?.removeEventListener('change', onMotion);
      renderer()?.dispose();
    });

    if (props.fallback || !canvas) return;
    const target = canvas;
    const quality = pickQuality({
      coarsePointer: media('(pointer: coarse)')?.matches ?? false,
      width: root.clientWidth || 1024,
      cores: navigator.hardwareConcurrency || 4,
      reducedMotion: !motion(),
    });
    import('./SpaceRenderer')
      .then(({ SpaceRenderer }) =>
        SpaceRenderer.create(target, { seed: props.seed ?? 1, quality, reducedMotion: !motion() }),
      )
      .then((r) => {
        if (disposed) {
          r.dispose();
          return;
        }
        r.onFrame((list) => {
          setScreens(Object.fromEntries(list.map((s) => [s.id, s])));
          props.onLayout?.(list);
        });
        setRenderer(r);
        r.setMotion(motion());
        setMode('live');
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn('Space renderer unavailable; showing the static scene.', error);
        setMode('fallback');
      });
  });

  // Size, planets, view and loop once the renderer is ready.
  createEffect(() => {
    const r = renderer();
    if (!r) return;
    const resize = () => {
      const { width, height } = root.getBoundingClientRect();
      r.resize(width, height, globalThis.devicePixelRatio || 1);
    };
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(root);
    // ResizeObserver stays silent when only the DPR changes (e.g. moving to another monitor).
    let dprQuery: MediaQueryList | null = null;
    const onDpr = () => {
      resize();
      arm();
    };
    const disarm = () => dprQuery?.removeEventListener('change', onDpr);
    const arm = () => {
      disarm();
      dprQuery = media(`(resolution: ${globalThis.devicePixelRatio || 1}dppx)`);
      dprQuery?.addEventListener('change', onDpr);
    };
    arm();
    r.start();
    onCleanup(() => {
      observer?.disconnect();
      disarm();
    });
  });
  createEffect(() => renderer()?.setPlanets(props.planets));
  const ids = createMemo(() => props.planets.map((p) => p.id));
  const byId = createMemo(() => new Map(props.planets.map((p) => [p.id, p])));
  let firstView = true;
  createEffect(() => {
    const r = renderer();
    const view = props.view;
    if (!r || !view) return;
    r.setView(view, firstView ? 0 : 600);
    firstView = false;
  });

  const onPointerMove = (event: PointerEvent) => {
    const box = root.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    renderer()?.setPointer(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      ((event.clientY - box.top) / box.height) * 2 - 1,
    );
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is a form control; this is a labelled landmark group
    <div
      ref={root}
      class={`rc-space rc-space--${mode()}`}
      role="group"
      aria-label={props.label ?? 'Space'}
      data-motion={motion() ? 'on' : 'off'}
      data-backend={renderer()?.backend}
      onPointerMove={onPointerMove}
      onPointerLeave={() => renderer()?.setPointer(0, 0)}
    >
      <Show when={mode() !== 'fallback'}>
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas is not focusable; the DOM buttons carry the semantics */}
        <canvas ref={canvas} class="rc-space__canvas" aria-hidden="true" />
      </Show>
      <For each={ids()}>
        {(id) => {
          const p = () => byId().get(id);
          let engaged = false;
          onCleanup(() => {
            if (engaged) props.onHover?.(null);
          });
          const hover = (on: boolean) => {
            engaged = on;
            props.onHover?.(on ? id : null);
          };
          const live = () => (mode() === 'live' ? screens()[id] : undefined);
          const style = () => {
            const planet = p();
            if (!planet) return {};
            const base: JSX.CSSProperties = {
              '--px': String(planet.planet.position[0]),
              '--py': String(planet.planet.position[1]),
              '--r': String(worldRadius(planet.planet, planet.featured)),
              '--clear': String(labelClearance(planet.planet.ring)),
              '--tint': planet.planet.tint,
              '--atmo': planet.planet.atmosphere,
            };
            const s = live();
            return s ? { ...base, left: `${s.x}px`, top: `${s.y}px`, '--d': `${s.r * 2}px` } : base;
          };
          const selected = () => props.selected === id;
          return (
            <div
              class="rc-planet"
              classList={{
                'is-dimmed': Boolean(p()?.dimmed),
                'is-pending': mode() === 'live' && !live(),
                'is-selected': selected(),
                'is-featured': Boolean(p()?.featured),
              }}
              style={style()}
              data-planet={id}
            >
              <button
                type="button"
                class="rc-planet__hit"
                aria-label={planetLabel(p())}
                aria-current={selected() ? 'true' : undefined}
                onClick={() => props.onSelect?.(id)}
                onFocus={() => hover(true)}
                onBlur={() => hover(false)}
                onPointerEnter={() => hover(true)}
                onPointerLeave={() => hover(false)}
              >
                <Show when={mode() !== 'live'}>
                  <span class="rc-planet__orb" />
                </Show>
              </button>
              <Show when={selected()}>
                <span class="rc-planet__brackets">
                  <SelectionBrackets size="100%" />
                </span>
              </Show>
              <div class="rc-planet__label" aria-hidden="true">
                <span class="t-planet">{p()?.name}</span>
                <Show when={(p()?.status.length ?? 0) > 0}>
                  <span class="rc-planet__icons">
                    <For each={p()?.status}>{(kind) => <StatusIcon kind={kind} />}</For>
                  </span>
                </Show>
              </div>
            </div>
          );
        }}
      </For>
      {props.children}
    </div>
  );
}
