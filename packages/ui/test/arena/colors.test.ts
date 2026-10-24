import type { MechanicsState } from '@raid-clinic/sim';
import { describe, expect, it, vi } from 'vitest';
import { groundColor, litMarkerIds, plateColor } from '../../src/arena/materials';

function mechanicsState(overrides: Partial<MechanicsState> = {}): MechanicsState {
  return {
    plates: {},
    callouts: {},
    wipeTimer: { elapsedUnheld: {} },
    wiped: false,
    wipeReason: null,
    ...overrides,
  };
}

describe('plateColor', () => {
  it('is dark gray when unheld', () => {
    expect(plateColor('mars-plate', false)).toBe(0x2a2a2a);
  });

  it('is the plate-specific lit color when held', () => {
    expect(plateColor('mars-plate', true)).toBe(0xe0704f);
    expect(plateColor('venus-plate', true)).toBe(0xb6c95a);
  });

  it('falls back to white and warns for an unmapped plate id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(plateColor('unknown-plate', true)).toBe(0xffffff);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('litMarkerIds', () => {
  const config = { id: 'oracle-order', sequence: ['oracle-2', 'oracle-5', 'oracle-1'] };

  it('lights the first nextIndex entries of the sequence', () => {
    expect(litMarkerIds(config, { status: 'pending', nextIndex: 2 })).toEqual(
      new Set(['oracle-2', 'oracle-5']),
    );
  });

  it('lights nothing before any callout has resolved', () => {
    expect(litMarkerIds(config, { status: 'pending', nextIndex: 0 })).toEqual(new Set());
  });

  it('lights nothing when the config or state is missing', () => {
    expect(litMarkerIds(undefined, { status: 'pending', nextIndex: 2 })).toEqual(new Set());
    expect(litMarkerIds(config, undefined)).toEqual(new Set());
  });
});

describe('groundColor', () => {
  it('is the wipe color when wiped, regardless of the win window', () => {
    expect(groundColor(mechanicsState({ wiped: true }), true)).toBe(0x5a2626);
    expect(groundColor(mechanicsState({ wiped: true }), false)).toBe(0x5a2626);
  });

  it('is the win color during the win window when not wiped', () => {
    expect(groundColor(mechanicsState(), true)).toBe(0x2d5a2d);
  });

  it("is null otherwise, so callers keep each ground mesh's own per-level color", () => {
    expect(groundColor(mechanicsState(), false)).toBeNull();
  });
});
