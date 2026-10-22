export function PhaseHeading(props: { kicker: string; title: string; id?: string }) {
  return (
    <div class="rc-phase-heading" id={props.id}>
      <p class="rc-phase t-head">
        <i aria-hidden="true" />
        {props.kicker}
      </p>
      <h3 class="t-name rc-phase-heading__title">{props.title}</h3>
    </div>
  );
}
