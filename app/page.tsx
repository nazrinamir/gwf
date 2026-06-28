import Image from "next/image";
import Link from "next/link";
import { GAMES } from "./games";

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

        <div className="grid gap-5 sm:grid-cols-2">
          {GAMES.map((game) => (
            <Link
              key={game.href}
              href={game.href}
              className={`group relative aspect-3/4 overflow-hidden rounded-3xl ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-2 ${game.hoverRing}`}
            >
              <Image
                src={game.image}
                alt={game.title}
                fill
                priority
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />
              <h2 className="absolute inset-x-0 bottom-0 p-6 text-center text-3xl font-bold tracking-tight drop-shadow-lg">
                {game.title}
              </h2>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
