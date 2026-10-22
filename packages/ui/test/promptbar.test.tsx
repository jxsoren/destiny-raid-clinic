import { fireEvent, render, screen } from '@solidjs/testing-library';
import { PromptBar } from '../src';

describe('PromptBar', () => {
  it('renders each prompt as a button with its key glyph', () => {
    render(() => (
      <PromptBar
        touch={false}
        prompts={[
          { key: 'F', label: 'Open briefing' },
          { key: 'Esc', label: 'Back to raids' },
        ]}
      />
    ));
    const nav = screen.getByRole('navigation', { name: 'Actions' });
    expect(nav).toHaveClass('rc-prompts', 'rc-prompts--bar');
    expect(nav).toHaveAttribute('data-touch', 'false');
    expect(screen.getByRole('button', { name: /Open briefing/ })).toHaveAttribute(
      'aria-keyshortcuts',
      'F',
    );
    expect(screen.getByText('Esc')).toHaveClass('rc-key');
  });

  it('fires onPress on click and on the matching key, case-insensitively', () => {
    const open = vi.fn();
    const back = vi.fn();
    render(() => (
      <PromptBar
        touch={false}
        prompts={[
          { key: 'F', label: 'Open briefing', onPress: open },
          { key: 'Esc', label: 'Back', onPress: back },
        ]}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: /Open briefing/ }));
    fireEvent.keyDown(window, { key: 'f' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(open).toHaveBeenCalledTimes(2);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('ignores keys typed into text fields', () => {
    const open = vi.fn();
    render(() => (
      <>
        <input aria-label="Search" />
        <PromptBar touch={false} prompts={[{ key: 'F', label: 'Open', onPress: open }]} />
      </>
    ));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'f' });
    expect(open).not.toHaveBeenCalled();
  });

  it('marks touch mode and supports the floating variant', () => {
    render(() => <PromptBar touch variant="floating" prompts={[{ key: '/', label: 'Search' }]} />);
    const nav = screen.getByRole('navigation', { name: 'Actions' });
    expect(nav).toHaveAttribute('data-touch', 'true');
    expect(nav).toHaveClass('rc-prompts--floating');
  });
});
