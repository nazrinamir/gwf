export interface GameMenuItem {
  href: string;
  title: string;
  image: string;
  /** Tailwind ring color applied on hover. */
  hoverRing: string;
}

export const GAMES: GameMenuItem[] = [
  {
    href: "/werewolf",
    title: "Werewolf",
    image: "/werewolf-card.png",
    hoverRing: "group-hover:ring-rose-400/70",
  },
  {
    href: "/impostor",
    title: "Who is the Impostor?",
    image: "/impostor-card.png",
    hoverRing: "group-hover:ring-sky-400/70",
  },
];
