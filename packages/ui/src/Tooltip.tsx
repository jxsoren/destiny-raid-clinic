import { createMemo, createSignal, type JSX, onCleanup, onMount } from 'solid-js';
import { placeTooltip, type Rect, type Size } from './placement';

/**
 * `target`, `avoid` and `viewport` are viewport coordinates (getBoundingClientRect and
 * innerWidth/innerHeight), because `.rc-tip` is `position: fixed`. Pass `contained` to use
 * `position: absolute` instead, with the nearest positioned ancestor as the origin; then give
 * the coordinates relative to that ancestor and its size as `viewport`.
 * Height is measured after mount; `height` (default 150) is used until then and under SSR.
 */
export function Tooltip(props: {
  target: Rect;
  viewport: Size;
  contained?: boolean;
  avoid?: Rect[];
  width?: number;
  height?: number;
  title: string;
  sub?: string;
  cost?: { label: string; value: string };
  id?: string;
  children?: JSX.Element;
}) {
  const width = () => props.width ?? 260;
  const [measured, setMeasured] = createSignal(0);
  const position = createMemo(() =>
    placeTooltip(
      props.target,
      { w: width(), h: measured() || (props.height ?? 150) },
      props.viewport,
      props.avoid,
    ),
  );
  let el: HTMLDivElement | undefined;
  onMount(() => {
    if (!el) return;
    const measure = () => setMeasured(el?.offsetHeight ?? 0);
    measure();
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    }
  });
  return (
    <div
      ref={el}
      class={props.contained ? 'rc-tip rc-tip--contained' : 'rc-tip'}
      role="tooltip"
      id={props.id}
      data-side={position().side}
      style={{ left: `${position().x}px`, top: `${position().y}px`, width: `${width()}px` }}
    >
      <div class="rc-tip__title">
        {props.title}
        {props.sub && <span class="rc-tip__sub">{props.sub}</span>}
      </div>
      {props.children && <div class="rc-tip__body">{props.children}</div>}
      {props.cost && (
        <div class="rc-tip__cost">
          <span>
            <span class="rc-cube" aria-hidden="true" />
            {props.cost.label}
          </span>
          <b>{props.cost.value}</b>
        </div>
      )}
    </div>
  );
}
