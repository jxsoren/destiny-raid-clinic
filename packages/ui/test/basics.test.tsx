import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Button, Divider, KeyGlyph, Logo, PerkNode, SelectionBrackets, StatusIcon } from '../src';

describe('KeyGlyph', () => {
  it('renders the key in a kbd pill', () => {
    render(() => <KeyGlyph label="F" />);
    const key = screen.getByText('F');
    expect(key.tagName).toBe('KBD');
    expect(key).toHaveClass('rc-key');
  });
});

describe('Button', () => {
  it('defaults to secondary and calls onClick', () => {
    const onClick = vi.fn();
    render(() => <Button onClick={onClick}>Play this moment</Button>);
    const button = screen.getByRole('button', { name: 'Play this moment' });
    expect(button).toHaveClass('rc-btn', 'rc-btn--secondary');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders a key glyph and the primary variant', () => {
    render(() => (
      <Button variant="primary" glyph="F">
        Open briefing
      </Button>
    ));
    expect(screen.getByRole('button')).toHaveClass('rc-btn--primary');
    expect(screen.getByText('F')).toHaveClass('rc-key');
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(() => (
      <Button disabled onClick={onClick}>
        Nope
      </Button>
    ));
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Divider', () => {
  it('is an hr with the divider class', () => {
    const { container } = render(() => <Divider />);
    expect(container.querySelector('hr')).toHaveClass('rc-divider');
  });
});

describe('StatusIcon', () => {
  it.each([
    ['playable', 'Playable'],
    ['guide', 'Guide'],
    ['soon', 'Coming soon'],
  ] as const)('%s has an accessible label', (kind, label) => {
    render(() => <StatusIcon kind={kind} />);
    expect(screen.getByRole('img', { name: label })).toHaveClass(`rc-status--${kind}`);
  });
});

describe('PerkNode', () => {
  it('shows the label and its state', () => {
    render(() => <PerkNode state="playable" label="7" title="Atheon" />);
    const node = screen.getByRole('img', { name: 'Atheon: Playable' });
    expect(node).toHaveTextContent('7');
    expect(node).toHaveClass('rc-perk--playable');
    expect(node).not.toHaveClass('rc-perk--selected');
  });

  it('shows a check when done and a ring when selected', () => {
    render(() => <PerkNode state="done" label="3" title="Oracles" selected />);
    const node = screen.getByRole('img', { name: 'Oracles: Done' });
    expect(node).toHaveTextContent('✓');
    expect(node).toHaveClass('rc-perk--done', 'rc-perk--selected');
  });
});

describe('SelectionBrackets', () => {
  it('draws four corners at the given size and is hidden from assistive tech', () => {
    const { container } = render(() => <SelectionBrackets size={120} />);
    const brackets = container.querySelector('.rc-brackets') as HTMLElement;
    expect(brackets.querySelectorAll('i')).toHaveLength(4);
    expect(brackets.style.width).toBe('120px');
    expect(brackets).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Logo', () => {
  it('is labelled Raid Clinic', () => {
    render(() => <Logo />);
    expect(screen.getByRole('img', { name: 'Raid Clinic' })).toBeInTheDocument();
  });
});
