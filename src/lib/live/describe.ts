// Testo leggibile di un evento per il feed "Ultime azioni" (e in futuro per lo Storico).
import { TEAM_NAME } from "../club";
import { shortName } from "../players";
import { BALL_TYPE_LABEL, SKILL_LABEL, outcomeOf, type Skill } from "./skills";
import type { LiveEvent, LivePlayer } from "./types";

export function playerLabel(p: LivePlayer | undefined) {
  return p ? `#${p.number} ${shortName(p)}` : "giocatore?";
}

export function describeEvent(e: LiveEvent, playerOf: (id: number) => LivePlayer | undefined, opponent: string) {
  const who = e.playerId ? ` · ${playerLabel(playerOf(e.playerId))}` : "";
  if (e.kind === "rotation") return e.detail?.dir === -1 ? "Rotazione indietro" : "Rotazione manuale";
  if (e.kind === "set_end") return "Fine set";
  if (e.skill === "opp_point") return `Punto ${opponent}`;
  if (e.skill === "opp_error") {
    const ball = e.detail?.ballType ? ` · ${BALL_TYPE_LABEL[e.detail.ballType]}` : "";
    return `Errore ${opponent}${ball}`;
  }
  if (!e.skill) return e.point === "us" ? `Punto ${TEAM_NAME}` : e.point === "them" ? `Punto ${opponent}` : "Azione";
  const outcome = e.outcome ? outcomeOf(e.skill as Skill, e.outcome)?.label.toLowerCase() : "";
  return `${SKILL_LABEL[e.skill as Skill]}${outcome ? ` ${outcome}` : ""}${who}`;
}
