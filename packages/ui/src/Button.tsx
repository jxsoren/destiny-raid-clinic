import type { JSX } from 'solid-js';
import { KeyGlyph } from './KeyGlyph';

export type ButtonVariant = 'primary' | 'secondary' | 'round';

export function Button(props: {
  variant?: ButtonVariant;
  glyph?: string;
  disabled?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
  children?: JSX.Element;
}) {
  return (
    <button
      type="button"
      class={`rc-btn rc-btn--${props.variant ?? 'secondary'}`}
      disabled={props.disabled}
      aria-label={props['aria-label']}
      onClick={() => props.onClick?.()}
    >
      {props.glyph && <KeyGlyph label={props.glyph} />}
      {props.children}
    </button>
  );
}
