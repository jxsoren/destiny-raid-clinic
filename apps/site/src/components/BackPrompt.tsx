// Raid page: Esc (or a tap) returns to the Director. A tiny island so PromptBar's key guards apply.
import { PromptBar } from '@raid-clinic/ui';

export function BackPrompt() {
  return (
    <PromptBar
      variant="floating"
      prompts={[{ key: 'Esc', label: 'Back to raids', onPress: () => window.location.assign('/') }]}
    />
  );
}
