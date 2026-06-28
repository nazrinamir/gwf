import { GAMES } from "./games";
import GameCarousel from "./ui/game-carousel";

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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(9,9,11,0.85))]" />
      </div>

      <div className="relative w-full max-w-3xl animate-rise">
        <header className="mb-10 text-center">
          <h1 className="bg-linear-to-b from-white to-zinc-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
            Game Night
          </h1>
          <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            One device · Pass &amp; play
          </p>
        </header>

        <GameCarousel games={GAMES} />
      </div>
    </main>
  );
}
