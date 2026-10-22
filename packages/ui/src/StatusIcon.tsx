export type Availability = 'playable' | 'guide' | 'soon';

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  playable: 'Playable',
  guide: 'Guide',
  soon: 'Coming soon',
};

const GLYPH: Record<Availability, string> = { playable: '▶', guide: '☰', soon: '·' };

export function StatusIcon(props: { kind: Availability }) {
  return (
    <span
      class={`rc-status rc-status--${props.kind}`}
      role="img"
      aria-label={AVAILABILITY_LABEL[props.kind]}
    >
      {GLYPH[props.kind]}
    </span>
  );
}
