export function Logo(props: { size?: number; decorative?: boolean }) {
  const size = () => props.size ?? 26;
  return (
    <svg
      class="rc-logo"
      width={size()}
      height={size()}
      viewBox="0 0 26 26"
      role={props.decorative ? undefined : 'img'}
      aria-label={props.decorative ? undefined : 'Raid Clinic'}
      aria-hidden={props.decorative ? 'true' : undefined}
    >
      {!props.decorative && <title>Raid Clinic</title>}
      <path class="rc-logo__outer" d="M13 2 L24 13 L13 24 L2 13 Z" />
      <path class="rc-logo__core" d="M13 8 L18 13 L13 18 L8 13 Z" />
    </svg>
  );
}
