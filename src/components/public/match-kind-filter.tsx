// Filtro Ufficiali / Tutte / Amichevoli delle statistiche (pagina Statistiche e scheda giocatore).
import { SEGMENTED_FILL, segmentClass } from "@/components/ui/segmented";
import { MATCH_KINDS, type MatchKind } from "@/lib/stats-season";

export function MatchKindFilter({ value, onChange }: { value: MatchKind; onChange: (kind: MatchKind) => void }) {
  return (
    <div role="group" aria-label="Ufficiali o amichevoli" className={SEGMENTED_FILL}>
      {MATCH_KINDS.map((k) => (
        <button key={k.key} type="button" aria-pressed={value === k.key} onClick={() => onChange(k.key)} className={segmentClass(value === k.key, true)}>
          {k.label}
        </button>
      ))}
    </div>
  );
}
