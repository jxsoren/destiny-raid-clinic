// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RaidDirector } from '../src/components/RaidDirector';
import type { RaidSummary } from '../src/lib/raids';

// The renderer has its own GPU/fallback tests. These tests exercise real encounter controls.
vi.mock('@raid-clinic/ui/space', () => ({ SpaceScene: () => <div /> }));
afterEach(cleanup);

const raid: RaidSummary = {
  id: 'test-raid',
  name: 'Test Raid',
  released: null,
  location: 'Venus',
  tagline: '',
  planet: {
    surface: 'venus',
    tint: '',
    atmosphere: '',
    ring: false,
    size: 1,
    position: [0.5, 0.5],
    location: 'Venus',
    tagline: '',
  },
  encounters: [
    { id: 'first', name: 'First encounter', order: 1, trainer: false, guide: false },
    { id: 'second', name: 'Second encounter', order: 2, trainer: true, guide: false },
    { id: 'third', name: 'Third encounter', order: 3, trainer: false, guide: true },
  ],
};

const details = () => within(screen.getByRole('region', { name: 'Selected encounter' }));

describe('raid encounter selection', () => {
  it('selects the first playable encounter and exposes its launch control', () => {
    render(() => <RaidDirector raid={raid} />);
    expect(screen.getByRole('button', { name: 'Second encounter: Playable' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(details().getByRole('heading', { name: 'Second encounter' })).toBeVisible();
    expect(details().getByRole('button', { name: /Launch trainer/ })).toBeVisible();
  });

  it('selects unavailable encounters without offering a launch or nonexistent guide link', () => {
    render(() => <RaidDirector raid={raid} />);
    fireEvent.click(screen.getByRole('button', { name: 'First encounter: Coming soon' }));
    expect(
      details().getByText('This encounter does not have a guide or trainer yet.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /Launch trainer/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Third encounter: Guide' }));
    expect(details().getByText(/A guide is prepared/)).toBeVisible();
    expect(details().queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Launch trainer/ })).not.toBeInTheDocument();
  });

  it('moves selection and focus with arrows, wraps, and supports Home and End', () => {
    render(() => <RaidDirector raid={raid} />);
    const first = screen.getByRole('button', { name: 'First encounter: Coming soon' });
    const second = screen.getByRole('button', { name: 'Second encounter: Playable' });
    const third = screen.getByRole('button', { name: 'Third encounter: Guide' });
    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowDown' });
    expect(third).toHaveFocus();
    expect(third).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(third, { key: 'ArrowRight' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(third).toHaveFocus();
    fireEvent.keyDown(third, { key: 'Home' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'End' });
    expect(third).toHaveFocus();
  });

  it('falls back to the first encounter when no trainers exist, and handles an empty raid', () => {
    const view = render(() => (
      <RaidDirector raid={{ ...raid, encounters: [raid.encounters[0]] }} />
    ));
    expect(screen.getByRole('button', { name: 'First encounter: Coming soon' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    view.unmount();
    render(() => <RaidDirector raid={{ ...raid, encounters: [] }} />);
    expect(screen.getByText(/No encounters are available/)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Selected encounter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Launch trainer/ })).not.toBeInTheDocument();
  });
});
