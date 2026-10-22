import type { JSX } from 'solid-js';
import { placeTooltip, type Rect, type Size } from './placement';

export function Tooltip(props: {
  target: Rect;
  viewport: Size;
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
  const position = () =>
    placeTooltip(props.target, { w: width(), h: props.height ?? 150 }, props.viewport, props.avoid);
  return (
    <div
      class="rc-tip"
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
