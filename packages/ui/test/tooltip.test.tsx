import { render, screen } from '@solidjs/testing-library';
import { Tooltip } from '../src';

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
});
