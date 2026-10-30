"use client";

import { useState, useTransition } from "react";
import { SegmentedField } from "@/components/admin/segmented-field";
import { BTN_DANGER, BTN_GOLD_OUTLINE, BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from "@/components/admin/styles";
import type { ActionResult } from "@/lib/actions";
import { HOME_VENUE, TEAM_NAME } from "@/lib/club";
import { deleteMatch, duplicateAsReturn, saveMatch } from "./actions";
import { MATCH_SPECIALS, SET_SLOTS, SPECIAL_LABEL, specialOf, type AdminMatch, type MatchSpecial, type SetSlot } from "./match-form";

type Props = {
  /** Assente = nuova partita. */
  match?: AdminMatch;
  timeChips: string[];
  onClose: () => void;
  onDuplicated: (id: number) => void;
};

function initialSlots(match?: AdminMatch): SetSlot[] {
  return Array.from({ length: SET_SLOTS }, (_, i) => {
    const s = match?.sets[i];
    return s ? { us: String(s.us), them: String(s.them) } : { us: "", them: "" };
  });
}

export function MatchEditor({ match, timeChips, onClose, onDuplicated }: Props) {
  const [friendly, setFriendly] = useState(match?.friendly ?? false);
  const [phase, setPhase] = useState<"andata" | "ritorno">(match?.phase ?? "andata");
  const [round, setRound] = useState(match && !match.friendly ? String(match.round) : "");
  const [number, setNumber] = useState(match?.number ? String(match.number) : "");
  const [date, setDate] = useState(match?.date ?? "");
  const [time, setTime] = useState(match?.time ?? "");
  const [opponent, setOpponent] = useState(match?.opponent ?? "");
  const [home, setHome] = useState(match?.home ?? true);
  const [venue, setVenue] = useState(match?.venue ?? (match ? "" : HOME_VENUE));
  const [special, setSpecial] = useState<MatchSpecial>(match ? specialOf(match) : "none");
  const [slots, setSlots] = useState(() => initialSlots(match));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult<{ id: number }>>, done: (id: number) => void) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) done(res.id);
      else setError(res.error);
    });
  };

  const save = () =>
    run(() => saveMatch({ id: match?.id, friendly, phase, round, number, date, time, home, opponent, venue, special, slots }), onClose);

  const setSlot = (i: number, side: keyof SetSlot, value: string) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, [side]: value.replace(/\D/g, "").slice(0, 2) } : s)));

  return (
    <div className="flex flex-col gap-4.5 border-t border-line bg-surface-2 px-4 pt-4.5 pb-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Data</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Ora</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Avversario</span>
          <input
            type="text"
            list="avversari"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="Scegli o scrivi"
            className={INPUT}
          />
        </label>
        <SegmentedField
          label="Campo"
          value={home}
          onChange={setHome}
          options={[
            { value: true, label: "Casa" },
            { value: false, label: "Trasferta" },
          ]}
        />
        <SegmentedField
          label="Tipo"
          value={friendly}
          onChange={setFriendly}
          options={[
            { value: false, label: "Campionato" },
            { value: true, label: "Amichevole" },
          ]}
        />
        {/* Le amichevoli non hanno fase, giornata né numero gara. */}
        {!friendly && (
          <SegmentedField
            label="Fase"
            value={phase}
            onChange={setPhase}
            options={[
              { value: "andata", label: "Andata" },
              { value: "ritorno", label: "Ritorno" },
            ]}
          />
        )}
        {!friendly && (
          <div className="grid grid-cols-2 gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Giornata</span>
              <input
                type="text"
                inputMode="numeric"
                value={round}
                onChange={(e) => setRound(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="es. 2"
                className={`${INPUT} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>N. gara</span>
              <input
                type="text"
                inputMode="numeric"
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="es. 8"
                className={`${INPUT} tabular-nums`}
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold tracking-[.1em] text-faint uppercase">Orari frequenti</span>
        {timeChips.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTime(t)}
            className={`min-h-11 cursor-pointer rounded-pill border px-3 font-display text-[15px] font-semibold tabular-nums ${time === t ? "border-gold text-gold" : "border-line-strong text-ink-2"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Palestra</span>
          <input
            type="text"
            list="palestre"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Nome e città"
            className={INPUT}
          />
        </label>
        {home && venue !== HOME_VENUE && (
          <button
            type="button"
            onClick={() => setVenue(HOME_VENUE)}
            className="inline-flex min-h-11 cursor-pointer items-center self-start text-sm font-semibold text-gold hover:text-gold-hover"
          >
            Usa {HOME_VENUE}
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Situazione</span>
        <select value={special} onChange={(e) => setSpecial(e.target.value as MatchSpecial)} className={INPUT}>
          {MATCH_SPECIALS.map((v) => (
            <option key={v} value={v}>
              {SPECIAL_LABEL[v]}
            </option>
          ))}
        </select>
      </label>

      {special === "none" && (
        <div className="flex flex-col gap-2">
          <span className={LABEL}>Parziali (noi – loro)</span>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2">
            {slots.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-btn border border-line bg-surface px-2 py-0.5">
                <span className="w-4.5 font-display text-[13px] font-semibold text-faint">{i + 1}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Set ${i + 1}, punti ${TEAM_NAME}`}
                  value={s.us}
                  onChange={(e) => setSlot(i, "us", e.target.value)}
                  placeholder="–"
                  className="min-h-11 w-9 bg-transparent text-center font-display text-lg font-bold text-gold tabular-nums placeholder:text-faint focus:outline-none"
                />
                <span className="text-faint">–</span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Set ${i + 1}, punti avversario`}
                  value={s.them}
                  onChange={(e) => setSlot(i, "them", e.target.value)}
                  placeholder="–"
                  className="min-h-11 w-9 bg-transparent text-center font-display text-lg font-bold text-ink tabular-nums placeholder:text-faint focus:outline-none"
                />
              </div>
            ))}
          </div>
          <span className="text-[13px] text-faint">Se la partita viene registrata dal Live, i parziali si compilano da soli.</span>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[15px] text-red">
          {error}
        </p>
      )}

      {confirmDelete && match ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-btn border border-red-line p-3">
          <span className="mr-auto text-[15px] text-ink">Eliminare la partita? Si perdono anche parziali e dati del Live.</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteMatch(match.id), onClose)}
            className={`${BTN_DANGER} border border-red-line`}
          >
            Elimina definitivamente
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)} className={BTN_SECONDARY}>
            No
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" disabled={pending} onClick={save} className={BTN_PRIMARY}>
            {pending ? "Salvo…" : "Salva"}
          </button>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            Annulla
          </button>
          {match && (
            <>
              {!match.friendly && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => duplicateAsReturn(match.id), onDuplicated)}
                  className={BTN_GOLD_OUTLINE}
                >
                  Duplica come ritorno
                </button>
              )}
              <button type="button" onClick={() => setConfirmDelete(true)} className={`${BTN_DANGER} ml-auto`}>
                Elimina
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
