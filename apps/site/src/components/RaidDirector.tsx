import {
  AVAILABILITY_LABEL,
  Button,
  Divider,
  ItemHeader,
  PerkNode,
  type Prompt,
  PromptBar,
} from '@raid-clinic/ui';
import { SpaceScene } from '@raid-clinic/ui/space';
import { createMemo, createSignal, For, Show } from 'solid-js';
import type { EncounterSummary, RaidSummary } from '../lib/raids';
import './RaidDirector.css';

const availability = (encounter: EncounterSummary) =>
  encounter.trainer ? 'playable' : encounter.guide ? 'guide' : 'soon';

export function RaidDirector(props: { raid: RaidSummary }) {
  let path: HTMLOListElement | undefined;
  const [selectedId, setSelectedId] = createSignal(
    props.raid.encounters.find((encounter) => encounter.trainer)?.id ??
      props.raid.encounters[0]?.id,
  );
  const selected = createMemo(() =>
    props.raid.encounters.find((encounter) => encounter.id === selectedId()),
  );
  const launch = () => {
    const encounter = selected();
    if (encounter?.trainer)
      window.location.assign(`/raids/${props.raid.id}/${encounter.id}/trainer/`);
  };
  const prompts = (): Prompt[] => [
    ...(selected()?.trainer ? [{ key: 'E', label: 'Launch trainer', onPress: launch }] : []),
    { key: 'Esc', label: 'Back to raids', onPress: () => window.location.assign('/') },
  ];
  const onPathKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = Array.from(path?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight')
      next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft')
      next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    const encounter = props.raid.encounters[next];
    if (encounter) setSelectedId(encounter.id);
    buttons[next]?.focus();
  };

  return (
    <div class="raid-director">
      <div class="raid-director__space" aria-hidden="true" inert>
        <SpaceScene
          seed={11}
          planets={[
            {
              id: props.raid.id,
              name: '',
              status: [],
              planet: { ...props.raid.planet, position: [0.5, 0.5], size: 5.2 },
            },
          ]}
        />
      </div>
      <div class="raid-director__content">
        <a class="raid-director__back t-head" href="/">
          ← Back to raids
        </a>
        <ItemHeader
          tile="arena"
          arenaPath="M15 75V25L50 10L85 25V75L50 90ZM15 25L50 45L85 25M50 45V90"
          name={props.raid.name}
          type={`${props.raid.location} · Raid`}
          flavor={props.raid.tagline || undefined}
        />
        <section class="raid-director__encounters" aria-labelledby="encounters-heading">
          <p class="t-status">Learn it before the pull.</p>
          <h2 id="encounters-heading" class="t-head">
            Encounters
          </h2>
          <Show
            when={props.raid.encounters.length > 0}
            fallback={
              <p class="raid-director__empty">
                No encounters are available for this raid yet. Choose another raid to find a
                trainer.
              </p>
            }
          >
            <p class="raid-director__hint">Choose an encounter to practice.</p>
            <ol ref={path} class="raid-director__path" onKeyDown={onPathKey}>
              <For each={props.raid.encounters}>
                {(encounter) => (
                  <li>
                    <button
                      type="button"
                      class="raid-director__node"
                      aria-pressed={selectedId() === encounter.id}
                      aria-controls="encounter-details"
                      aria-label={`${encounter.name}: ${AVAILABILITY_LABEL[availability(encounter)]}`}
                      onClick={() => setSelectedId(encounter.id)}
                    >
                      <PerkNode
                        state={availability(encounter)}
                        selected={selectedId() === encounter.id}
                        label={String(encounter.order).padStart(2, '0')}
                        title={encounter.name}
                      />
                      <span>
                        <span class="t-label">{encounter.name}</span>
                        <span class="raid-director__availability t-status">
                          {AVAILABILITY_LABEL[availability(encounter)]}
                        </span>
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ol>
            <Show when={selected()}>
              {(encounter) => (
                <section
                  id="encounter-details"
                  class="raid-director__details"
                  aria-label="Selected encounter"
                  aria-live="polite"
                >
                  <Divider />
                  <p class="t-status">Encounter {String(encounter().order).padStart(2, '0')}</p>
                  <h3 class="t-name">{encounter().name}</h3>
                  <Show
                    when={encounter().trainer}
                    fallback={
                      <p class="raid-director__hint">
                        {encounter().guide
                          ? 'A guide is prepared. Reading it here and training this encounter are not available yet.'
                          : 'This encounter does not have a guide or trainer yet.'}
                      </p>
                    }
                  >
                    <p class="raid-director__hint">Open the trainer to explore this encounter.</p>
                    <Button
                      variant="primary"
                      glyph="E"
                      aria-label="Launch trainer"
                      onClick={launch}
                    >
                      Launch trainer
                    </Button>
                  </Show>
                </section>
              )}
            </Show>
          </Show>
        </section>
      </div>
      <PromptBar variant="floating" prompts={prompts()} />
    </div>
  );
}
