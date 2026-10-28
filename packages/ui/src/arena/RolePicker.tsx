// A small role-selection overlay shown before a live Atheon session starts. "Caller" is disabled —
// it has no input mechanism until a later sub-project ships the chat overlay it depends on. See
// docs/superpowers/specs/2026-10-27-atheon-movement-camera-foundation-design.md.
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
      <button type="button" disabled title="Coming in a later update">
        Caller (coming soon)
      </button>
    </div>
  );
}
