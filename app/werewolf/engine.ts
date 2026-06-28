import { ROLES, type Role, type Trait } from "./roles";

export interface Player {
  id: number;
  name: string;
  role: Role;
  /** Villagers only. */
  trait: Trait | null;
  alive: boolean;
  isLead: boolean;
  /** Jailed by the Knight — cannot act or vote until judged. */
  jailed: boolean;
}

export type Winner = "village" | "werewolf" | "jester";

export const WOLF_RATE_MAX = 80;
export const WOLF_RATE_MIN = 10;
export const WOLF_RATE_PENALTY = 20;
export const INSOMNIAC_RATE = 30;
export const DRUG_HALLUCINATION_RATE = 50;
export const DOCTOR_HELP_NEEDED = 2;

/* ----------------------------- Actions ----------------------------- */

export type NightActionType =
  | "sleep"
  | "wolf_attack"
  | "doctor_brew"
  | "doctor_revive"
  | "knight_guard"
  | "jester_break"
  | "villager_help"
  | "insomniac_visit";

export interface NightInput {
  playerId: number;
  type: NightActionType;
  targets: number[];
  reviveId?: number;
}

export type WolfDisguiseMode = "player" | "knight";

/** Chosen by wolves after a failed kill roll on an unguarded house. */
export interface WolfDisguise {
  mode: WolfDisguiseMode;
  /** Player mode — who witnesses think they saw (chosen at random). */
  disguiseAsId?: number;
}

export interface NightResolveOptions {
  /** Blood marks lingering from earlier nights. */
  bloodMarks?: number[];
  /** House the wolves smear the soldier's blood onto after being blocked. */
  bloodPlantTarget?: number;
  /** Cover story chosen after a failed kill roll. */
  wolfDisguise?: WolfDisguise;
}

/* ------------------------- Narrative flavor ------------------------- */

export const WOLF_ACTIVITIES = [
  "sharpening long claws by candlelight",
  "stirring a strange, red-tinged stew",
  "dancing alone in the dark",
  "scrubbing something dark off their hands",
  "howling softly at a cracked window",
  "burying a heavy bundle in the yard",
  "pacing back and forth, muttering",
];

export const CALM_ACTIVITIES = [
  "reading by candlelight",
  "fast asleep in bed",
  "praying quietly",
  "mending a torn shirt",
  "finishing a late supper",
  "writing in a journal",
];

const PEACEFUL_LINES = [
  "I slept peacefully. Nothing happened.",
  "I slept like a stone. The night was quiet.",
  "I heard nothing but crickets. A good night's rest.",
  "I pulled the covers tight and didn't stir until dawn.",
];

const HOODED_BREAKIN_LINES = [
  "Glass shattered and a hooded figure bolted from my house into the night!",
  "Someone smashed my window and fled before I could reach the door!",
  "I woke to splintered glass — whoever it was was already gone.",
];

const NAMED_BREAKIN_LINES = (who: string) => [
  `I saw ${who} break into my house and run away!`,
  `${who} crashed through my window last night and fled into the dark!`,
  `I'm certain it was ${who} — I watched them scramble out of my house!`,
];

const KNIGHT_DISGUISE_LINES = [
  "An armored figure battered my door, then vanished — one of the Knight's soldiers, perhaps?",
  "Heavy boots and clanking steel on my porch… then silence. A soldier's patrol gone wrong?",
  "Someone in armor tried my window, then retreated like a startled sentry.",
];

const SHORTSIGHTED_BREAKIN_LINES = [
  "Someone smashed my window and fled — but my eyes are too weak to tell who it was.",
  "I heard the crash and running footsteps, yet the intruder was only a blur.",
  "Glass rained on my floor. Someone was here — I just can't say who.",
];

const DRUG_UNCERTAIN_LINES = [
  "I think someone broke in last night… or did I dream it again? I can't be sure.",
  "My window looks fine, but I swear I heard someone inside. Was it real?",
  "Part of me remembers an intruder. Part of me remembers nothing. I don't trust either memory.",
];

const DRUG_HALLUCINATION_LINES = [
  "I heard glass shatter and footsteps in the night… yet every window is whole. Was it real?",
  "Someone was in my room — I know it — but there's not a mark on the house.",
  "I woke screaming at a shadow by my bed. Dawn came and the house was untouched.",
];

const GUARD_BLOOD_LINES = [
  "A soldier lay dead at my doorstep, and blood trailed off into the dark. Something tried to reach me.",
  "There was blood on my threshold and a fallen guard. Whatever came for me was turned away.",
  "A soldier died defending my door. The trail of blood leads away into the village.",
];

const BLOOD_MARK_LINES = [
  "There's dried blood on my doorstep from a night past. No one has come to clean it.",
  "The blood stain outside my house still hasn't washed away. Something wicked was here.",
];

const INSOMNIAC_FAIL_LINES = [
  "I couldn't sleep and wandered the village, but the night gave up no secrets.",
  "I prowled the lanes until dawn and learned nothing worth telling.",
  "Sleep wouldn't come. I watched the village — it watched me back, silently.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function roll(percent: number): boolean {
  return Math.random() * 100 < percent;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ----------------------------- Helpers ----------------------------- */

export function living(players: Player[]): Player[] {
  return players.filter((p) => p.alive && !p.jailed);
}

export function aliveWolves(players: Player[]): Player[] {
  return players.filter((p) => p.alive && p.role.team === "werewolf");
}

function aliveNonWolves(players: Player[]): Player[] {
  return players.filter((p) => p.alive && p.role.team !== "werewolf");
}

export function checkWinner(players: Player[]): Winner | null {
  const wolves = aliveWolves(players).length;
  const others = aliveNonWolves(players).length;
  if (wolves === 0) return "village";
  if (wolves >= others) return "werewolf";
  return null;
}

export function name(players: Player[], id: number): string {
  return players.find((p) => p.id === id)?.name ?? "someone";
}

/** Pick a random villager-team player to be framed by a wolf disguise. */
export function randomDisguiseTarget(
  players: Player[],
  exclude: number[] = [],
): number | null {
  const pool = players.filter(
    (p) =>
      p.alive &&
      !p.jailed &&
      p.role.team !== "werewolf" &&
      !exclude.includes(p.id),
  );
  const fallback = players.filter(
    (p) => p.alive && !p.jailed && !exclude.includes(p.id),
  );
  const chosen = pool.length ? pool : fallback;
  if (!chosen.length) return null;
  return pick(chosen).id;
}

/* --------------------------- Resolution --------------------------- */

export interface MorningReport {
  playerId: number;
  line: string;
}

export interface NightResult {
  players: Player[];
  wolfRate: number;
  doctorHelp: number;
  bloodMarks: number[];
  /** Houses freshly blood-marked this night — reported to the Lead Villager. */
  bloodReport: number[];
  /** Lead-only news (doctor potion progress / result). */
  news: string[];
  deaths: number[];
  revived: number[];
  reports: MorningReport[];
}

export type NightResolution =
  | { status: "complete"; result: NightResult }
  | { status: "wolf_blood"; guardedHouse: number }
  | { status: "wolf_failed"; attackHouse: number }
  | { status: "wolf_killed"; target: number; result: NightResult };

interface PrepState {
  guarded: Set<number>;
  insomniacVisited: Map<number, number>;
  jesterBreaks: Set<number>;
  slept: Set<number>;
  nextDoctorHelp: number;
  revivedId: number | null;
  doctorPresent: boolean;
  doctorAwake: boolean;
  helpersCount: number;
  anyWolfActed: boolean;
  packTarget: number | null;
  nextWolfRate: number;
}

function prepNight(
  players: Player[],
  inputs: NightInput[],
  wolfRate: number,
  doctorHelp: number,
): PrepState {
  const byPlayer = new Map<number, NightInput>();
  for (const i of inputs) byPlayer.set(i.playerId, i);

  const guarded = new Set<number>();
  for (const p of players) {
    if (!p.alive || p.jailed) continue;
    const inp = byPlayer.get(p.id);
    if (!inp) continue;
    if (p.role.id === "knight" && inp.type === "knight_guard") {
      for (const t of inp.targets) guarded.add(t);
    }
  }

  const insomniacVisited = new Map<number, number>();
  for (const p of players) {
    if (!p.alive || p.jailed) continue;
    const inp = byPlayer.get(p.id);
    if (!inp) continue;
    if (
      p.role.id === "villager" &&
      p.trait === "insomniac" &&
      inp.type === "insomniac_visit" &&
      inp.targets.length > 0
    ) {
      insomniacVisited.set(p.id, inp.targets[0]);
    }
  }

  const jesterBreaks = new Set<number>();
  const slept = new Set<number>();
  for (const p of players) {
    if (!p.alive || p.jailed) continue;
    const inp = byPlayer.get(p.id);
    if (!inp) continue;
    if (inp.type === "sleep") slept.add(p.id);
    if (p.role.id === "jester" && inp.type === "jester_break") {
      for (const t of inp.targets) jesterBreaks.add(t);
    }
  }

  let nextDoctorHelp = doctorHelp;
  let revivedId: number | null = null;
  const helpers = players.filter((p) => {
    if (!p.alive || p.jailed || p.role.id !== "villager") return false;
    const inp = byPlayer.get(p.id);
    return inp?.type === "villager_help";
  });
  const doctor = players.find((p) => p.alive && !p.jailed && p.role.id === "doctor");
  const doctorInput = doctor ? byPlayer.get(doctor.id) : undefined;
  const doctorAwake = !!(doctor && doctorInput && doctorInput.type !== "sleep");

  if (doctorAwake) {
    if (helpers.length === 1) nextDoctorHelp = doctorHelp + 1;
    if (
      doctorInput?.type === "doctor_revive" &&
      doctorInput.reviveId != null &&
      nextDoctorHelp >= DOCTOR_HELP_NEEDED
    ) {
      revivedId = doctorInput.reviveId;
      nextDoctorHelp = 0;
    }
  }

  const wolfTargets: number[] = [];
  let anyWolfActed = false;
  for (const p of aliveWolves(players)) {
    if (p.jailed) continue;
    const inp = byPlayer.get(p.id);
    if (inp && inp.type === "wolf_attack" && inp.targets.length > 0) {
      wolfTargets.push(inp.targets[0]);
      anyWolfActed = true;
    }
  }

  let nextWolfRate = wolfRate;
  let packTarget: number | null = null;

  if (!anyWolfActed) {
    nextWolfRate = Math.max(WOLF_RATE_MIN, wolfRate - WOLF_RATE_PENALTY);
  } else {
    const tally = new Map<number, number>();
    for (const t of wolfTargets) tally.set(t, (tally.get(t) ?? 0) + 1);
    let best = -1;
    const top: number[] = [];
    for (const [t, c] of tally) {
      if (c > best) {
        best = c;
        top.length = 0;
        top.push(t);
      } else if (c === best) top.push(t);
    }
    packTarget = pick(top);
    nextWolfRate = WOLF_RATE_MAX;
  }

  return {
    guarded,
    insomniacVisited,
    jesterBreaks,
    slept,
    nextDoctorHelp,
    revivedId,
    doctorPresent: !!doctor,
    doctorAwake,
    helpersCount: helpers.length,
    anyWolfActed,
    packTarget,
    nextWolfRate,
  };
}

interface AttackOutcome {
  finalTarget: number | null;
  succeeded: boolean;
  /** Attempted but no kill (roll miss, insomniac save, or disguise pass). */
  attempted: boolean;
  disguise?: WolfDisguise;
  /** Houses where a soldier died blocking the wolves. */
  guardBlocked: Set<number>;
}

function disguisedBreakInLine(
  players: Player[],
  victim: Player,
  disguise: WolfDisguise | undefined,
): string {
  if (victim.role.id === "villager" && victim.trait === "shortsighted") {
    return pick(SHORTSIGHTED_BREAKIN_LINES);
  }
  if (victim.role.id === "villager" && victim.trait === "drugaddict") {
    return pick(DRUG_UNCERTAIN_LINES);
  }
  if (disguise?.mode === "knight") return pick(KNIGHT_DISGUISE_LINES);
  if (disguise?.mode === "player" && disguise.disguiseAsId != null) {
    return pick(NAMED_BREAKIN_LINES(name(players, disguise.disguiseAsId)));
  }
  return pick(HOODED_BREAKIN_LINES);
}

function buildReports(
  players: Player[],
  prep: PrepState,
  attack: AttackOutcome,
  bloodMarks: number[],
): MorningReport[] {
  const reports: MorningReport[] = [];
  const { insomniacVisited, jesterBreaks, slept } = prep;

  // The final house the wolves left evidence at (attempted but no kill).
  const wolfBreak =
    attack.attempted && !attack.succeeded ? attack.finalTarget : null;

  for (const p of players) {
    if (!p.alive) continue;

    if (p.jailed) {
      reports.push({
        playerId: p.id,
        line: "I was locked in the cell all night. I saw nothing.",
      });
      continue;
    }

    if (insomniacVisited.has(p.id)) {
      const targetId = insomniacVisited.get(p.id)!;
      const targetName = name(players, targetId);
      if (roll(INSOMNIAC_RATE)) {
        const target = players.find((pl) => pl.id === targetId);
        const activity =
          target?.role.team === "werewolf"
            ? pick(WOLF_ACTIVITIES)
            : pick(CALM_ACTIVITIES);
        reports.push({
          playerId: p.id,
          line: `I couldn't sleep, so I crept to ${targetName}'s house. Through the window I saw them ${activity}.`,
        });
      } else {
        reports.push({ playerId: p.id, line: pick(INSOMNIAC_FAIL_LINES) });
      }
      continue;
    }

    // A soldier died here turning the wolves back.
    if (attack.guardBlocked.has(p.id)) {
      reports.push({ playerId: p.id, line: pick(GUARD_BLOOD_LINES) });
      continue;
    }

    if (wolfBreak === p.id) {
      reports.push({
        playerId: p.id,
        line: disguisedBreakInLine(players, p, attack.disguise),
      });
      continue;
    }

    if (jesterBreaks.has(p.id)) {
      reports.push({
        playerId: p.id,
        line: disguisedBreakInLine(players, p, undefined),
      });
      continue;
    }

    if (bloodMarks.includes(p.id)) {
      reports.push({ playerId: p.id, line: pick(BLOOD_MARK_LINES) });
      continue;
    }

    if (
      p.role.id === "villager" &&
      p.trait === "drugaddict" &&
      roll(DRUG_HALLUCINATION_RATE)
    ) {
      reports.push({ playerId: p.id, line: pick(DRUG_HALLUCINATION_LINES) });
      continue;
    }

    reports.push({ playerId: p.id, line: pick(PEACEFUL_LINES) });
  }

  return shuffle(reports);
}

function finishNight(
  players: Player[],
  prep: PrepState,
  attack: AttackOutcome,
  bloodMarks: number[],
  bloodReport: number[] = [],
): NightResult {
  let next = players.map((p) => ({ ...p }));

  const deaths: number[] = [];
  if (attack.succeeded && attack.finalTarget != null) {
    next = next.map((p) =>
      p.id === attack.finalTarget ? { ...p, alive: false } : p,
    );
    deaths.push(attack.finalTarget);
  }

  const revived: number[] = [];
  if (prep.revivedId != null) {
    const dead = next.find((p) => p.id === prep.revivedId && !p.alive);
    if (dead) {
      next = next.map((p) =>
        p.id === prep.revivedId ? { ...p, alive: true } : p,
      );
      revived.push(prep.revivedId);
    }
  }

  const reports = buildReports(players, prep, attack, bloodMarks);

  // Event-only flavor; the standing medicine status is rendered in the UI.
  const news: string[] = [];
  if (prep.doctorPresent) {
    if (revived.length > 0) {
      news.push(
        `✨ The doctor's potion worked — ${revived
          .map((id) => name(players, id))
          .join(", ")} breathes again!`,
      );
    } else if (prep.doctorAwake && prep.helpersCount > 1) {
      news.push(
        `Too many villagers (${prep.helpersCount}) crowded the doctor — the potion was ruined tonight.`,
      );
    }
  }

  return {
    players: next,
    wolfRate: prep.nextWolfRate,
    doctorHelp: prep.nextDoctorHelp,
    bloodMarks,
    bloodReport,
    news,
    deaths,
    revived,
    reports,
  };
}

/**
 * Resolve a night. May pause to ask the wolves for a new target (guarded
 * house) or a disguise (failed strike), and reveals a successful kill before
 * completing.
 */
export function resolveNight(
  players: Player[],
  inputs: NightInput[],
  wolfRate: number,
  doctorHelp: number,
  options: NightResolveOptions = {},
): NightResolution {
  const prep = prepNight(players, inputs, wolfRate, doctorHelp);
  const bloodMarks = [...(options.bloodMarks ?? [])];

  if (!prep.anyWolfActed) {
    return {
      status: "complete",
      result: finishNight(
        players,
        prep,
        { finalTarget: null, succeeded: false, attempted: false, guardBlocked: new Set() },
        bloodMarks,
      ),
    };
  }

  const attackTarget = prep.packTarget!;

  // Hit a guarded house: the soldier dies and the wolves are left bloodied.
  if (prep.guarded.has(attackTarget)) {
    // Pack must smear the soldier's blood onto a house before dawn.
    if (options.bloodPlantTarget == null) {
      return { status: "wolf_blood", guardedHouse: attackTarget };
    }

    const plant = options.bloodPlantTarget;
    const newMarks = bloodMarks.includes(plant)
      ? bloodMarks
      : [...bloodMarks, plant];

    const attack: AttackOutcome = {
      finalTarget: attackTarget,
      succeeded: false,
      attempted: false, // the kill was stopped at the door
      guardBlocked: new Set([attackTarget]),
    };

    return {
      status: "complete",
      result: finishNight(players, prep, attack, newMarks, [plant]),
    };
  }

  let succeeded = false;

  if (prep.insomniacVisited.has(attackTarget)) {
    // Target was out prowling — the strike finds an empty bed.
    succeeded = false;
  } else if (options.wolfDisguise) {
    // Follow-up after a confirmed miss; don't re-roll.
    succeeded = false;
  } else if (roll(wolfRate)) {
    succeeded = true;
  } else {
    // Missed and not yet disguised — ask the pack how to cover up.
    return { status: "wolf_failed", attackHouse: attackTarget };
  }

  const attack: AttackOutcome = {
    finalTarget: attackTarget,
    succeeded,
    attempted: true,
    disguise: options.wolfDisguise,
    guardBlocked: new Set(),
  };

  const result = finishNight(players, prep, attack, bloodMarks);

  if (succeeded) {
    return { status: "wolf_killed", target: attackTarget, result };
  }
  return { status: "complete", result };
}

export function makePlayers(
  names: string[],
  roleIds: { role: Role; trait: Trait | null }[],
): Player[] {
  return roleIds.map((r, i) => ({
    id: i,
    name: names[i],
    role: r.role,
    trait: r.trait,
    alive: true,
    isLead: false,
    jailed: false,
  }));
}

export { ROLES };
