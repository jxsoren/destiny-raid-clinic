import { For } from 'solid-js';

export function StatsStrip(props: { items: { value: string; label: string }[] }) {
  return (
    <dl class="rc-stats">
      <For each={props.items}>
        {(item) => (
          <div>
            <dt class="t-status">{item.label}</dt>
            <dd class="t-big">{item.value}</dd>
          </div>
        )}
      </For>
    </dl>
  );
}
