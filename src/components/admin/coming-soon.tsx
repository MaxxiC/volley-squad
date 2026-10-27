/** Segnaposto per le sezioni staff non ancora costruite. */
export function ComingSoon({ title, step }: { title: string; step: number }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-[clamp(40px,8vw,56px)] leading-[.95] font-extrabold uppercase">{title}</h1>
      <p className="text-base text-muted">In arrivo nello step {step} della roadmap.</p>
    </div>
  );
}
