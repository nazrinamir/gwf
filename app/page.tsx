import { GAMES } from "./games";
import GameCarousel from "./ui/game-carousel";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-zinc-950 px-5 py-12 text-zinc-100 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-28 -top-20 h-80 w-80 rounded-full bg-rose-600/25 blur-3xl animate-float-slow" />
        <div
          className="absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-sky-600/20 blur-3xl animate-float-slow"
          style={{ animationDelay: "1.5s" }}
        />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(9,9,11,0.9))]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative w-full max-w-3xl animate-rise">
        <header className="mb-8 text-center sm:mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
            Pass the phone
          </p>
          <h1 className="mt-3 bg-linear-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
            Game Night
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
            One device. Secret roles. Pick a game and pass it around the table.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-zinc-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300 ring-1 ring-white/10">
              {GAMES.length} games
            </span>
            <span className="rounded-full bg-zinc-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300 ring-1 ring-white/10">
              No accounts
            </span>
            <span className="rounded-full bg-zinc-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300 ring-1 ring-white/10">
              Local play
            </span>
          </div>
        </header>

        <GameCarousel games={GAMES} />
      </div>
    </main>
  );
}
