export interface GameMenuItem {
  href: string;
  title: string;
  image: string;
  /** Tailwind object-position class so the subject sits in the visible hero area. */
  imagePosition?: string;
  /** Short pitch under the title on the card. */
  blurb: string;
  /** Small label above the title. */
  tag: string;
  /** Tailwind ring color applied on hover. */
  hoverRing: string;
  /** Accent used for active glow / CTA. */
  accent: "rose" | "sky" | "emerald";
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
    title: "Infinity TTT",
    image: "/tictactoe-card.png",
    // Board sits mid-frame; shift crop so it shows above the text fade.
    imagePosition: "object-[center_68%]",
    tag: "2 players",
    blurb: "Keep 3 marks · oldest fades away",
    hoverRing: "group-hover:ring-emerald-400/70",
    accent: "emerald",
  },
];
