"use client";

import { FormEvent, useState } from "react";
import { login } from "@/lib/api";
import { Player } from "@/lib/types";

type MaintenanceScreenProps = {
  player?: Player | null;
  onLogin: (player: Player) => void;
  onLogout?: () => void;
};

export default function MaintenanceScreen({ player, onLogin, onLogout }: MaintenanceScreenProps) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2 || pin.length < 4) {
      setError("Enter your admin name and PIN.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const nextPlayer = await login(name, pin);
      onLogin(nextPlayer);
      if (!nextPlayer.isAdmin) {
        setError("Maintenance mode is active for your account. Please check back soon.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10">
      <section className="w-full rounded-3xl bg-white p-6 shadow-card">
        <div className="mb-6 inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-pitch">
          Kickoff Pool
        </div>
        <h1 className="text-3xl font-black leading-tight tracking-tight">Kickoff Pool is under maintenance</h1>
        <p className="mt-3 text-base leading-7 text-ink/65">
          We&rsquo;re making improvements. Please check back soon.
        </p>

        <form onSubmit={submit} className="mt-8 border-t border-black/[0.06] pt-5">
          <p className="text-sm font-extrabold text-ink">Admin access</p>
          <label className="mt-4 block text-sm font-bold">
            Name
            <input
              autoComplete="name"
              className="mt-2 h-12 w-full rounded-xl border border-black/10 px-4 outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15"
              placeholder="Admin name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="mt-4 block text-sm font-bold">
            PIN
            <input
              autoComplete="current-password"
              className="mt-2 h-12 w-full rounded-xl border border-black/10 px-4 tracking-[0.3em] outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15"
              inputMode="numeric"
              minLength={4}
              placeholder="0000"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </label>
          {player && !player.isAdmin && (
            <p className="mt-3 text-sm font-semibold text-ink/55">Signed in as {player.name}.</p>
          )}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
          <div className="mt-5 flex gap-2">
            <button
              disabled={busy}
              className="h-12 flex-1 rounded-xl bg-pitch font-bold text-white transition hover:bg-pitch/90 disabled:opacity-60"
            >
              {busy ? "Signing in..." : "Admin sign in"}
            </button>
            {player && onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="h-12 rounded-xl border border-black/10 bg-white px-4 text-sm font-bold text-ink transition hover:bg-black/[0.03]"
              >
                Sign out
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
