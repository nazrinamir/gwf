export type Team = "village" | "werewolf" | "vampire" | "neutral";

export type ClassicRoleId =
  | "alpha"
  | "werewolf"
  | "villager"
  | "seeker"
  | "knight"
  | "vampire"
  | "jester"
  | "cupid"
  | "hunter";

export interface ClassicRole {
  id: ClassicRoleId;
  name: string;
  team: Team;
  emoji: string;
  image: string;
  short: string;
  description: string;
}

export const CLASSIC_ROLES: Record<ClassicRoleId, ClassicRole> = {
  alpha: {
    id: "alpha",
    name: "Alpha Werewolf",
    team: "werewolf",
    emoji: "🐺",
    image: "/werewolf/werewolf.png",
    short: "Lead the pack; kill or convert.",
    description:
      "You lead the Werewolves. Each night the pack chooses one player — you may kill them, or convert them into a Werewolf instead.",
  },
  werewolf: {
    id: "werewolf",
    name: "Werewolf",
    team: "werewolf",
    emoji: "🐺",
    image: "/werewolf/werewolf.png",
    short: "Hunt with the pack each night.",
    description:
      "You wake with the Werewolf team and help choose one player to kill each night.",
  },
  villager: {
    id: "villager",
    name: "Villager",
    team: "village",
    emoji: "🧑‍🌾",
    image: "/werewolf/villager.png",
    short: "No power — discuss and vote.",
    description:
      "You have no special power. Discuss, investigate through conversation, and vote during the day.",
  },
  seeker: {
    id: "seeker",
    name: "Seeker",
    team: "village",
    emoji: "🔍",
    image: "/werewolf/seeker.png",
    short: "Learn if someone is a Werewolf.",
    description:
      "Each night, check one player to learn whether they are a Werewolf.",
  },
  knight: {
    id: "knight",
    name: "Knight",
    team: "village",
    emoji: "🛡️",
    image: "/werewolf/knight.png",
    short: "Protect one player each night.",
    description:
      "Each night, protect another player. They cannot be killed or converted that night.",
  },
  vampire: {
    id: "vampire",
    name: "Vampire",
    team: "vampire",
    emoji: "🧛",
    image: "/werewolf/doctor.png",
    short: "Bite and convert at night.",
    description:
      "Each night you may bite a player and convert them into a Vampire.",
  },
  jester: {
    id: "jester",
    name: "Jester",
    team: "neutral",
    emoji: "🃏",
    image: "/werewolf/jester.png",
    short: "Get voted out to win.",
    description:
      "You win alone by convincing the Village to vote you out.",
  },
  cupid: {
    id: "cupid",
    name: "Cupid",
    team: "village",
    emoji: "💘",
    image: "/werewolf/villager.png",
    short: "Link two players as Lovers.",
    description:
      "On the first night, select two players to become Lovers. If one dies, the other dies too.",
  },
  hunter: {
    id: "hunter",
    name: "Hunter",
    team: "village",
    emoji: "🏹",
    image: "/werewolf/knight.png",
    short: "Take someone with you when you die.",
    description:
      "When you are killed — by vote or by a Werewolf attack — you immediately choose another player to die with you.",
  },
};

/** Roles whose count is set at setup. Villagers fill the rest. */
export const CLASSIC_CONFIGURABLE: ClassicRoleId[] = [
  "alpha",
  "werewolf",
  "seeker",
  "knight",
  "vampire",
  "jester",
  "cupid",
  "hunter",
];
