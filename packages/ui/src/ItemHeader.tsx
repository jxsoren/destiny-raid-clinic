import { Dynamic } from 'solid-js/web';
import { Logo } from './Logo';

export function ItemHeader(props: {
  tile: 'logo' | 'arena';
  arenaPath?: string;
  name: string;
  type: string;
  flavor?: string;
  /** Heading level for the name; defaults to 1. */
  level?: 1 | 2 | 3;
}) {
  return (
    <header class="rc-item">
      <div class={`rc-item__tile rc-item__tile--${props.tile}`}>
        {props.tile === 'logo' ? (
          <Logo size={34} decorative />
        ) : (
          <svg
            class="rc-item__arena"
            viewBox="0 0 100 100"
            width="40"
            height="40"
            aria-hidden="true"
          >
            <path d={props.arenaPath ?? ''} />
          </svg>
        )}
      </div>
      <div>
        <Dynamic component={`h${props.level ?? 1}`} class="t-name rc-item__name">
          {props.name}
        </Dynamic>
        <p class="t-type rc-item__type">{props.type}</p>
        {props.flavor && <p class="t-flavor rc-item__flavor">“{props.flavor}”</p>}
      </div>
    </header>
  );
}
