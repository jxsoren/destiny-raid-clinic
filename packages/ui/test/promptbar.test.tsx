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

  it('does not steal Enter or Space from a focused control, but handles them on the body', () => {
    const go = vi.fn();
    render(() => (
      <>
        <button type="button">Focus me</button>
        <a href="/x">Open the page</a>
        <PromptBar
          touch={false}
          prompts={[{ key: 'F', keys: ['enter', 'space'], label: 'Go', onPress: go }]}
        />
      </>
    ));
    const button = screen.getByRole('button', { name: 'Focus me' });
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(screen.getByRole('link', { name: 'Open the page' }), { key: 'Enter' });
    expect(go).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(go).toHaveBeenCalledTimes(1);
  });

  it('marks touch mode and supports the floating variant', () => {
    render(() => <PromptBar touch variant="floating" prompts={[{ key: '/', label: 'Search' }]} />);
    const nav = screen.getByRole('navigation', { name: 'Actions' });
    expect(nav).toHaveAttribute('data-touch', 'true');
    expect(nav).toHaveClass('rc-prompts--floating');
  });

  it('lets Escape through while typing, but not other keys', () => {
    const back = vi.fn();
    render(() => (
      <>
        <textarea aria-label="Notes" />
        <PromptBar touch={false} prompts={[{ key: 'Esc', label: 'Back', onPress: back }]} />
      </>
    ));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Notes' }), { key: 'Escape' });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('matches extra keys, enter/space aliases, and ignores repeats', () => {
    const go = vi.fn();
    const pick = vi.fn();
    const jump = vi.fn();
    render(() => (
      <PromptBar
        touch={false}
        prompts={[
          { key: 'Enter', label: 'Go', onPress: go },
          { key: 'space', label: 'Pick', onPress: pick },
          { key: 'F', keys: ['g', 'h'], label: 'Jump', onPress: jump },
        ]}
      />
    ));
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'f' });
    fireEvent.keyDown(window, { key: 'Enter', repeat: true });
    expect(go).toHaveBeenCalledTimes(1);
    expect(pick).toHaveBeenCalledTimes(1);
    expect(jump).toHaveBeenCalledTimes(2);
  });

  it('emits valid aria-keyshortcuts names', () => {
    render(() => (
      <PromptBar
        touch={false}
        prompts={[
          { key: 'Esc', label: 'A' },
          { key: 'Enter', label: 'B' },
          { key: 'space', label: 'C' },
          { key: 'f', label: 'D' },
        ]}
      />
    ));
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-keyshortcuts'));
    expect(names).toEqual(['Escape', 'Enter', 'Space', 'F']);
  });

  describe('touch detection', () => {
    const original = window.matchMedia;
    afterEach(() => {
      window.matchMedia = original;
    });

    it('sets data-touch after mount from (pointer: coarse) and follows changes', () => {
      let listener: (() => void) | undefined;
      const mql = {
        matches: true,
        addEventListener: vi.fn((_: string, l: () => void) => {
          listener = l;
        }),
        removeEventListener: vi.fn(),
      };
      window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;
      const { unmount } = render(() => <PromptBar prompts={[{ key: 'F', label: 'Open' }]} />);
      const nav = screen.getByRole('navigation', { name: 'Actions' });
      expect(nav).toHaveAttribute('data-touch', 'true');
      mql.matches = false;
      listener?.();
      expect(nav).toHaveAttribute('data-touch', 'false');
      unmount();
      expect(mql.removeEventListener).toHaveBeenCalledWith('change', listener);
    });
  });
});
