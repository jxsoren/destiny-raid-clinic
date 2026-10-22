import { createSignal, For, onCleanup, onMount } from 'solid-js';
import { KeyGlyph } from './KeyGlyph';

export interface Prompt {
  /** Displayed glyph, and the default key that triggers the prompt. */
  key: string;
  /** Extra keys that also trigger the prompt (same names as `key`, e.g. 'enter', 'space'). */
  keys?: string[];
  label: string;
  onPress?: () => void;
}

const KEY_ALIASES: Record<string, string> = { esc: 'escape', enter: 'enter', space: ' ' };
const ARIA_NAMES: Record<string, string> = { esc: 'Escape', enter: 'Enter', space: 'Space' };

function ariaKey(key: string): string {
  const lower = key.toLowerCase();
  return ARIA_NAMES[lower] ?? (key.length === 1 ? key.toUpperCase() : key);
}

export function isCoarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

function matches(prompt: Prompt, event: KeyboardEvent): boolean {
  const pressed = event.key.toLowerCase();
  return [prompt.key, ...(prompt.keys ?? [])].some((k) => {
    const want = k.toLowerCase();
    return pressed === (KEY_ALIASES[want] ?? want);
  });
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Keyboard-driven action bar. Mount one PromptBar per screen: each instance installs its own
 * window keydown listener, so two bars would both fire on the same key.
 */
export function PromptBar(props: {
  prompts: Prompt[];
  variant?: 'bar' | 'floating';
  touch?: boolean;
}) {
  // Always false on the server and during hydration (Solid skips attribute writes while
  // hydrating), so the real value is read after mount.
  const [coarse, setCoarse] = createSignal(false);
  const touch = () => props.touch ?? coarse();
  const onKey = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.repeat ||
      (isTyping(event.target) && event.key !== 'Escape')
    ) {
      return;
    }
    const prompt = props.prompts.find((p) => matches(p, event));
    if (prompt?.onPress) {
      event.preventDefault();
      prompt.onPress();
    }
  };
  onMount(() => {
    window.addEventListener('keydown', onKey);
    setCoarse(isCoarsePointer());
    if (typeof matchMedia !== 'function') return;
    const mql = matchMedia('(pointer: coarse)');
    const onChange = () => setCoarse(mql.matches);
    mql.addEventListener?.('change', onChange);
    onCleanup(() => mql.removeEventListener?.('change', onChange));
  });
  onCleanup(() => {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
  });

  return (
    <nav
      class={`rc-prompts rc-prompts--${props.variant ?? 'bar'}`}
      data-touch={String(touch())}
      aria-label="Actions"
    >
      <For each={props.prompts}>
        {(prompt) => (
          <button
            type="button"
            class="rc-prompt"
            aria-keyshortcuts={ariaKey(prompt.key)}
            onClick={() => prompt.onPress?.()}
          >
            <KeyGlyph label={prompt.key} />
            {prompt.label}
          </button>
        )}
      </For>
    </nav>
  );
}
