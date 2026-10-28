import { describe, expect, it } from 'vitest';
import {
  calloutEventsFromMessage,
  parseCalloutMessage,
  plateHeldNarration,
} from '../../src/arena/chat';

describe('parseCalloutMessage', () => {
  it('parses space-separated digits', () => {
    expect(parseCalloutMessage('2 5 1')).toEqual(['oracle-2', 'oracle-5', 'oracle-1']);
  });

  it('parses comma-separated digits', () => {
    expect(parseCalloutMessage('2, 5, 1')).toEqual(['oracle-2', 'oracle-5', 'oracle-1']);
  });

  it('parses mixed separators', () => {
    expect(parseCalloutMessage('2,5 1')).toEqual(['oracle-2', 'oracle-5', 'oracle-1']);
  });

  it('drops out-of-range digits', () => {
    expect(parseCalloutMessage('2 7 1 0')).toEqual(['oracle-2', 'oracle-1']);
  });

  it('drops letters and punctuation', () => {
    expect(parseCalloutMessage('two 2 five!')).toEqual(['oracle-2']);
  });

  it('returns an empty array for an empty or fully-invalid message', () => {
    expect(parseCalloutMessage('')).toEqual([]);
    expect(parseCalloutMessage('hello')).toEqual([]);
  });
});

describe('calloutEventsFromMessage', () => {
  it('builds CalloutEvents for the oracle-order mechanic, in the order typed', () => {
    expect(calloutEventsFromMessage('2 5')).toEqual([
      { type: 'callout', calloutId: 'oracle-order', value: 'oracle-2' },
      { type: 'callout', calloutId: 'oracle-order', value: 'oracle-5' },
    ]);
  });

  it('returns an empty array for an unparseable message', () => {
    expect(calloutEventsFromMessage('nothing here')).toEqual([]);
  });
});

describe('plateHeldNarration', () => {
  it('narrates when a plate just became held', () => {
    expect(plateHeldNarration('mars', false, true)).toBe('mars plate held');
  });

  it('returns null when nothing changed', () => {
    expect(plateHeldNarration('mars', true, true)).toBeNull();
    expect(plateHeldNarration('mars', false, false)).toBeNull();
  });

  it('returns null when a plate just became unheld', () => {
    expect(plateHeldNarration('mars', true, false)).toBeNull();
  });
});
