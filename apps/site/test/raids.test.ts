import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  featuredRaid,
  loadRaids,
  raidCost,
  raidStatus,
  raidStatusLine,
  raidSub,
  toDirector,
} from '../src/lib/raids';

const CONTENT = fileURLToPath(new URL('./fixtures/content/raids', import.meta.url));
const TRAINERS = ['alpha/first'];

describe('loadRaids', () => {
  const raids = loadRaids(CONTENT, TRAINERS);

  it('reads every raid, oldest first, with its encounters in order', () => {
    expect(raids.map((r) => r.id)).toEqual(['alpha', 'beta', 'gamma']);
    expect(raids[0].encounters).toEqual([
      { id: 'first', name: 'The First', order: 1, guide: true, trainer: true },
      { id: 'second', name: 'The Second', order: 2, guide: false, trainer: false },
    ]);
    expect(raids[2].encounters).toEqual([]);
    expect(raids[0].location).toBe('Venus');
    expect(raids[0].tagline).toBe('Alpha line.');
  });

  it('derives status: trainers make a raid playable, published guides add guide, else soon', () => {
    expect(raidStatus(raids[0])).toEqual(['playable', 'guide']);
    expect(raidStatus(raids[1])).toEqual(['guide']);
    expect(raidStatus(raids[2])).toEqual(['soon']);
  });

  it('features the newest raid with a trainer', () => {
    expect(featuredRaid(raids)).toBe('alpha');
    expect(featuredRaid(raids.slice(1))).toBeNull();
  });

  it('writes the tooltip lines', () => {
    expect(raidSub(raids[0])).toBe('Venus · Raid · 2 encounters');
    expect(raidSub(raids[1])).toBe('Europa · Raid · 1 encounter');
    expect(raidSub(raids[2])).toBe('The Pale Heart · Raid');
    expect(raidStatusLine(raids[0])).toBe('1 encounter has a playable trainer. 1 guide is ready.');
    expect(raidStatusLine(raids[1])).toBe('1 guide is ready.');
    expect(raidStatusLine(raids[2])).toBe('Guides and trainers are on the way.');
    expect(raidCost(raids[0])).toEqual({ label: 'Trainer', value: '1 / 2' });
    expect(raidCost(raids[1])).toBeNull();
  });

  it('builds the Director props: planets dimmed unless playable, one featured, search text', () => {
    const d = toDirector(raids);
    expect(d.featured).toBe('alpha');
    expect(d.planets.map((p) => [p.id, p.status, Boolean(p.dimmed), Boolean(p.featured)])).toEqual([
      ['alpha', ['playable', 'guide'], false, true],
      ['beta', ['guide'], true, false],
      ['gamma', ['soon'], true, false],
    ]);
    expect(d.raids[0]).toMatchObject({
      id: 'alpha',
      name: 'Alpha Raid',
      sub: 'Venus · Raid · 2 encounters',
      tagline: 'Alpha line.',
      cost: { label: 'Trainer', value: '1 / 2' },
    });
    expect(d.raids[0].search).toContain('alpha raid');
    expect(d.raids[0].search).toContain('venus');
    expect(d.raids[0].search).toContain('the first');
  });
});
