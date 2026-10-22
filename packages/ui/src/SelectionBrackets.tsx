export function SelectionBrackets(props: { size: number }) {
  return (
    <span
      class="rc-brackets"
      style={{ width: `${props.size}px`, height: `${props.size}px` }}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
