// Pure helpers for Atheon's Caller chat overlay: parsing typed callouts into engine events, and
// narrating bot plate-hold state into chat lines. No DOM, no three.js — see
// docs/superpowers/specs/2026-10-28-atheon-chat-callout-input-design.md.
import type { CalloutEvent } from '@raid-clinic/sim';

/** The callout mechanic's id in Atheon's real content — this module is specific to that content. */
const ORACLE_CALLOUT_ID = 'oracle-order';

/** Parses a typed chat message into the Oracle values it names, in the order typed — splitting on
 * whitespace/commas and keeping only digits 1-6, silently dropping everything else (letters,
 * out-of-range digits, stray punctuation). An empty or fully-invalid message yields an empty array. */
export function parseCalloutMessage(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .filter((token) => /^[1-6]$/.test(token))
    .map((digit) => `oracle-${digit}`);
}

/** The `CalloutEvent`s a typed message should submit to the `oracle-order` mechanic, built from its
 * parsed Oracle values. */
export function calloutEventsFromMessage(text: string): CalloutEvent[] {
  return parseCalloutMessage(text).map((value) => ({
    type: 'callout',
    calloutId: ORACLE_CALLOUT_ID,
    value,
  }));
}

/** A narration line for a plate that just became held (e.g. `"mars plate held"`), or `null` if it
 * didn't just become held (no change, or it just became unheld — "held" is the noteworthy event in
 * this scope; see the design spec for why no "lost" message is needed). `label` is the
 * human-readable plate name (e.g. `"mars"` for `mars-plate`), not the raw plate id. */
export function plateHeldNarration(label: string, wasHeld: boolean, isHeld: boolean): string | null {
  return !wasHeld && isHeld ? `${label} plate held` : null;
}
