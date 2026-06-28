export type Team = "village" | "werewolf" | "neutral";

export type RoleId =
  | "werewolf"
  | "doctor"
  | "seeker"
  | "knight"
  | "jester"
  | "villager";

export interface Role {
  id: RoleId;
  name: string;
  team: Team;
  emoji: string;
  short: string;
  description: string;
  /** Whether a moderator wakes this role during the night phase. */
  nightAction: boolean;
}

export const ROLES: Record<RoleId, Role> = {
  werewolf: {
    id: "werewolf",
    name: "Werewolf",
    team: "werewolf",
    emoji: "🐺",
    short: "Eliminate a player each night.",
    description:
      "Each night the werewolves wake together and silently agree on one player to eliminate. By day, blend in and avoid suspicion. Werewolves win when they equal or outnumber the village.",
    nightAction: true,
  },
  doctor: {
    id: "doctor",
    name: "Doctor",
    team: "village",
    emoji: "🩺",
    short: "Protect one player each night.",
    description:
      "Each night, choose one player to save. If the werewolves attack that player, they survive. You may protect yourself, but choose wisely — the right save can swing the game.",
    nightAction: true,
  },
  seeker: {
    id: "seeker",
    name: "Seeker",
    team: "village",
    emoji: "🔮",
    short: "Inspect one player each night.",
    description:
      "Each night, point at one player. The moderator silently signals whether that player is a werewolf. Use what you learn to guide the village — but reveal yourself too early and the wolves will target you.",
    nightAction: true,
  },
  knight: {
    id: "knight",
    name: "Knight",
    team: "village",
    emoji: "🛡️",
    short: "One-time public strike.",
    description:
      "Once per game, during the day, you may publicly draw your sword and strike a player you suspect. If they are a werewolf, they are eliminated. If they are innocent, you fall instead. Use it to break a deadlock.",
    nightAction: false,
  },
  jester: {
    id: "jester",
    name: "Jester",
    team: "neutral",
    emoji: "🃏",
    short: "Get yourself voted out to win.",
    description:
      "You are on nobody's side. You win — instantly and alone — if the village votes to eliminate you during the day. Act suspicious enough to get lynched, but not so obvious that they spare you out of spite.",
    nightAction: false,
  },
  villager: {
    id: "villager",
    name: "Villager",
    team: "village",
    emoji: "🧑‍🌾",
    short: "No powers — just your wits.",
    description:
      "You have no special ability. Watch the discussion, share your reads, and vote carefully each day. The village wins when every werewolf has been eliminated.",
    nightAction: false,
  },
};

/** Roles that can be assigned a configurable count during setup (villager fills the rest). */
export const CONFIGURABLE_ROLES: RoleId[] = [
  "werewolf",
  "doctor",
  "seeker",
  "knight",
  "jester",
];

/** Suggested order the moderator should call roles during the night. */
export const NIGHT_ORDER: RoleId[] = ["werewolf", "doctor", "seeker"];
