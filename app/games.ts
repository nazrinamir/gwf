export interface GameMenuItem {
  href: string;
  title: string;
  image: string;
  /** CSS object-position so the subject sits in the visible hero area. */
  imagePosition?: string;
  /** Short pitch under the title on the card. */
  blurb: string;
  /** Small label above the title. */
  tag: string;
  /** Tailwind ring color applied on hover. */
  hoverRing: string;
  /** Accent used for active glow / CTA. */
  accent: "rose" | "sky" | "emerald" | "amber";
}

export const GAMES: GameMenuItem[] = [
  {
    href: "/werewolf",
    title: "Werewolf",
    image: "/werewolf-card.png",
    tag: "Social deduction",
    blurb: "Classic & Village · day, vote, night",
    hoverRing: "group-hover:ring-rose-400/70",
    accent: "rose",
  },
  {
    href: "/impostor",
    title: "Who is the Impostor?",
    image: "/impostor-card.png",
    tag: "Word game",
    blurb: "One secret word · find the fake",
    hoverRing: "group-hover:ring-sky-400/70",
    accent: "sky",
  },
  {
    href: "/tictactoe",
    title: "BliTTTz",
    image: "/tictactoe-card.png",
    imagePosition: "center 55%",
    tag: "2 players",
    blurb: "Keep 3 marks · race the clock",
    hoverRing: "group-hover:ring-emerald-400/70",
    accent: "emerald",
  },
  {
    href: "/charade",
    title: "Charade",
    image: "/charade-card.png",
    imagePosition: "center 36%",
    tag: "Forehead",
    blurb: "Tilt down correct · tilt up skip",
    hoverRing: "group-hover:ring-amber-400/70",
    accent: "amber",
  },
];
