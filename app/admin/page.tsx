"use client";

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { generateFullTestTournament, saveResult } from "@/lib/api";
import { formatMatchTime } from "@/lib/time";
import { Player } from "@/lib/types";

const SESSION_KEY = "kickoff-pool-player";
const FULL_TEST_BUTTON = "Reset + Generate Full Test Tournament";
const KNOCKOUT_STAGES = new Set([
  "Round of 32",
  "Round of 16",
  "Quarterfinals",
  "Semifinals",
  "Third Place Match",
  "Final",
]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Supabase environment variables are not configured.");
}

const supabase = createClient(url, key);

type AdminMatch = {
  id: string;
  team_a: string;
  team_b: string;
  starts_at: string;
  stage: string;
  team_a_score: number | null;
  team_b_score: number | null;
  team_a_pk_score: number | null;
  team_b_pk_score: number | null;
};

function scoreValue(score: number | null | undefined) {
  return score == null ? "" : String(score);
}

function ScoreInput({
  value,
  onChange,
  label,
  max = 30,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  max?: number;
}) {
  return (
    <input
      aria-label={label}
      className="h-12 w-14 rounded-xl border border-black/10 bg-white text-center text-lg font-bold outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15"
      inputMode="numeric"
      max={max}
      min="0"
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function AdminMatchRow({
  match,
  onSave,
}: {
  match: AdminMatch;
  onSave: (
    matchId: string,
    teamAScore: number,
    teamBScore: number,
    teamAPkScore?: number,
    teamBPkScore?: number,
  ) => Promise<void>;
}) {
  const [teamAScore, setTeamAScore] = useState(scoreValue(match.team_a_score));
  const [teamBScore, setTeamBScore] = useState(scoreValue(match.team_b_score));
  const [teamAPkScore, setTeamAPkScore] = useState(scoreValue(match.team_a_pk_score));
  const [teamBPkScore, setTeamBPkScore] = useState(scoreValue(match.team_b_pk_score));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const knockout = KNOCKOUT_STAGES.has(match.stage);
  const tied = teamAScore !== "" && teamAScore === teamBScore;
  const showPenaltyInputs = knockout && tied;
  const penaltyReady =
    !showPenaltyInputs ||
    (teamAPkScore !== "" && teamBPkScore !== "" && teamAPkScore !== teamBPkScore);
  const canSave = teamAScore !== "" && teamBScore !== "" && penaltyReady;

  useEffect(() => {
    setDirty(false);
  }, [match.id]);

  useEffect(() => {
    if (dirty) return;
    setTeamAScore(scoreValue(match.team_a_score));
    setTeamBScore(scoreValue(match.team_b_score));
    setTeamAPkScore(scoreValue(match.team_a_pk_score));
    setTeamBPkScore(scoreValue(match.team_b_pk_score));
  }, [
    dirty,
    match.team_a_score,
    match.team_b_score,
    match.team_a_pk_score,
    match.team_b_pk_score,
  ]);

  function updateTeamAScore(value: string) {
    setDirty(true);
    setTeamAScore(value);
  }

  function updateTeamBScore(value: string) {
    setDirty(true);
    setTeamBScore(value);
  }

  function updateTeamAPkScore(value: string) {
    setDirty(true);
    setTeamAPkScore(value);
  }

  function updateTeamBPkScore(value: string) {
    setDirty(true);
    setTeamBPkScore(value);
  }

  async function save() {
    if (!canSave) return;
    setMessage("Saving...");
    try {
      await onSave(
        match.id,
        Number(teamAScore),
        Number(teamBScore),
        showPenaltyInputs ? Number(teamAPkScore) : undefined,
        showPenaltyInputs ? Number(teamBPkScore) : undefined,
      );
      setDirty(false);
      setMessage("Saved");
      setTimeout(() => setMessage(""), 1600);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink/45">
        <span>{match.stage}</span>
        <span>
          {formatMatchTime(match.starts_at)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right font-extrabold leading-tight">{match.team_a}</div>
        <div className="flex items-center gap-2">
          <ScoreInput
            label={`${match.team_a} final goals`}
            value={teamAScore}
            onChange={updateTeamAScore}
          />
          <span className="font-bold text-ink/30">:</span>
          <ScoreInput
            label={`${match.team_b} final goals`}
            value={teamBScore}
            onChange={updateTeamBScore}
          />
        </div>
        <div className="font-extrabold leading-tight">{match.team_b}</div>
      </div>
      {showPenaltyInputs && (
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-right text-xs font-black uppercase tracking-[0.16em] text-ink/45">
            PK
          </div>
          <div className="flex items-center gap-2">
            <ScoreInput
              label={`${match.team_a} penalty kicks`}
              max={20}
              value={teamAPkScore}
              onChange={updateTeamAPkScore}
            />
            <span className="font-bold text-ink/30">:</span>
            <ScoreInput
              label={`${match.team_b} penalty kicks`}
              max={20}
              value={teamBPkScore}
              onChange={updateTeamBPkScore}
            />
          </div>
          <div className="text-xs font-semibold text-ink/45">No ties</div>
        </div>
      )}
      <div className="mt-4 flex min-h-9 items-center justify-between border-t border-black/[0.06] pt-3">
        <span
          className={`max-w-[65%] text-xs font-semibold ${
            message && message !== "Saved" && message !== "Saving..."
              ? "text-red-700"
              : "text-pitch"
          }`}
        >
          {message ||
            (showPenaltyInputs && teamAPkScore === teamBPkScore && teamAPkScore !== ""
              ? "Penalty scores cannot be tied."
              : "")}
        </span>
        <button
          className="rounded-lg bg-ink px-4 py-2 text-xs font-bold text-white disabled:opacity-30"
          disabled={!canSave}
          onClick={save}
        >
          Save score
        </button>
      </div>
    </article>
  );
}

export default function AdminPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testBusy, setTestBusy] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(SESSION_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }

    const savedPlayer = JSON.parse(saved) as Player;
    setPlayer(savedPlayer);

    if (!savedPlayer.isAdmin) {
      setLoading(false);
      return;
    }

    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const { data, error: matchesError } = await supabase
        .from("matches")
        .select(
          "id, team_a, team_b, starts_at, stage, team_a_score, team_b_score, team_a_pk_score, team_b_pk_score",
        )
        .order("starts_at");

      if (matchesError) throw new Error(matchesError.message);
      setMatches((data ?? []) as AdminMatch[]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load matches.");
    } finally {
      setLoading(false);
    }
  }

  async function updateResult(
    matchId: string,
    teamAScore: number,
    teamBScore: number,
    teamAPkScore?: number,
    teamBPkScore?: number,
  ) {
    if (!player) return;
    await saveResult(player, matchId, teamAScore, teamBScore, teamAPkScore, teamBPkScore);
    await refresh();
  }

  async function generateFullTest() {
    if (!player) return;
    setTestBusy(FULL_TEST_BUTTON);
    setTestMessage("");
    setError("");

    try {
      await generateFullTestTournament(player);
      await refresh();
      setTestMessage("Full test tournament generated successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate full test tournament.";
      setError(message);
      setTestMessage(message);
    } finally {
      setTestBusy(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6">
        <p className="py-12 text-center text-sm text-ink/50">Loading admin...</p>
      </main>
    );
  }

  if (!player?.isAdmin) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10">
        <section className="w-full rounded-3xl bg-white p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pitch">Admin results</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Access denied</h1>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Only pool admins can edit official results.
          </p>
          <Link
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-pitch font-bold text-white"
            href="/"
          >
            Back to pool
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-6 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pitch">Admin results</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Official scores</h1>
        </div>
        <Link className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold" href="/">
          Pool
        </Link>
      </header>

      {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <section className="mt-6 space-y-3">
        <div className="mb-4">
          <h2 className="text-xl font-black">Edit final scores</h2>
          <p className="mt-1 text-sm text-ink/55">The leaderboard recalculates from these saved results.</p>
          <div className="mt-4 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-extrabold">Fast bracket test</p>
                <p className="mt-1 text-xs leading-5 text-ink/55">
                  Reset the knockout bracket, fill the tournament, and advance every round.
                </p>
              </div>
              <button
                className="min-h-11 rounded-xl bg-pitch px-4 py-2 text-sm font-bold text-white transition hover:bg-pitch/90 disabled:opacity-60"
                disabled={testBusy !== null}
                onClick={generateFullTest}
              >
                {testBusy === FULL_TEST_BUTTON ? "Generating..." : FULL_TEST_BUTTON}
              </button>
            </div>
            {testMessage && <p className="mt-3 text-sm font-semibold text-pitch">{testMessage}</p>}
          </div>
        </div>
        {matches.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink/50">No matches found.</p>
        ) : (
          matches.map((match) => <AdminMatchRow key={match.id} match={match} onSave={updateResult} />)
        )}
      </section>
    </main>
  );
}
