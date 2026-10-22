import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
vi.mock('../src/space/SpaceRenderer', () => ({
  SpaceRenderer: { create: (...args: unknown[]) => create(...args) },
}));

import { SpaceScene } from '../src/space/SpaceScene';
import type { PlanetScreen, ScenePlanet } from '../src/space/types';

const VOG: ScenePlanet = {
  id: 'vog',
  name: 'Vault of Glass',
  status: ['playable', 'guide'],
  featured: true,
  planet: {
    surface: 'venus',
    tint: '#d9b46a', // lint-allow-color
    atmosphere: '#ffd690', // lint-allow-color
    ring: false,
    size: 1,
    position: [0.47, 0.46],
    location: 'Venus',
    tagline: 'Guardians make their own fate.',
  },
};

function fakeRenderer() {
  let emit: (screens: PlanetScreen[]) => void = () => {};
  const r = {
    backend: 'webgl',
    onFrame: vi.fn((cb: (screens: PlanetScreen[]) => void) => {
      emit = cb;
      return () => {};
    }),
    setPlanets: vi.fn(),
    resize: vi.fn(),
    start: vi.fn(),
    setView: vi.fn(),
    setMotion: vi.fn(),
    setPointer: vi.fn(),
    dispose: vi.fn(),
  };
  return { r, emit: (screens: PlanetScreen[]) => emit(screens) };
}

describe('SpaceScene', () => {
  beforeEach(() => {
    create.mockReset();
  });

  it('renders the static scene with labels and status when 3D is off', () => {
    render(() => <SpaceScene planets={[VOG]} fallback label="Raids" />);
    const group = screen.getByRole('group', { name: 'Raids' });
    expect(group).toHaveClass('rc-space--fallback');
    expect(group.querySelector('canvas')).toBeNull();
    expect(group.querySelector('.rc-planet__orb')).not.toBeNull();
    expect(screen.getByText('Vault of Glass')).toBeInTheDocument();
    const planet = group.querySelector<HTMLElement>('[data-planet="vog"]');
    expect(planet?.style.getPropertyValue('--px')).toBe('0.47');
    expect(planet?.style.getPropertyValue('--py')).toBe('0.46');
    expect(
      screen.getByRole('button', { name: 'Vault of Glass, Venus · Playable, Guide' }),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('falls back when the renderer cannot start', async () => {
    create.mockRejectedValue(new Error('no webgl'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(() => <SpaceScene planets={[VOG]} label="Raids" />);
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Raids' })).toHaveClass('rc-space--fallback'),
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('positions planets from renderer frames and disposes on unmount', async () => {
    const { r, emit } = fakeRenderer();
    create.mockResolvedValue(r);
    const onLayout = vi.fn();
    const { unmount } = render(() => (
      <SpaceScene planets={[VOG]} label="Raids" onLayout={onLayout} />
    ));
    const group = screen.getByRole('group', { name: 'Raids' });
    await waitFor(() => expect(group).toHaveClass('rc-space--live'));
    expect(group.querySelector('canvas')).not.toBeNull();
    expect(r.setPlanets).toHaveBeenCalledWith([VOG]);
    expect(r.start).toHaveBeenCalled();
    emit([{ id: 'vog', x: 120, y: 80, r: 30, labelX: 0, labelY: 0 }]);
    const planet = group.querySelector<HTMLElement>('[data-planet="vog"]');
    await waitFor(() => expect(planet?.style.left).toBe('120px'));
    expect(planet?.style.top).toBe('80px');
    expect(planet?.style.getPropertyValue('--d')).toBe('60px');
    expect(group.querySelector('.rc-planet__orb')).toBeNull();
    expect(onLayout).toHaveBeenCalled();
    unmount();
    expect(r.dispose).toHaveBeenCalled();
  });

  it('applies the first view instantly and animates later ones', async () => {
    const { r } = fakeRenderer();
    create.mockResolvedValue(r);
    const [view, setView] = createSignal({ cx: 0, cy: 0, zoom: 1 });
    render(() => <SpaceScene planets={[VOG]} view={view()} />);
    await waitFor(() => expect(r.setView).toHaveBeenCalledWith({ cx: 0, cy: 0, zoom: 1 }, 0));
    setView({ cx: 0.5, cy: 0, zoom: 2 });
    expect(r.setView).toHaveBeenLastCalledWith({ cx: 0.5, cy: 0, zoom: 2 }, 600);
  });

  it('reports hover, focus and selection', () => {
    const onSelect = vi.fn();
    const onHover = vi.fn();
    render(() => (
      <SpaceScene planets={[VOG]} fallback selected="vog" onSelect={onSelect} onHover={onHover} />
    ));
    const button = screen.getByRole('button', { name: /Vault of Glass/ });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith('vog');
    fireEvent.focus(button);
    expect(onHover).toHaveBeenLastCalledWith('vog');
    fireEvent.blur(button);
    expect(onHover).toHaveBeenLastCalledWith(null);
    expect(document.querySelector('[data-planet="vog"] .rc-planet__brackets')).not.toBeNull();
    expect(button).toHaveAttribute('aria-current', 'true');
  });
  it('keeps the same row, focus and hover when the planets array is replaced', () => {
    const [planets, setPlanets] = createSignal<ScenePlanet[]>([VOG]);
    render(() => <SpaceScene planets={planets()} fallback />);
    const button = screen.getByRole('button', { name: /Vault of Glass/ });
    button.focus();
    expect(document.activeElement).toBe(button);
    setPlanets(planets().map((p) => ({ ...p, dimmed: true })));
    const after = screen.getByRole('button', { name: /Vault of Glass/ });
    expect(after).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(after.closest('.rc-planet')).toHaveClass('is-dimmed');
  });

  it('updates name, label and status reactively', () => {
    const [planets, setPlanets] = createSignal<ScenePlanet[]>([VOG]);
    render(() => <SpaceScene planets={planets()} fallback />);
    setPlanets([{ ...VOG, name: 'Renamed', status: [] }]);
    expect(screen.getByRole('button', { name: 'Renamed, Venus' })).toBeInTheDocument();
    expect(screen.getByText('Renamed')).toBeInTheDocument();
  });

  it('clears hover when a hovered planet is removed', () => {
    const onHover = vi.fn();
    const [planets, setPlanets] = createSignal<ScenePlanet[]>([VOG]);
    render(() => <SpaceScene planets={planets()} fallback onHover={onHover} />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: /Vault of Glass/ }));
    onHover.mockClear();
    setPlanets([]);
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it('marks a live planet without a screen as pending until its frame arrives', async () => {
    const { r, emit } = fakeRenderer();
    create.mockResolvedValue(r);
    render(() => <SpaceScene planets={[VOG]} label="Raids" />);
    const group = screen.getByRole('group', { name: 'Raids' });
    await waitFor(() => expect(group).toHaveClass('rc-space--live'));
    const planet = group.querySelector<HTMLElement>('[data-planet="vog"]');
    expect(planet).toHaveClass('is-pending');
    emit([{ id: 'vog', x: 1, y: 2, r: 3, labelX: 0, labelY: 0 }]);
    await waitFor(() => expect(planet).not.toHaveClass('is-pending'));
  });

  describe('media queries', () => {
    type Listener = (event: { matches: boolean }) => void;
    let lists: Map<string, { matches: boolean; listeners: Set<Listener> }[]>;
    beforeEach(() => {
      lists = new Map();
      vi.stubGlobal('matchMedia', (query: string) => {
        const entry = { matches: false, listeners: new Set<Listener>() };
        lists.set(query, [...(lists.get(query) ?? []), entry]);
        return {
          get matches() {
            return entry.matches;
          },
          addEventListener: (_: string, cb: Listener) => entry.listeners.add(cb),
          removeEventListener: (_: string, cb: Listener) => entry.listeners.delete(cb),
        };
      });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('applies a motion change that happened while the renderer was pending', async () => {
      const { r } = fakeRenderer();
      let resolve: (value: unknown) => void = () => {};
      create.mockReturnValue(new Promise((res) => (resolve = res)));
      render(() => <SpaceScene planets={[VOG]} label="Raids" />);
      const entry = lists.get('(prefers-reduced-motion: reduce)')?.[0];
      for (const cb of entry?.listeners ?? []) cb({ matches: true });
      resolve(r);
      await waitFor(() => expect(r.start).toHaveBeenCalled());
      expect(r.setMotion).toHaveBeenCalledWith(false);
    });

    it('resizes when the device pixel ratio changes', async () => {
      const { r } = fakeRenderer();
      create.mockResolvedValue(r);
      render(() => <SpaceScene planets={[VOG]} label="Raids" />);
      await waitFor(() => expect(r.start).toHaveBeenCalled());
      const query = `(resolution: ${devicePixelRatio}dppx)`;
      const entry = lists.get(query)?.[0];
      expect(entry).toBeDefined();
      const before = r.resize.mock.calls.length;
      vi.stubGlobal('devicePixelRatio', 2);
      for (const cb of entry?.listeners ?? []) cb({ matches: false });
      expect(r.resize.mock.calls.length).toBe(before + 1);
      expect(r.resize).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), 2);
      expect(lists.get('(resolution: 2dppx)')).toBeDefined();
    });
  });
});
