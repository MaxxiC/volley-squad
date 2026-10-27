import { LABEL } from "./styles";

const SEGMENT = "flex-1 min-h-11 cursor-pointer rounded-chip px-1 font-display text-sm font-bold tracking-[.04em] uppercase";

/** Campo di form a scelta singola tra poche opzioni (Casa/Trasferta, Andata/Ritorno, ruolo). */
export function SegmentedField<T extends string | boolean>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <div role="group" aria-label={label} className="flex gap-1 rounded-btn border border-line p-0.5">
        {options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`${SEGMENT} ${value === opt.value ? "bg-gold text-bg" : "bg-transparent text-muted"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
