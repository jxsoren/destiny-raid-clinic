import { render, screen } from '@solidjs/testing-library';
import { Tooltip } from '../src';
import { placeTooltip } from '../src/placement';

describe('Tooltip', () => {
  it('renders title, sub line, body and cost row at the computed position', () => {
    render(() => (
      <Tooltip
        target={{ x: 300, y: 300, w: 100, h: 100 }}
        viewport={{ w: 1200, h: 700 }}
        title="Vault of Glass"
        sub="Venus · Raid · 7 encounters"
        cost={{ label: 'Trainer', value: '1 / 7' }}
      >
        <span>Guardians make their own fate.</span>
      </Tooltip>
    ));
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveClass('rc-tip');
    expect(tip).toHaveAttribute('data-side', 'right');
    expect(tip.style.left).toBe('412px');
    expect(screen.getByText('Venus · Raid · 7 encounters')).toHaveClass('rc-tip__sub');
    expect(screen.getByText('Guardians make their own fate.')).toBeInTheDocument();
    expect(screen.getByText('1 / 7').tagName).toBe('B');
  });

  it('omits the cost row when there is no cost', () => {
    const { container } = render(() => (
      <Tooltip target={{ x: 0, y: 0, w: 10, h: 10 }} viewport={{ w: 800, h: 600 }} title="Atheon" />
    ));
    expect(container.querySelector('.rc-tip__cost')).toBeNull();
  });

  it('uses the measured height once available', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(80);
    render(() => (
      <Tooltip
        target={{ x: 300, y: 300, w: 100, h: 100 }}
        viewport={{ w: 1200, h: 700 }}
        title="T"
      />
    ));
    // right side, vertically centred on the target: 350 - 80 / 2
    expect(screen.getByRole('tooltip').style.top).toBe('310px');
    spy.mockRestore();
  });

  it('falls back to the cheapest side when all four are blocked', () => {
    const target = { x: 100, y: 100, w: 100, h: 100 };
    const avoid = [{ x: 0, y: 0, w: 1000, h: 1000 }];
    render(() => <Tooltip target={target} viewport={{ w: 400, h: 400 }} avoid={avoid} title="T" />);
    const side = screen.getByRole('tooltip').getAttribute('data-side');
    expect(['right', 'left', 'bottom', 'top']).toContain(side);
    expect(side).toBe(placeTooltip(target, { w: 260, h: 150 }, { w: 400, h: 400 }, avoid).side);
  });

  it('can be contained in a positioned parent', () => {
    render(() => (
      <Tooltip
        contained
        target={{ x: 0, y: 0, w: 10, h: 10 }}
        viewport={{ w: 800, h: 600 }}
        title="T"
      />
    ));
    expect(screen.getByRole('tooltip')).toHaveClass('rc-tip', 'rc-tip--contained');
  });
});
