/** A sequence of values that must be submitted in order (Oracle call-outs, symbol sequences, etc.). */
export interface SequenceCalloutConfig {
  id: string;
  sequence: string[];
}

export type SequenceCalloutStatus = 'pending' | 'correct' | 'failed';

export interface SequenceCalloutState {
  status: SequenceCalloutStatus;
  /** Index into `config.sequence` the next correct callout must match. */
  nextIndex: number;
}

/** A sequence-callout mechanic starts pending at the first item. */
export function initSequenceCalloutState(): SequenceCalloutState {
  return { status: 'pending', nextIndex: 0 };
}

export interface CalloutEvent {
  type: 'callout';
  calloutId: string;
  value: string;
}

/**
 * Advances a sequence-callout mechanic given this tick's callout events. Events for a different
 * `calloutId` are ignored. Once `status` is no longer `'pending'` (resolved correct or failed),
 * the mechanic is frozen — further events are ignored, it never un-resolves.
 * @param config - the callout's id and required value sequence
 * @param state - the mechanic's state before this tick
 * @param events - this tick's callout events, from any source (may include events for other callouts)
 * @returns this tick's resulting state
 */
export function stepSequenceCallout(
  config: SequenceCalloutConfig,
  state: SequenceCalloutState,
  events: CalloutEvent[],
): SequenceCalloutState {
  let current = state;
  for (const event of events) {
    if (current.status !== 'pending') break;
    if (event.calloutId !== config.id) continue;
    const expected = config.sequence[current.nextIndex];
    if (event.value === expected) {
      const nextIndex = current.nextIndex + 1;
      current =
        nextIndex >= config.sequence.length
          ? { status: 'correct', nextIndex }
          : { status: 'pending', nextIndex };
    } else {
      current = { status: 'failed', nextIndex: current.nextIndex };
    }
  }
  return current;
}
