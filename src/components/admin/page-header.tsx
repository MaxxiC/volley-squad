/** Intestazione delle pagine staff: kicker oro, titolo, azione a destra e nota sotto. */
export function PageHeader({
  kicker,
  title,
  action,
  description,
}: {
  kicker?: string;
  title: string;
  action?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          {kicker && (
            <span className="font-display text-sm font-semibold tracking-[.24em] text-gold uppercase">{kicker}</span>
          )}
          <h1 className="font-display text-[clamp(40px,8vw,64px)] leading-[.9] font-extrabold uppercase">{title}</h1>
        </div>
        {action}
      </div>
      {description && <p className="text-sm text-muted">{description}</p>}
    </>
  );
}
