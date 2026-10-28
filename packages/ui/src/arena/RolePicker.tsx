// A small role-selection overlay shown before a live Atheon session starts. See
// docs/superpowers/specs/2026-10-28-atheon-chat-callout-input-design.md.
import type { PlayerRole } from './session';

export interface RolePickerProps {
  onSelect: (role: PlayerRole) => void;
}

export function RolePicker(props: RolePickerProps) {
  return (
    <div class="rc-arena__role-picker">
      <p>Practice as:</p>
      <button type="button" onClick={() => props.onSelect('plate')}>
        Plate Holder
      </button>
      <button type="button" onClick={() => props.onSelect('caller')}>
        Caller
      </button>
    </div>
  );
}
