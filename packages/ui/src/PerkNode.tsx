import { AVAILABILITY_LABEL, type Availability } from './StatusIcon';

export type PerkState = Availability | 'done';

export function PerkNode(props: {
  state: PerkState;
  label: string;
  title: string;
  selected?: boolean;
}) {
  const stateLabel = () => (props.state === 'done' ? 'Done' : AVAILABILITY_LABEL[props.state]);
  return (
    <span
      class={`rc-perk rc-perk--${props.state}${props.selected ? ' rc-perk--selected' : ''}`}
      role="img"
      aria-label={`${props.title}: ${stateLabel()}`}
    >
      {props.state === 'done' ? '✓' : props.label}
    </span>
  );
}
