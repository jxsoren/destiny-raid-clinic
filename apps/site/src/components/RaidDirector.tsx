import { ItemHeader, PerkNode } from '@raid-clinic/ui';
import { SpaceScene } from '@raid-clinic/ui/space';
import { For, Show } from 'solid-js';
import type { RaidSummary } from '../lib/raids';
import { BackPrompt } from './BackPrompt';
import './RaidDirector.css';

export function RaidDirector(props: { raid: RaidSummary }) {
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
            <ol class="raid-director__path">
              <For each={props.raid.encounters}>
                {(encounter) => (
                  <li>
                    <PerkNode
                      state={encounter.trainer ? 'playable' : encounter.guide ? 'guide' : 'soon'}
                      label={String(encounter.order).padStart(2, '0')}
                      title={encounter.name}
                    />
                    <div>
                      <Show
                        when={encounter.trainer}
                        fallback={<span class="t-label">{encounter.name}</span>}
                      >
                        <a
                          class="raid-director__encounter-link t-label"
                          href={`/raids/${props.raid.id}/${encounter.id}/trainer/`}
                        >
                          {encounter.name}
                        </a>
                      </Show>
                      <p class="t-status">
                        {encounter.trainer ? 'Trainer available' : 'Trainer unavailable'}
                      </p>
                    </div>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </section>
      </div>
      <BackPrompt />
    </div>
  );
}
