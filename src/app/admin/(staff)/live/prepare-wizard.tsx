"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { INPUT, LABEL } from "@/components/admin/styles";
import { TEAM_NAME } from "@/lib/club";
import { LineupField, LineupPool, WomenWarning, lineupHint, useLineup } from "@/components/admin/lineup-picker";
import { EMPTY_SLOTS, MIN_WOMEN, fillInOrder, roleMismatches, womenOnCourt } from "@/lib/lineup";
import { PLAYER_ROLES, ROLE_LABEL, fullName, type PlayerRole } from "@/lib/players";
import { clearLocalLog } from "@/lib/live/local-log";
import { startMatch } from "./actions";
import { LIVE_MODE_KEY, type LiveMode, type PreparePlayer, type PrepareSetup } from "./prepare-form";

type Props = {
  match: { id: number; kicker: string; title: string; opponent: string; live: boolean };
  choices: { id: number; label: string }[];
  roster: PreparePlayer[];
  /** Preparazione già salvata per questa partita. */
  current: PrepareSetup | null;
  /** Preparazione dell'ultima partita (scorciatoie "Come ultima partita"). */
  last: PrepareSetup | null;
};

const STEPS = ["Presenti", "Formazione", "Inizio"] as const;
const CHIP =
  "min-h-11 cursor-pointer rounded-pill border border-line-strong px-3.5 font-display text-[15px] font-semibold tracking-[.08em] whitespace-nowrap text-ink uppercase hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40";
const H2 = "font-display text-2xl font-bold uppercase";

/** Ruoli dei presenti: id giocatore → ruolo in questa partita. */
type Roles = Record<number, PlayerRole>;

function rolesFrom(setup: PrepareSetup, roster: PreparePlayer[]): Roles {
  const inRoster = new Set(roster.map((p) => p.id));
  return Object.fromEntries(setup.present.filter((p) => inRoster.has(p.playerId)).map((p) => [p.playerId, p.role]));
}

export function PrepareWizard({ match, choices, roster, current, last }: Props) {
  const router = useRouter();
  const byId = new Map(roster.map((p) => [p.id, p]));
  const allRoles = (): Roles => Object.fromEntries(roster.map((p) => [p.id, p.role]));
  const keep = (slots: (number | null)[]) => slots.map((id) => (id !== null && byId.has(id) ? id : null));

  const [step, setStep] = useState(1);
  const [roles, setRoles] = useState<Roles>(() => (current ? rolesFrom(current, roster) : allRoles()));
  const [editingRole, setEditingRole] = useState<number | null>(null);
  const lineup = useLineup(
    current ? keep(current.slots) : EMPTY_SLOTS,
    current?.liberoId && byId.has(current.liberoId) ? current.liberoId : null,
  );
  const { slots, libero, filled } = lineup;
  const [serveFirst, setServeFirst] = useState<"us" | "them" | null>(null);
  const [mode, setMode] = useState<LiveMode>("semplice");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const present = roster.filter((p) => roles[p.id]);
  const valid = [present.length >= 6, filled === 6, serveFirst !== null];
  const onCourt = slots.filter((x): x is number => x !== null);
  const genderOf = (id: number) => byId.get(id)?.gender ?? null;

  // --- Presenti ---------------------------------------------------------------------------
  const togglePresent = (id: number) => {
    setRoles((r) => {
      if (!r[id]) return { ...r, [id]: byId.get(id)!.role };
      const next = { ...r };
      delete next[id];
      return next;
    });
    // Chi non è presente esce anche da formazione e libero.
    if (roles[id]) lineup.set(slots.map((x) => (x === id ? null : x)), libero === id ? null : libero);
    if (editingRole === id) setEditingRole(null);
  };

  // --- Formazione ---------------------------------------------------------------------------
  const fromLast = () => {
    if (!last) return;
    lineup.set(
      keep(last.slots).map((id) => (id !== null && roles[id] ? id : null)),
      last.liberoId && roles[last.liberoId] ? last.liberoId : null,
    );
  };

  const fill = () => {
    const res = fillInOrder(slots, libero, present.map((p) => ({ id: p.id, role: roles[p.id] })));
    lineup.set(res.slots, res.libero);
  };

  // --- Avvio --------------------------------------------------------------------------------
  const start = () => {
    if (!serveFirst) return;
    setError(null);
    try {
      localStorage.setItem(LIVE_MODE_KEY, mode);
    } catch {
      // Preferenza facoltativa: se lo storage non è disponibile si parte in modalità semplice.
    }
    startTransition(async () => {
      const res = await startMatch({
        matchId: match.id,
        present: present.map((p) => ({ playerId: p.id, role: roles[p.id] })),
        slots: slots as number[],
        liberoId: libero,
        serveFirst,
      });
      if (!res.ok) return setError(res.error);
      // Registro nuovo: via la copia del telefono di un Live precedente (es. partita di prova azzerata),
      // altrimenti all'apertura i vecchi eventi tornerebbero.
      await clearLocalLog(res.id);
      router.push(`/admin/live/${res.id}`);
    });
  };

  const ready = valid[step - 1];
  const nextLabel =
    step === 1 ? `Avanti · ${present.length} presenti` : step === 2 ? (filled === 6 ? "Avanti" : `Mancano ${6 - filled} in campo`) : pending ? "Avvio…" : "Inizia partita";

  return (
    <div className="flex flex-col gap-5.5 pb-24">
      <PageHeader kicker={match.kicker} title={match.title} />

      {choices.length > 1 && (
        <label className="flex max-w-[560px] flex-col gap-1.5">
          <span className={LABEL}>Partita</span>
          <select value={match.id} onChange={(e) => router.push(`/admin/live?partita=${e.target.value}`)} className={INPUT}>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {match.live && (
        <div className="flex flex-wrap items-center gap-3 rounded-tile border border-gold-line bg-surface-sel px-3.5 py-2.5 text-sm text-ink-2">
          <span className="mr-auto">Questa partita è già in corso.</span>
          <Link href={`/admin/live/${match.id}`} className="inline-flex min-h-11 items-center font-semibold">
            Riprendi il Live →
          </Link>
        </div>
      )}

      <nav aria-label="Passaggi" className="grid grid-cols-3 gap-1.5">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const reachable = valid.slice(0, i).every(Boolean);
          return (
            <button
              key={label}
              type="button"
              disabled={!reachable}
              onClick={() => setStep(n)}
              aria-current={step === n ? "step" : undefined}
              className={`flex min-h-11 cursor-pointer flex-col items-start gap-1.5 text-left disabled:cursor-not-allowed ${step === n ? "text-gold" : n < step ? "text-ink" : "text-faint"}`}
            >
              <span className={`block h-1 w-full rounded-pill ${n <= step ? "bg-gold" : "bg-line"}`} />
              <span className="font-display text-[15px] font-bold tracking-[.1em] uppercase">
                {n}. {label}
              </span>
            </button>
          );
        })}
      </nav>

      {step === 1 && (
        <section className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-2.5">
            <h2 className={H2}>Chi è presente?</h2>
            <span className="font-display text-lg font-bold text-gold tabular-nums">
              {present.length}/{roster.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={CHIP} onClick={() => setRoles(allRoles())}>
              Tutti
            </button>
            <button
              type="button"
              className={CHIP}
              onClick={() => {
                setRoles({});
                lineup.set(EMPTY_SLOTS, null);
              }}
            >
              Nessuno
            </button>
            <button type="button" className={CHIP} disabled={!last} onClick={() => last && setRoles(rolesFrom(last, roster))}>
              Come ultima partita
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-2">
            {roster.map((p) => {
              const role = roles[p.id];
              const on = Boolean(role);
              return (
                <div
                  key={p.id}
                  className={`flex flex-col rounded-tile border ${on ? "border-gold bg-surface" : "border-line-strong opacity-55"}`}
                >
                  <div className="flex items-center gap-1 pr-2">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePresent(p.id)}
                      className="grid min-h-15 flex-1 cursor-pointer grid-cols-[40px_minmax(0,1fr)_22px] items-center gap-2.5 py-2 pl-3 text-left text-ink"
                    >
                      <span className="font-display text-[26px] leading-none font-extrabold text-gold tabular-nums">{p.number}</span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-semibold">{fullName(p)}</span>
                        <span className={`truncate text-xs ${on && role !== p.role ? "text-gold" : "text-muted"}`}>
                          {ROLE_LABEL[role ?? p.role]}
                          {on && role !== p.role ? " (oggi)" : ""}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className={`grid size-5.5 place-items-center rounded-chip border-2 text-sm font-extrabold text-bg ${on ? "border-gold bg-gold" : "border-line-strong"}`}
                      >
                        {on ? "✓" : ""}
                      </span>
                    </button>
                    {on && (
                      <button
                        type="button"
                        onClick={() => setEditingRole(editingRole === p.id ? null : p.id)}
                        aria-expanded={editingRole === p.id}
                        aria-label={`Ruolo di ${fullName(p)} in questa partita: ${ROLE_LABEL[role]}`}
                        className={`size-11 shrink-0 cursor-pointer rounded-chip border font-display text-lg font-bold ${editingRole === p.id ? "border-gold text-gold" : "border-line-strong text-ink"}`}
                      >
                        {role}
                      </button>
                    )}
                  </div>
                  {on && editingRole === p.id && (
                    <div role="group" aria-label={`Ruolo di ${fullName(p)}`} className="grid grid-cols-5 gap-1 border-t border-line p-2">
                      {PLAYER_ROLES.map((r) => (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={role === r}
                          aria-label={ROLE_LABEL[r]}
                          onClick={() => {
                            setRoles((x) => ({ ...x, [p.id]: r }));
                            setEditingRole(null);
                          }}
                          className={`min-h-11 cursor-pointer rounded-chip font-display text-base font-bold ${role === r ? "bg-gold text-bg" : "border border-line-strong text-ink"}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-4.5">
          <div className="flex flex-col gap-3">
            <h2 className={H2}>Formazione set 1</h2>
            <span className="text-sm text-muted">{lineupHint(lineup)}</span>
            <LineupField lineup={lineup} playerOf={(id) => byId.get(id)} roleOf={(id) => roles[id]} />
            <RoleHints
              mismatches={roleMismatches(slots, (id) => roles[id])}
              playerOf={(id) => byId.get(id)}
              onApply={(id, role) => setRoles((r) => ({ ...r, [id]: role }))}
            />
            {filled === 6 && <WomenWarning ids={onCourt} genderOf={genderOf} />}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className={H2}>Presenti</h2>
            <LineupPool lineup={lineup} players={present} tagOf={(p) => roles[p.id]} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={CHIP} disabled={!last} onClick={fromLast}>
                Come ultima partita
              </button>
              <button type="button" className={CHIP} onClick={fill}>
                Riempi in ordine
              </button>
              <button
                type="button"
                className={CHIP}
                onClick={() => lineup.set(EMPTY_SLOTS, null)}
              >
                Svuota
              </button>
            </div>
            <span className="text-[13px] text-faint">
              &quot;Riempi in ordine&quot; mette i presenti nelle posizioni vuote seguendo i ruoli di questa partita (P, S, C, O, S, C)
              e assegna il libero se manca.
            </span>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="flex max-w-[560px] flex-col gap-5.5">
          <div className="flex flex-col gap-2.5">
            <h2 className={H2}>Chi batte per primo?</h2>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["us", TEAM_NAME],
                  ["them", match.opponent],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={serveFirst === k}
                  onClick={() => setServeFirst(k)}
                  className={`min-h-18 cursor-pointer rounded-card border px-2 font-display text-xl font-bold tracking-[.06em] uppercase ${serveFirst === k ? "border-gold bg-surface-sel text-gold" : "border-line bg-surface text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <h2 className={H2}>Modalità di partenza</h2>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["semplice", "Semplice", "Punto + tipo + chi"],
                  ["avanzato", "Avanzato", "Ogni tocco della squadra"],
                ] as const
              ).map(([k, label, sub]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={mode === k}
                  onClick={() => setMode(k)}
                  className={`flex min-h-22 cursor-pointer flex-col items-start justify-center gap-1 rounded-card border px-3.5 py-2.5 text-left ${mode === k ? "border-gold bg-surface-sel" : "border-line bg-surface"}`}
                >
                  <span className={`font-display text-xl font-bold tracking-[.06em] uppercase ${mode === k ? "text-gold" : "text-ink"}`}>
                    {label}
                  </span>
                  <span className="text-[13px] text-muted">{sub}</span>
                </button>
              ))}
            </div>
            <span className="text-[13px] text-faint">Si può cambiare in qualsiasi momento durante la partita.</span>
          </div>

          <div className="flex flex-col gap-1.5 rounded-card border border-line bg-surface px-4 py-3.5 text-sm text-ink-2">
            <span className="font-display text-sm font-bold tracking-[.2em] text-gold uppercase">Riepilogo</span>
            <span>
              {present.length} presenti · formazione {filled}/6 · libero {libero ? `#${byId.get(libero)?.number}` : "nessuno"}
            </span>
            <span>
              Batte: {serveFirst === "us" ? TEAM_NAME : serveFirst === "them" ? match.opponent : "da scegliere"} · Modalità:{" "}
              {mode === "semplice" ? "Semplice" : "Avanzato"}
            </span>
            {womenOnCourt(onCourt, genderOf).warn && (
              <span className="text-red">Attenzione: meno di {MIN_WOMEN} donne in campo (o sesso non indicato).</span>
            )}
          </div>

          {error && (
            <p role="alert" className="text-[15px] text-red">
              {error}
            </p>
          )}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-6 border-t border-line-soft bg-bg">
        <div className="mx-auto flex max-w-[1100px] gap-2.5 px-admin py-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="min-h-13.5 cursor-pointer rounded-btn border border-line-strong px-5 font-display text-[17px] font-semibold tracking-[.1em] text-ink uppercase"
            >
              Indietro
            </button>
          )}
          <button
            type="button"
            disabled={!ready || pending}
            onClick={() => (step < 3 ? setStep(step + 1) : start())}
            className="min-h-13.5 flex-1 cursor-pointer rounded-btn bg-gold font-display text-lg font-bold tracking-[.12em] text-bg uppercase hover:bg-gold-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint"
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chi in formazione sta al posto di un altro ruolo (schema normale dall'alzatore): con un tocco
 * prende quel ruolo per questa partita (resta salvato nei presenti, conta per le statistiche).
 */
function RoleHints({
  mismatches,
  playerOf,
  onApply,
}: {
  mismatches: Map<number, PlayerRole>;
  playerOf: (id: number) => { number: number; firstName: string; lastName: string } | undefined;
  onApply: (id: number, role: PlayerRole) => void;
}) {
  if (mismatches.size === 0) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-tile border border-gold-line p-3">
      <span className="text-[13px] text-muted">Ruoli dalla posizione (schema normale dall&apos;alzatore):</span>
      {[...mismatches].map(([id, role]) => {
        const p = playerOf(id);
        return (
          <div key={id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 text-sm text-ink">
              <span className="font-display font-bold text-gold">#{p?.number}</span> {p ? fullName(p) : ""} è al posto{" "}
              {role === "O" ? "dell'opposto" : role === "P" ? "dell'alzatore" : role === "C" ? "del centrale" : "della banda"}
            </span>
            <button type="button" onClick={() => onApply(id, role)} className={CHIP}>
              {ROLE_LABEL[role]} oggi
            </button>
          </div>
        );
      })}
    </div>
  );
}
