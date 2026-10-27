"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { INPUT, LABEL } from "@/components/admin/styles";
import { TEAM_NAME } from "@/lib/club";
import { COURT_ORDER, EMPTY_SLOTS, MIN_WOMEN, fillInOrder, womenOnCourt, type Slots } from "@/lib/lineup";
import { PLAYER_ROLES, ROLE_LABEL, fullName, shortName, type PlayerRole } from "@/lib/players";
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
  const [slots, setSlots] = useState<Slots>(() => (current ? keep(current.slots) : EMPTY_SLOTS));
  const [libero, setLibero] = useState<number | null>(() => (current?.liberoId && byId.has(current.liberoId) ? current.liberoId : null));
  const [target, setTarget] = useState<number | "libero">(0);
  const [serveFirst, setServeFirst] = useState<"us" | "them" | null>(null);
  const [mode, setMode] = useState<LiveMode>("semplice");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const present = roster.filter((p) => roles[p.id]);
  const filled = slots.filter((x) => x !== null).length;
  const valid = [present.length >= 6, filled === 6, serveFirst !== null];
  const women = womenOnCourt(slots.filter((x): x is number => x !== null), (id) => byId.get(id)?.gender ?? null);

  // --- Presenti ---------------------------------------------------------------------------
  const togglePresent = (id: number) => {
    setRoles((r) => {
      if (!r[id]) return { ...r, [id]: byId.get(id)!.role };
      const next = { ...r };
      delete next[id];
      return next;
    });
    // Chi non è presente esce anche da formazione e libero.
    setSlots((s) => s.map((x) => (x === id && roles[id] ? null : x)));
    if (libero === id && roles[id]) setLibero(null);
    if (editingRole === id) setEditingRole(null);
  };

  // --- Formazione ---------------------------------------------------------------------------
  const place = (id: number) => {
    if (target === "libero") {
      setSlots((s) => s.map((x) => (x === id ? null : x)));
      setLibero(id);
      setTarget(Math.max(0, slots.findIndex((x) => x === null)));
      return;
    }
    const next = slots.map((x) => (x === id ? null : x));
    next[target] = id;
    setSlots(next);
    if (libero === id) setLibero(null);
    const empty = next.findIndex((x) => x === null);
    if (empty >= 0) setTarget(empty);
  };

  const fromLast = () => {
    if (!last) return;
    setSlots(keep(last.slots).map((id) => (id !== null && roles[id] ? id : null)));
    setLibero(last.liberoId && roles[last.liberoId] ? last.liberoId : null);
    setTarget(0);
  };

  const fill = () => {
    const res = fillInOrder(slots, libero, present.map((p) => ({ id: p.id, role: roles[p.id] })));
    setSlots(res.slots);
    setLibero(res.libero);
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
      if (res.ok) router.push(`/admin/live/${res.id}`);
      else setError(res.error);
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
                setSlots(EMPTY_SLOTS);
                setLibero(null);
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
            <span className="text-sm text-muted">
              {target === "libero" ? "Scegli il libero tra i presenti" : `Tocca un presente per metterlo in P${target + 1}`}
            </span>
            <div className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-3">
              <span className="text-center text-[11px] font-semibold tracking-[.16em] text-faint uppercase">Rete</span>
              <div className="grid grid-cols-3 gap-1.5 border-t-3 border-ink-2 pt-2">
                {COURT_ORDER.map((i) => {
                  const id = slots[i];
                  const p = id !== null ? byId.get(id) : undefined;
                  const active = target === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTarget(i)}
                      aria-pressed={active}
                      aria-label={`Posizione P${i + 1}${p ? `: ${fullName(p)}` : ", vuota"}`}
                      className={`relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-tile text-ink ${active ? "border border-gold bg-surface-sel" : p ? "border border-line bg-surface-2" : "border border-dashed border-line-strong bg-surface-2"}`}
                    >
                      <span className="absolute top-1.5 left-2 text-[11px] font-semibold text-faint">P{i + 1}</span>
                      <span className={`font-display text-[30px] leading-none font-extrabold tabular-nums ${p ? "text-gold" : "text-faint"}`}>
                        {p ? p.number : "+"}
                      </span>
                      <span className="max-w-full truncate px-1 text-xs text-ink-2">{p ? shortName(p) : "vuoto"}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setTarget("libero")}
                aria-pressed={target === "libero"}
                className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-btn border border-dashed px-3 text-sm text-ink-2 ${target === "libero" ? "border-gold" : "border-line-strong"}`}
              >
                <span className="font-display text-[13px] font-bold tracking-[.12em] text-blue uppercase">Libero</span>
                <span className="font-display text-xl font-extrabold text-gold tabular-nums">{libero ? byId.get(libero)?.number : "+"}</span>
                {libero ? fullName(byId.get(libero)!) : "Nessuno"}
              </button>
            </div>
            {filled === 6 && women.warn && (
              <p role="status" className="rounded-btn border border-red-line px-3 py-2.5 text-sm text-red">
                {women.women + women.unknown < MIN_WOMEN
                  ? `In campo ${women.women === 1 ? "c'è 1 donna" : `ci sono ${women.women} donne`}: il regolamento ne chiede almeno ${MIN_WOMEN}.`
                  : `Verifica le donne in campo (almeno ${MIN_WOMEN}): sesso non indicato per ${women.unknown} ${women.unknown === 1 ? "giocatore" : "giocatori"}.`}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className={H2}>Presenti</h2>
            <div className="flex flex-wrap gap-1.5">
              {present.map((p) => {
                const pos = slots.indexOf(p.id);
                const used = pos >= 0 || libero === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => place(p.id)}
                    className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-btn border bg-surface-2 px-3 text-ink ${used ? "border-line opacity-45" : "border-line-strong"}`}
                  >
                    <span className="font-display text-xl font-extrabold text-gold tabular-nums">{p.number}</span>
                    <span className="text-[13px]">{shortName(p)}</span>
                    <span className="text-[11px] text-faint">{libero === p.id ? "L" : pos >= 0 ? `P${pos + 1}` : roles[p.id]}</span>
                  </button>
                );
              })}
            </div>
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
                onClick={() => {
                  setSlots(EMPTY_SLOTS);
                  setLibero(null);
                  setTarget(0);
                }}
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
            {women.warn && <span className="text-red">Attenzione: meno di {MIN_WOMEN} donne in campo (o sesso non indicato).</span>}
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
