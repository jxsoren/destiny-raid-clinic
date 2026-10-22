/** D1 corner brackets. `size` is pixels, or any CSS length such as '100%'. */
export function SelectionBrackets(props: { size: number | string }) {
  const dim = () => (typeof props.size === 'number' ? `${props.size}px` : props.size);
  return (
    <span class="rc-brackets" style={{ width: dim(), height: dim() }} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
