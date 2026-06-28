export type Team = "village" | "werewolf" | "neutral";

export type RoleId = "werewolf" | "doctor" | "knight" | "jester" | "villager";

export interface Role {
  id: RoleId;
  name: string;
  team: Team;
  emoji: string;
  /** Card artwork served from /public/werewolf. */
  image: string;
  short: string;
  description: string;
}

export const ROLES: Record<RoleId, Role> = {
  werewolf: {
    id: "werewolf",
    name: "Werewolf",
    team: "werewolf",
    emoji: "🐺",
    image: "/werewolf/werewolf.png",
    short: "Hunt a house each night (80%).",
    description:
      "Each night you may attack a house. Your strike lands 80% of the time — fail and you can disguise your escape. Sleeping rests you but lowers your odds next time. Win when the wolves equal the rest of the village.",
  },
  doctor: {
    id: "doctor",
    name: "Doctor",
    team: "village",
    emoji: "🩺",
    image: "/werewolf/doctor.png",
    short: "Brew medicine to revive the fallen.",
    description:
      "Each night you brew medicine. With enough villager help you can revive one fallen player. Only ONE villager may help per night — a crowd just fumbles the cure.",
  },
  knight: {
    id: "knight",
    name: "Knight",
    team: "village",
    emoji: "🛡️",
    image: "/werewolf/knight.png",
    short: "Guard two houses; jail a suspect.",
    description:
      "Each night you post soldiers to guard two houses. If a wolf strikes a guarded house, a soldier dies in your stead and leaves a blood trail. Once per game you may jail a suspect — they're out until the village votes on their fate.",
  },
  jester: {
    id: "jester",
    name: "Jester",
    team: "neutral",
    emoji: "🃏",
    image: "/werewolf/jester.png",
    short: "Break in and run. Get voted out.",
    description:
      "Each night you may smash a window and flee, leaving a scare that looks exactly like a failed wolf attack. You win — alone — if the village votes to execute you.",
  },
  villager: {
    id: "villager",
    name: "Villager",
    team: "village",
    emoji: "🧑‍🌾",
    image: "/werewolf/villager.png",
    short: "No powers — but a hidden trait.",
    description:
      "You have no special power, but a hidden trait shapes your nights. Help the Doctor brew, aid the Lead Villager, and root out the wolves.",
  },
};

/** Villager-only hidden traits. Every villager gets exactly one. */
export type Trait = "shortsighted" | "drugaddict" | "insomniac";

export interface TraitInfo {
  id: Trait;
  name: string;
  emoji: string;
  short: string;
  description: string;
}

export const TRAITS: Record<Trait, TraitInfo> = {
  shortsighted: {
    id: "shortsighted",
    name: "Short-sighted",
    emoji: "👓",
    short: "Can't see who breaks in.",
    description:
      "If someone breaks into your house, you'll know it happened — but never who it was.",
  },
  drugaddict: {
    id: "drugaddict",
    name: "Drug addict",
    emoji: "🍄",
    short: "Hallucinates break-ins.",
    description:
      "Some nights you hallucinate that someone broke into your house — you can never be quite sure what was real.",
  },
  insomniac: {
    id: "insomniac",
    name: "Insomniac",
    emoji: "👁️",
    short: "Can spy on a house at night.",
    description:
      "Some nights you can creep to another house and witness what they're truly doing. If a wolf comes for you that night, you're already awake — and safe.",
  },
};

export const ALL_TRAITS: Trait[] = ["shortsighted", "drugaddict", "insomniac"];

/** Roles whose count is configured at setup. Villagers fill the rest. */
export const CONFIGURABLE_ROLES: RoleId[] = [
  "werewolf",
  "doctor",
  "knight",
  "jester",
];
