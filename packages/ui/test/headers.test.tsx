import { render, screen } from '@solidjs/testing-library';
import { ItemHeader, Logo, PhaseHeading, StatsStrip } from '../src';

const VOG_ARENA =
  'M44 8 L56 8 L62 22 L58 34 L72 42 L80 42 L80 70 L66 70 L66 82 L34 82 L34 70 L20 70 L20 50 L34 40 L40 36 L37 22 Z';

describe('ItemHeader', () => {
  it('renders name, type line and curly-quoted flavor with the logo tile', () => {
    const { container } = render(() => (
      <ItemHeader
        tile="logo"
        name="Raid Clinic"
        type="Raid trainer"
        flavor="Learn it before the pull."
      />
    ));
    expect(screen.getByRole('heading', { level: 1, name: 'Raid Clinic' })).toHaveClass('t-name');
    expect(screen.getByText('Raid trainer')).toHaveClass('t-type');
    expect(screen.getByText('“Learn it before the pull.”')).toHaveClass('t-flavor');
    expect(screen.queryByRole('img', { name: 'Raid Clinic' })).toBeNull();
    expect(container.querySelector('.rc-item__tile svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the arena outline tile and omits a missing flavor', () => {
    const { container } = render(() => (
      <ItemHeader tile="arena" arenaPath={VOG_ARENA} name="Vault of Glass" type="Venus · Raid" />
    ));
    expect(container.querySelector('.rc-item__tile--arena path')).toHaveAttribute('d', VOG_ARENA);
    expect(container.querySelector('.t-flavor')).toBeNull();
  });
});

describe('ItemHeader level', () => {
  it('renders the requested heading level', () => {
    render(() => <ItemHeader level={2} tile="logo" name="Second" type="x" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Second' })).toBeInTheDocument();
  });
});

describe('Logo', () => {
  it('can be decorative', () => {
    const { container } = render(() => <Logo decorative />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(container.querySelector('title')).toBeNull();
  });
});

describe('StatsStrip', () => {
  it('pairs each value with its label', () => {
    render(() => (
      <StatsStrip
        items={[
          { value: '6', label: 'Seats' },
          { value: '30s', label: 'Damage' },
        ]}
      />
    ));
    expect(screen.getByText('6')).toHaveClass('t-big');
    expect(screen.getByText('Seats')).toHaveClass('t-status');
    expect(screen.getByText('30s').tagName).toBe('DD');
  });
});

describe('PhaseHeading', () => {
  it('renders the gold kicker and the title, with an anchor id', () => {
    const { container } = render(() => (
      <PhaseHeading id="phase-2" kicker="Phase 2 · Time gate" title="Hold the plate" />
    ));
    expect(screen.getByText('Phase 2 · Time gate')).toHaveClass('rc-phase', 't-head');
    expect(screen.getByRole('heading', { level: 3, name: 'Hold the plate' })).toHaveClass('t-name');
    expect(container.querySelector('#phase-2')).not.toBeNull();
  });
});
