import { type Player, living, shuffle } from "./engine";
import { ROLES, type RoleId } from "./roles";

export type NightPromptKind = "real" | "decoy";

export interface NightPrompt {
  playerId: number;
  kind: NightPromptKind;
  /** Fake role UI shown on decoy turns (plain villagers only). */
  decoyRole?: RoleId;
}

const DECOY_ROLES: RoleId[] = ["werewolf", "doctor", "knight", "jester", "villager"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Roles that always get their real night screen. */
function needsRealPrompt(p: Player): boolean {
  if (p.role.id !== "villager") return true;
  if (p.trait === "insomniac") return true;
  return false;
}

/**
 * Build night prompts. Plain villagers (non-insomniac) have a 50% chance of
 * seeing a decoy role screen — their choice still resolves as sleep.
 *
 * The wolf pack always acts LAST (each group internally shuffled). This lets the
 * pack see their strike resolve privately during their own turn — guards and
 * other actions are already locked in by the time they move — so the result
 * never needs a separate "pass the phone to a werewolf" reveal afterwards.
 */
export function buildNightPrompts(players: Player[]): NightPrompt[] {
  const toPrompt = (p: Player): NightPrompt => {
    if (needsRealPrompt(p)) return { playerId: p.id, kind: "real" };
    if (Math.random() < 0.5) {
      return { playerId: p.id, kind: "decoy", decoyRole: pick(DECOY_ROLES) };
    }
    return { playerId: p.id, kind: "real" };
  };

  const alive = living(players);
  const villageTurns = shuffle(
    alive.filter((p) => p.role.team !== "werewolf"),
  ).map(toPrompt);
  const wolfTurns = shuffle(
    alive.filter((p) => p.role.team === "werewolf"),
  ).map(toPrompt);

  return [...villageTurns, ...wolfTurns];
}

export function decoyRoleLabel(roleId: RoleId): string {
  return ROLES[roleId].name;
}
