import Link from "next/link";

const games = [
  {
    href: "/werewolf",
    title: "Werewolf",
    tagline: "Deception after dark",
    description:
      "Secretly deal roles around one phone, then survive the night-and-day showdown in person.",
    emoji: "🐺",
    players: "4–18",
    tags: ["6 roles", "Social deduction"],
    tile: "from-rose-500 to-red-700",
    glow: "bg-rose-500/20",
    hoverRing: "group-hover:ring-rose-400/70",
    cta: "text-rose-300",
  },
  {
    href: "/impostor",
    title: "Who is the Impostor?",
    tagline: "Blend in or get caught",
    description:
      "Everyone learns the secret word — except the impostors, who only get a hint. Drop clues, then reveal.",
    emoji: "🕵️",
    players: "3–20",
    tags: ["N impostors", "Word clues"],
    tile: "from-sky-500 to-indigo-700",
    glow: "bg-sky-500/20",
    hoverRing: "group-hover:ring-sky-400/70",
    cta: "text-sky-300",
  },
];

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-zinc-950 px-5 py-16 text-zinc-100">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose-600/20 blur-3xl animate-float-slow" />
        <div
          className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl animate-float-slow"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-600/10 blur-3xl animate-float-slow"
          style={{ animationDelay: "3s" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(9,9,11,0.85))]" />
      </div>

      <div className="relative w-full max-w-3xl animate-rise">
        <header className="mb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-zinc-300 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            One device · Pass &amp; play
          </span>
          <h1 className="mt-6 bg-linear-to-b from-white to-zinc-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
            Game Night
          </h1>
          <p className="mx-auto mt-4 max-w-md text-balance text-base leading-relaxed text-zinc-400">
            Gather everyone around a single phone. Pick a game, hand out secret
            roles, and let the real-life chaos begin.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {games.map((game) => (
            <Link
              key={game.href}
              href={game.href}
              className={`group relative overflow-hidden rounded-3xl bg-zinc-900/70 p-6 ring-1 ring-white/10 backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-zinc-900 hover:ring-2 ${game.hoverRing}`}
            >
              {/* Card glow on hover */}
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${game.glow} blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
              />

              <div className="relative flex h-full flex-col">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br ${game.tile} text-3xl shadow-lg ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-110`}
                >
                  {game.emoji}
                </div>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                  {game.title}
                </h2>
                <p className="text-sm font-medium text-zinc-400">
                  {game.tagline}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-300">
                  {game.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-200 ring-1 ring-white/10">
                    👥 {game.players}
                  </span>
                  {game.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-400 ring-1 ring-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className={`text-sm font-semibold ${game.cta}`}>
                    Start playing
                  </span>
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-white/10 ${game.cta}`}
                  >
                    <span className="transition-transform duration-300 group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-zinc-600">
          No accounts, no setup — just you, your friends, and one screen.
        </p>
      </div>
    </main>
  );
}
