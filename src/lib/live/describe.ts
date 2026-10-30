// Testo leggibile di un evento per il feed "Ultime azioni" (e in futuro per lo Storico).
import { TEAM_NAME } from "../club";
import { ROLE_LABEL, shortName } from "../players";
import { BALL_TYPE_LABEL, SKILL_LABEL, oppErrorLabel, outcomeOf, type Skill } from "./skills";
import type { LiveEvent, LivePlayer } from "./types";

export function playerLabel(p: LivePlayer | undefined) {
  return p ? `#${p.number} ${shortName(p)}` : "giocatore?";
}

export function describeEvent(e: LiveEvent, playerOf: (id: number) => LivePlayer | undefined, opponent: string) {
  const who = e.playerId ? ` · ${playerLabel(playerOf(e.playerId))}` : "";
  const d = e.detail ?? {};
  const team = (side: "us" | "them" | null | undefined) => (side === "us" ? TEAM_NAME : opponent);
  switch (e.kind) {
    case "rotation":
      return d.dir === -1 ? "Rotazione indietro" : "Rotazione manuale";
    case "set_end":
      return "Fine set";
    case "lineup":
      return `Formazione set ${e.setN}`;
    case "timeout":
      return `Timeout ${team(d.side)}`;
    case "correction":
      return `Correzione punteggio: ${d.delta === -1 ? "−1" : "+1"} ${team(e.point)}`;
    case "swap":
      return `Scambio di posto · ${playerLabel(playerOf(d.in ?? 0))} ↔ ${playerLabel(playerOf(d.out ?? 0))}`;
    case "sub": {
      const role = d.role ? ` (${ROLE_LABEL[d.role]})` : "";
      return `Cambio · entra ${playerLabel(playerOf(d.in ?? 0))}${role}, esce ${playerLabel(playerOf(d.out ?? 0))}`;
    }
    case "libero": {
      const inn = playerOf(d.in ?? 0);
      if (!d.out) return `Libero scelto · ${playerLabel(inn)}`;
      const out = playerOf(d.out);
      if (inn?.role === "L" && out?.role === "L") return `Cambio libero · entra ${playerLabel(inn)}, esce ${playerLabel(out)}`;
      if (inn?.role === "L") return `Libero entra per ${playerLabel(out)}`;
      if (out?.role === "L") return `Libero esce · rientra ${playerLabel(inn)}`;
      return `Libero · entra ${playerLabel(inn)}, esce ${playerLabel(out)}`;
    }
  }
  if (e.skill === "opp_point") return `Punto ${opponent}`;
  if (e.skill === "opp_error") {
    const what = e.detail?.oppError
      ? ` · ${oppErrorLabel(e.detail.oppError).toLowerCase()}`
      : e.detail?.ballType
        ? ` · ${BALL_TYPE_LABEL[e.detail.ballType]}`
        : "";
    return `Errore ${opponent}${what}`;
  }
  if (!e.skill) return e.point === "us" ? `Punto ${TEAM_NAME}` : e.point === "them" ? `Punto ${opponent}` : "Azione";
  const outcome = e.outcome ? outcomeOf(e.skill as Skill, e.outcome)?.label.toLowerCase() : "";
  return `${SKILL_LABEL[e.skill as Skill]}${outcome ? ` ${outcome}` : ""}${who}`;
}
