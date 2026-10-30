"use client";

// Storico live (README → Admin Storico live): partite registrate, set, azioni dalla più recente con il
// punteggio ricalcolato; si correggono solo le partite concluse. Ogni salvataggio ricalcola sul
// server punteggi e parziali; la pagina si ricarica con i dati nuovi.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BTN_DANGER, BTN_GOLD_OUTLINE, BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from "@/components/admin/styles";
import { TEAM_NAME } from "@/lib/club";
import { describeEvent, playerLabel } from "@/lib/live/describe";
import { isTeamFault, type Side } from "@/lib/live/skills";
import { activeEvents } from "@/lib/live/state";
import {
  EDIT_SKILLS,
  EDIT_SKILL_LABEL,
  defaultOutcome,
  editOf,
  isDeletable,
  isEditable,
  outcomeOptions,
  pointOf,
  setRows,
  setsOf,
  type ActionEdit,
  type EditSkill,
} from "@/lib/live/storico";
import type { LiveEvent, LiveLineup, LivePlayer } from "@/lib/live/types";
import { fullName } from "@/lib/players";
import { starClass } from "../live/[matchId]/live-ui";
import { addEvent, deleteEvent, saveEvent } from "./actions";

export type StoricoTab = { id: number; label: string; sub: string };
type Filter = "all" | "todo" | "star";
/** Riga aperta: un evento, oppure una nuova azione (in fondo al set o dopo un'azione). */
type Open = { kind: "event"; id: string } | { kind: "new"; afterId: string | null } | null;

type Props = {
  tabs: StoricoTab[];
  match: { id: number; opponent: string; finished: boolean };
  players: LivePlayer[];
  lineups: LiveLineup[];
  events: LiveEvent[];
};

const NEW_ACTION: ActionEdit = { skill: "attack", outcome: "kill", playerId: null, star: false };
const SEG = "min-h-11 cursor-pointer rounded-seg px-3 font-display text-[15px] font-bold tracking-[.06em] whitespace-nowrap uppercase";
const CHIP = "min-h-11 cursor-pointer rounded-pill border px-3 font-display text-sm font-semibold tracking-[.06em] whitespace-nowrap uppercase";

export function StoricoBoard({ tabs, match, players, lineups, events }: Props) {
  const router = useRouter();
  const byId = new Map(players.map((p) => [p.id, p]));
  const playerOf = (id: number) => byId.get(id);
  const sets = setsOf(events);
  const active = activeEvents(events);
  const todoIn = (n: number) => active.filter((e) => e.setN === n && e.incomplete).length;
  const todoTotal = active.filter((e) => e.incomplete).length;

  const [setN, setSetN] = useState(sets[0] ?? 1);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Open>(null);

  // Più recenti in alto, come nel Live.
  const rows = setRows(lineups, events, setN).reverse();
  const shown = rows.filter((r) => filter === "all" || (filter === "todo" ? r.event.incomplete : r.event.star));

  const chooseFilter = (next: Filter) => {
    setFilter(next);
    setOpen(null);
    if (next !== "todo") return;
    // Si va dritti alla prima azione da completare (anche in un altro set).
    const n = todoIn(setN) ? setN : sets.find((s) => todoIn(s));
    if (n === undefined) return;
    setSetN(n);
    const first = setRows(lineups, events, n).reverse().find((r) => r.event.incomplete);
    if (first) setOpen({ kind: "event", id: first.event.id });
  };

  /** Dopo "Salva e prossima": la successiva nella lista (con "Da completare", la prossima incompleta, anche nel set dopo). */
  const nextAfter = (id: string): Open => {
    if (filter === "todo") {
      const here = shown.find((r) => r.event.id !== id);
      if (here) return { kind: "event", id: here.event.id };
      const n = sets.find((s) => s > setN && setRows(lineups, events, s).some((r) => r.event.incomplete && r.event.id !== id));
      if (n === undefined) return null;
      setSetN(n);
      const first = setRows(lineups, events, n).reverse().find((r) => r.event.incomplete);
      return first ? { kind: "event", id: first.event.id } : null;
    }
    const k = shown.findIndex((r) => r.event.id === id);
    const next = shown.slice(k + 1).find((r) => isEditable(r.event));
    return next ? { kind: "event", id: next.event.id } : null;
  };

  const editor = (event: LiveEvent | null, afterId: string | null) => (
    <EventEditor
      key={event?.id ?? `new-${afterId}`}
      matchId={match.id}
      setN={setN}
      event={event}
      afterId={afterId}
      players={players}
      onClose={() => setOpen(null)}
      onSaved={(next) => {
        setOpen(next);
        router.refresh();
      }}
      nextAfter={nextAfter}
      onAddAfter={() => event && setOpen({ kind: "new", afterId: event.id })}
    />
  );

  return (
    <div className="flex flex-col gap-4.5">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin/storico?partita=${t.id}`}
            aria-current={t.id === match.id ? "page" : undefined}
            className={`flex min-h-16 flex-none flex-col justify-center gap-0.5 rounded-tile border px-3.5 py-2.5 text-ink hover:text-ink ${t.id === match.id ? "border-gold bg-surface-sel" : "border-line bg-surface"}`}
          >
            <span className="font-display text-[17px] font-bold whitespace-nowrap uppercase">{t.label}</span>
            <span className="text-[13px] whitespace-nowrap text-muted">{t.sub}</span>
          </Link>
        ))}
      </div>

      {!match.finished && (
        <p role="status" className="rounded-tile border border-gold-line bg-surface-sel px-3.5 py-2.5 text-sm text-ink-2">
          Partita in corso: qui la vedi in sola lettura, si corregge quando è conclusa (così non si sovrascrive con il telefono del Live).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label="Set" className="flex flex-wrap gap-1 rounded-btn border border-line p-0.5">
          {sets.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={n === setN}
              onClick={() => {
                setSetN(n);
                setOpen(null);
              }}
              className={`${SEG} ${n === setN ? "bg-gold text-bg" : "text-muted"}`}
            >
              Set {n}
              {todoIn(n) > 0 && <span className={n === setN ? "" : "text-red"}> · {todoIn(n)}</span>}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filtro" className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Tutte"],
              ["todo", `Da completare · ${todoTotal}`],
              ["star", "Solo ★"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => chooseFilter(k)}
              className={`${CHIP} ${filter === k ? "border-gold bg-gold text-bg" : k === "todo" && todoTotal ? "border-red-line text-red" : "border-line-strong text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="mr-auto text-sm text-muted">{shown.length === 1 ? "1 azione" : `${shown.length} azioni`}</span>
        {match.finished && (
          <button type="button" onClick={() => setOpen({ kind: "new", afterId: null })} className={BTN_GOLD_OUTLINE}>
            + Aggiungi azione
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        {open?.kind === "new" && open.afterId === null && (
          <div className="border-b border-line-soft bg-surface-sel">
            <p className="px-4 pt-3 text-sm text-gold">Nuova azione in fondo al set {setN}</p>
            {editor(null, null)}
          </div>
        )}
        {shown.length === 0 && (
          <p className="px-4 py-5 text-sm text-muted">
            {filter === "todo" ? "Nessuna azione da completare in questo set." : filter === "star" ? "Nessuna azione con la stellina in questo set." : "Nessuna azione in questo set."}
          </p>
        )}
        {shown.map(({ event, score }) => {
          const isOpen = open?.kind === "event" && open.id === event.id;
          const canOpen = match.finished && (isEditable(event) || isDeletable(event));
          const row = rowText(event, playerOf, match.opponent);
          return (
            <div key={event.id} className={`border-b border-line-soft last:border-b-0 ${isOpen ? "bg-surface-sel" : ""}`}>
              {open?.kind === "new" && open.afterId === event.id && (
                <div className="border-b border-line-soft">
                  <p className="px-4 pt-3 text-sm text-gold">Nuova azione dopo questa</p>
                  {editor(null, event.id)}
                </div>
              )}
              <button
                type="button"
                disabled={!canOpen}
                aria-expanded={canOpen ? isOpen : undefined}
                onClick={() => setOpen(isOpen ? null : { kind: "event", id: event.id })}
                className="grid min-h-14 w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left text-ink enabled:cursor-pointer enabled:hover:bg-surface-sel"
              >
                <span className={`font-display text-lg font-bold tabular-nums ${scoreTone(event.point)}`}>
                  {score.us}–{score.them}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={`text-[15px] ${row.muted ? "text-muted" : "text-ink"}`}>{row.title}</span>
                  {row.who && <span className="truncate text-[13px] text-muted">{row.who}</span>}
                </span>
                <span className="flex items-center gap-2.5 text-[13px] font-semibold whitespace-nowrap">
                  <Tag event={event} />
                  {canOpen && <span className="text-faint">{isOpen ? "▲" : "▼"}</span>}
                </span>
              </button>
              {isOpen && editor(event, null)}
            </div>
          );
        })}
      </div>
      <span className="text-[13px] text-faint">
        Modificare un&apos;azione che assegna un punto ricalcola il punteggio delle azioni successive, i parziali e le statistiche dei giocatori.
      </span>
    </div>
  );
}

function scoreTone(point: Side | null) {
  return point === "us" ? "text-gold" : point === "them" ? "text-ink" : "text-faint";
}

/** Testo della riga: fondamentale · esito e chi (gli altri eventi come nel feed del Live, in grigio). */
function rowText(e: LiveEvent, playerOf: (id: number) => LivePlayer | undefined, opponent: string) {
  if (!isEditable(e)) return { title: describeEvent(e, playerOf, opponent), who: null, muted: true };
  const skill = e.skill as EditSkill | null;
  if (!skill) {
    const title = e.point === "us" ? `Punto ${TEAM_NAME}` : e.point === "them" ? `Punto ${opponent}` : "Azione";
    return { title, who: e.playerId ? playerLabel(playerOf(e.playerId)) : "come e chi da indicare", muted: false };
  }
  const outcome = outcomeOptions(skill).find((o) => o.key === editOf(e).outcome)?.label;
  const title = outcome ? `${EDIT_SKILL_LABEL[skill]} · ${outcome}` : EDIT_SKILL_LABEL[skill];
  const who =
    skill === "opp_error" || skill === "opp_point"
      ? opponent
      : e.playerId
        ? playerLabel(playerOf(e.playerId))
        : isTeamFault(skill, e.outcome)
          ? TEAM_NAME
          : "giocatore da indicare";
  return { title, who, muted: false };
}

function Tag({ event }: { event: LiveEvent }) {
  if (event.incomplete) return <span className="text-red">da completare</span>;
  if (event.star) return <span className="text-gold">★</span>;
  if (event.point === "us") return <span className="text-gold">+1 noi</span>;
  if (event.point === "them") return <span className="text-muted">+1 loro</span>;
  return null;
}

const POINT_TEXT = { us: "+1 noi", them: "+1 loro" } as const;
const pointText = (p: Side | null) => (p ? POINT_TEXT[p] : "nessun punto");

/** Modifica di un'azione (o nuova azione): fondamentale, esito, giocatore, ★; Elimina, Salva, Salva e prossima. */
function EventEditor({
  matchId,
  setN,
  event,
  afterId,
  players,
  onClose,
  onSaved,
  nextAfter,
  onAddAfter,
}: {
  matchId: number;
  setN: number;
  /** null = nuova azione. */
  event: LiveEvent | null;
  afterId: string | null;
  players: LivePlayer[];
  onClose: () => void;
  onSaved: (next: Open) => void;
  nextAfter: (id: string) => Open;
  /** Apre una nuova azione subito dopo questa. */
  onAddAfter: () => void;
}) {
  const [edit, setEdit] = useState<ActionEdit>(() => (event ? editOf(event) : NEW_ACTION));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const actionEvent = !event || isEditable(event);
  const outcomes = outcomeOptions(edit.skill);
  const opp = edit.skill === "opp_error" || edit.skill === "opp_point";
  // Né per l'avversario né per il fallo di posizione (di squadra) si sceglie un giocatore.
  const noPlayer = opp || isTeamFault(edit.skill, edit.outcome);
  const before = event?.point ?? null;
  const after = pointOf(edit, before);

  const run = (task: () => Promise<{ ok: true; id: string } | { ok: false; error: string }>, next: (id: string) => Open) =>
    startTransition(async () => {
      setError(null);
      const res = await task().catch(() => null);
      if (!res) return setError("Serve la rete per salvare");
      if (!res.ok) return setError(res.error);
      onSaved(next(res.id));
    });

  const save = (andNext: boolean) =>
    run(
      () => (event ? saveEvent({ matchId, eventId: event.id, edit }) : addEvent({ matchId, setN, afterId, edit })),
      (id) => (andNext && event ? nextAfter(id) : null),
    );

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-1 pb-4.5">
      {actionEvent && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Fondamentale</span>
            <select
              value={edit.skill ?? ""}
              onChange={(e) => {
                const skill = (e.target.value || null) as EditSkill | null;
                setEdit({ ...edit, skill, outcome: defaultOutcome(skill, before) });
              }}
              className={INPUT}
            >
              {(!event || event.skill === null) && <option value="">— Da completare —</option>}
              {EDIT_SKILLS.map((s) => (
                <option key={s} value={s}>
                  {EDIT_SKILL_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          {outcomes.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>{edit.skill === "opp_error" ? "Errore" : "Esito"}</span>
              <select value={edit.outcome ?? ""} onChange={(e) => setEdit({ ...edit, outcome: e.target.value })} className={INPUT}>
                {outcomes.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!noPlayer && (
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Giocatore</span>
              <select
                value={edit.playerId ?? ""}
                onChange={(e) => setEdit({ ...edit, playerId: e.target.value ? Number(e.target.value) : null })}
                className={INPUT}
              >
                <option value="">— Nessuno —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.number} {fullName(p)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {actionEvent && event && after !== before && (
        <p role="status" className="text-sm text-gold">
          Cambia il punteggio: {pointText(before)} → {pointText(after)}. Il set e le azioni dopo si ricalcolano.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[15px] text-red">
          {error}
        </p>
      )}

      {confirmDelete && event ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-btn border border-red-line p-3">
          <span className="mr-auto text-[15px] text-ink">Eliminare questa voce? Il punteggio si ricalcola.</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteEvent({ matchId, eventId: event.id }), () => null)}
            className={`${BTN_DANGER} border border-red-line`}
          >
            Elimina
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)} className={BTN_SECONDARY}>
            No
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Sopra le opzioni della riga, sotto i salvataggi a tutta larghezza (comodi col pollice). */}
          <div className="flex flex-wrap items-center gap-2">
            {actionEvent && (
              <button type="button" aria-pressed={edit.star} onClick={() => setEdit({ ...edit, star: !edit.star })} className={starClass(edit.star)}>
                ★ Meritevole
              </button>
            )}
            {event && (
              <button type="button" onClick={onAddAfter} className={BTN_SECONDARY}>
                + Dopo questa
              </button>
            )}
            {event && isDeletable(event) && (
              <button type="button" onClick={() => setConfirmDelete(true)} className={`${BTN_DANGER} ml-auto`}>
                Elimina
              </button>
            )}
          </div>
          {actionEvent && (
            <div className="grid gap-2 sm:grid-cols-2">
              {event ? (
                <button type="button" disabled={pending} onClick={() => save(false)} className={BTN_PRIMARY}>
                  {pending ? "Salvo…" : "Salva"}
                </button>
              ) : (
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>
                  Annulla
                </button>
              )}
              {event ? (
                <button type="button" disabled={pending} onClick={() => save(true)} className={BTN_GOLD_OUTLINE}>
                  Salva e prossima →
                </button>
              ) : (
                <button type="button" disabled={pending} onClick={() => save(false)} className={BTN_PRIMARY}>
                  {pending ? "Salvo…" : "Aggiungi"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
