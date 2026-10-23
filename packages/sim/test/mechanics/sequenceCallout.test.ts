import { describe, expect, it } from 'vitest';
import { initSequenceCalloutState, stepSequenceCallout } from '../../src/mechanics/sequenceCallout';
import type { CalloutEvent, SequenceCalloutConfig } from '../../src/mechanics/sequenceCallout';

const config: SequenceCalloutConfig = { id: 'oracle-order', sequence: ['left', 'right', 'mid'] };

describe('initSequenceCalloutState', () => {
  it('starts pending at index 0', () => {
    expect(initSequenceCalloutState()).toEqual({ status: 'pending', nextIndex: 0 });
  });
});

describe('stepSequenceCallout', () => {
  it('advances one step on a correct callout', () => {
    const state = initSequenceCalloutState();
    const events: CalloutEvent[] = [{ type: 'callout', calloutId: 'oracle-order', value: 'left' }];
    expect(stepSequenceCallout(config, state, events)).toEqual({ status: 'pending', nextIndex: 1 });
  });

  it('resolves to correct once the full sequence is submitted, across multiple calls', () => {
    let state = initSequenceCalloutState();
    state = stepSequenceCallout(config, state, [
      { type: 'callout', calloutId: 'oracle-order', value: 'left' },
    ]);
    state = stepSequenceCallout(config, state, [
      { type: 'callout', calloutId: 'oracle-order', value: 'right' },
    ]);
    state = stepSequenceCallout(config, state, [
      { type: 'callout', calloutId: 'oracle-order', value: 'mid' },
    ]);
    expect(state).toEqual({ status: 'correct', nextIndex: 3 });
  });

  it('fails on a wrong value', () => {
    const state = initSequenceCalloutState();
    const events: CalloutEvent[] = [{ type: 'callout', calloutId: 'oracle-order', value: 'right' }];
    expect(stepSequenceCallout(config, state, events)).toEqual({ status: 'failed', nextIndex: 0 });
  });

  it('ignores further events once failed', () => {
    let state = initSequenceCalloutState();
    state = stepSequenceCallout(config, state, [
      { type: 'callout', calloutId: 'oracle-order', value: 'right' },
    ]);
    expect(state.status).toBe('failed');
    state = stepSequenceCallout(config, state, [
      { type: 'callout', calloutId: 'oracle-order', value: 'left' },
    ]);
    expect(state).toEqual({ status: 'failed', nextIndex: 0 });
  });

  it('ignores further events once correct', () => {
    let state: ReturnType<typeof initSequenceCalloutState> = {
      status: 'correct',
      nextIndex: 3,
    };
    state = stepSequenceCallout(config, state, [
      { type: 'callout', calloutId: 'oracle-order', value: 'left' },
    ]);
    expect(state).toEqual({ status: 'correct', nextIndex: 3 });
  });

  it('ignores callout events meant for a different callout id', () => {
    const state = initSequenceCalloutState();
    const events: CalloutEvent[] = [
      { type: 'callout', calloutId: 'some-other-callout', value: 'left' },
    ];
    expect(stepSequenceCallout(config, state, events)).toEqual({ status: 'pending', nextIndex: 0 });
  });
});
