import { For, onCleanup, onMount } from 'solid-js';
import { KeyGlyph } from './KeyGlyph';

export interface Prompt {
  key: string;
  label: string;
  onPress?: () => void;
}

const KEY_ALIASES: Record<string, string> = { esc: 'escape' };

export function isCoarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

function matches(prompt: Prompt, event: KeyboardEvent): boolean {
  const want = prompt.key.toLowerCase();
  return event.key.toLowerCase() === (KEY_ALIASES[want] ?? want);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function PromptBar(props: {
  prompts: Prompt[];
  variant?: 'bar' | 'floating';
  touch?: boolean;
}) {
  const touch = () => props.touch ?? isCoarsePointer();
  const onKey = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      isTyping(event.target)
    ) {
      return;
    }
    const prompt = props.prompts.find((p) => matches(p, event));
    if (prompt?.onPress) {
      event.preventDefault();
      prompt.onPress();
    }
  };
  onMount(() => window.addEventListener('keydown', onKey));
  onCleanup(() => window.removeEventListener('keydown', onKey));

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
            aria-keyshortcuts={prompt.key}
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
