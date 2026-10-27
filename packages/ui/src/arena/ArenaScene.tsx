// The Atheon arena screen: a lazily loaded three.js renderer driving a scripted entity through the
// real engine/mechanics pipeline. Mirrors SpaceScene.tsx's lifecycle shape, but with no
// CSS-equivalent fallback — there's nothing meaningful to show for a mechanics trainer without 3D.

import type { ArenaDef, EncounterMechanicsConfig } from '@raid-clinic/sim';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import type { ArenaRenderer, Marker } from './ArenaRenderer';
import type { EncounterLevelsContent } from './levels';

export interface ArenaSceneProps {
  arena: ArenaDef;
  mechanics: EncounterMechanicsConfig;
  markers: Marker[];
  levels: EncounterLevelsContent;
}

type Mode = 'loading' | 'live' | 'error';

export function ArenaScene(props: ArenaSceneProps) {
  let root!: HTMLDivElement;
  let canvas: HTMLCanvasElement | undefined;
  const [mode, setMode] = createSignal<Mode>('loading');

  onMount(() => {
    let disposed = false;
    let renderer: ArenaRenderer | undefined;
    onCleanup(() => {
      disposed = true;
      renderer?.dispose();
    });

    if (!canvas) return;
    const target = canvas;
    import('./ArenaRenderer')
      .then(({ ArenaRenderer }) =>
        ArenaRenderer.create(target, props.arena, props.mechanics, props.markers, props.levels),
      )
      .then((r) => {
        if (disposed) {
          r.dispose();
          return;
        }
        renderer = r;
        const resize = () => {
          const { width, height } = root.getBoundingClientRect();
          r.resize(width, height, globalThis.devicePixelRatio || 1);
        };
        resize();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
        observer?.observe(root);
        onCleanup(() => observer?.disconnect());
        r.start();
        setMode('live');
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn('Arena renderer unavailable.', error);
        setMode('error');
      });
  });

  return (
    <div ref={root} class="rc-arena">
      <Show when={mode() !== 'error'}>
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas is not focusable */}
        <canvas ref={canvas} class="rc-arena__canvas" aria-hidden="true" />
      </Show>
      <Show when={mode() === 'error'}>
        <p class="rc-arena__error">3D rendering isn't available in this browser.</p>
      </Show>
    </div>
  );
}
