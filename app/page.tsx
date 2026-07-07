"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { changePin, importOfficialScoresSoFar, loadPool, login, resetTestResults, saveFavoriteTeam, savePrediction, saveResult } from "@/lib/api";
import MaintenanceScreen from "@/app/MaintenanceScreen";
import { isMaintenanceMode } from "@/lib/maintenance";
import { predictionPoints } from "@/lib/scoring";
import { formatMatchTime, matchDateFromUtc } from "@/lib/time";
import { AdvancingTeam, Match, Player, PoolData, Prediction } from "@/lib/types";

const SESSION_KEY = "kickoff-pool-player";
const LEADERBOARD_RANKS_KEY = "kickoff-pool-leaderboard-ranks";
const KNOCKOUT_STAGES = [
  { label: "Round of 32", stage: "Round of 32" },
  { label: "Round of 16", stage: "Round of 16" },
  { label: "Quarterfinals", stage: "Quarterfinals" },
  { label: "Semifinals", stage: "Semifinals" },
  { label: "Third Place", stage: "Third Place Match" },
  { label: "Final", stage: "Final" },
];
const TEST_KNOCKOUT_STAGES = [
  {
    busy: "r16",
    button: "Generate Test Round of 16 Results",
    plural: "Round of 16 matches",
    singular: "Round of 16 match",
    stage: "Round of 16",
  },
  {
    busy: "qf",
    button: "Generate Test Quarterfinal Results",
    plural: "Quarterfinal matches",
    singular: "Quarterfinal match",
    stage: "Quarterfinals",
  },
  {
    busy: "sf",
    button: "Generate Test Semifinal Results",
    plural: "Semifinal matches",
    singular: "Semifinal match",
    stage: "Semifinals",
  },
  {
    busy: "third",
    button: "Generate Test Third Place Result",
    plural: "Third Place Matches",
    singular: "Third Place Match",
    stage: "Third Place Match",
  },
  {
    busy: "final",
    button: "Generate Test Final Result",
    plural: "Final matches",
    singular: "Final",
    stage: "Final",
  },
];

function ScoreInput({ value, onChange, disabled, label, max = 30 }: { value: string; onChange: (value: string) => void; disabled?: boolean; label: string; max?: number }) {
  return <input aria-label={label} className="h-12 w-14 rounded-xl border border-black/10 bg-white text-center text-lg font-bold outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15 disabled:bg-black/5" disabled={disabled} inputMode="numeric" min="0" max={max} type="number" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function Login({ onLogin }: { onLogin: (player: Player) => void }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2 || pin.length < 4) return setError("Enter your name and a PIN with at least 4 digits.");
    setBusy(true); setError("");
    try { onLogin(await login(name, pin)); } catch (err) { setError(err instanceof Error ? err.message : "Could not sign in."); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10">
      <section className="w-full">
        <div className="mb-8 inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-pitch">World Cup 2026</div>
        <h1 className="max-w-sm text-5xl font-black leading-[0.95] tracking-[-0.055em]">Call the score.<br /><span className="text-pitch">Claim the table.</span></h1>
        <p className="mt-5 max-w-sm text-base leading-7 text-ink/65">Make your picks before kickoff and follow the leaderboard as results come in.</p>
        <button type="button" onClick={() => setScoringOpen(true)} className="mt-5 h-11 rounded-xl border border-black/10 bg-white px-4 text-sm font-bold text-ink shadow-sm transition hover:bg-black/[0.03] focus:outline-none focus:ring-2 focus:ring-pitch/20">How scoring works</button>
        <form onSubmit={submit} className="mt-9 rounded-3xl bg-white p-5 shadow-card">
          <label className="block text-sm font-bold">Your name<input autoComplete="name" className="mt-2 h-12 w-full rounded-xl border border-black/10 px-4 outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15" placeholder="e.g. Jamie" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="mt-4 block text-sm font-bold">Your PIN<input autoComplete="current-password" className="mt-2 h-12 w-full rounded-xl border border-black/10 px-4 tracking-[0.3em] outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15" inputMode="numeric" minLength={4} placeholder="0000" type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} /></label>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
          <button disabled={busy} className="mt-5 h-12 w-full rounded-xl bg-pitch font-bold text-white transition hover:bg-pitch/90 disabled:opacity-60">{busy ? "Signing in..." : "Enter the pool"}</button>
        </form>
      </section>
      {scoringOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-5 py-8" role="dialog" aria-modal="true" aria-labelledby="scoring-title">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <h2 id="scoring-title" className="text-xl font-black">How scoring works</h2>
              <button type="button" onClick={() => setScoringOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 text-lg font-black text-ink/55 transition hover:bg-black/[0.03]" aria-label="Close scoring details">&times;</button>
            </div>
            <div className="mt-4 space-y-2 text-sm font-semibold leading-6 text-ink/70">
              <div className="rounded-xl bg-black/[0.03] px-3 py-2">
                <div className="flex justify-between gap-4"><span>Exact score</span><span className="font-black text-pitch">5 points</span></div>
                <p className="mt-1 text-xs leading-5 text-ink/50">Example: You pick 2-1 and final is 2-1.</p>
              </div>
              <div className="rounded-xl bg-black/[0.03] px-3 py-2">
                <div className="flex justify-between gap-4"><span>Correct winner or correct draw</span><span className="font-black text-pitch">3 points</span></div>
                <p className="mt-1 text-xs leading-5 text-ink/50">Example: You pick 2-0 and final is 1-0.</p>
              </div>
              <div className="rounded-xl bg-black/[0.03] px-3 py-2">
                <div className="flex justify-between gap-4"><span>Each team goal predicted correctly</span><span className="font-black text-pitch">1 point per team</span></div>
                <p className="mt-1 text-xs leading-5 text-ink/50">Example: You pick 2-0 and final is 2-3, you still get 1 point because the first team's goals were correct.</p>
              </div>
              <div className="flex justify-between gap-4 rounded-xl bg-black/[0.03] px-3 py-2"><span>Wrong prediction</span><span className="font-black text-ink">0 points</span></div>
            </div>
            <div className="mt-4 border-t border-black/[0.06] pt-4 text-sm font-semibold leading-6 text-ink/65">
              <p>Picks lock at kickoff.</p>
              <p>Picks can be changed until kickoff.</p>
              <p>Highest total points wins.</p>
            </div>
            <button type="button" onClick={() => setScoringOpen(false)} className="mt-5 h-11 w-full rounded-xl bg-ink text-sm font-bold text-white transition hover:bg-ink/90">Close</button>
          </div>
        </div>
      )}
    </main>
  );
}

function pointBreakdown(prediction: Prediction, match: Match) {
  if (match.teamAScore === null || match.teamBScore === null) return [];

  const predictedGoalDifference = prediction.teamAScore - prediction.teamBScore;
  const actualGoalDifference = match.teamAScore - match.teamBScore;
  const items: { label: string; points: number }[] = [];

  if (Math.sign(predictedGoalDifference) === Math.sign(actualGoalDifference)) {
    items.push({ label: "🏆 Correct outcome", points: 3 });
  }
  if (prediction.teamAScore === match.teamAScore && prediction.teamBScore === match.teamBScore) {
    items.push({ label: "🎯 Exact score", points: 2 });
  }
  if (predictedGoalDifference === actualGoalDifference) {
    items.push({ label: "📐 Correct margin", points: 1 });
  }
  if (prediction.teamAScore === match.teamAScore) {
    items.push({ label: `⚽ ${match.teamA} score`, points: 1 });
  }
  if (prediction.teamBScore === match.teamBScore) {
    items.push({ label: `⚽ ${match.teamB} score`, points: 1 });
  }

  return items.length > 0 ? items : [{ label: "No points", points: 0 }];
}

function penaltyWinner(match: Match) {
  if (match.teamAPkScore === null || match.teamBPkScore === null) return null;
  if (match.teamAPkScore > match.teamBPkScore) return match.teamA;
  if (match.teamBPkScore > match.teamAPkScore) return match.teamB;
  return null;
}

function MatchCard({
  match,
  prediction,
  admin,
  showOfficialResult = false,
  onSavePrediction,
  onSaveResult,
}: {
  match: Match;
  prediction?: Prediction;
  admin: boolean;
  showOfficialResult?: boolean;
  onSavePrediction: (prediction: Prediction) => Promise<void>;
  onSaveResult: (matchId: string, a: number, b: number, teamAPkScore?: number, teamBPkScore?: number) => Promise<void>;
}) {
  const [a, setA] = useState(prediction?.teamAScore.toString() ?? "");
  const [b, setB] = useState(prediction?.teamBScore.toString() ?? "");
  const [teamAPkScore, setTeamAPkScore] = useState(match.teamAPkScore?.toString() ?? "");
  const [teamBPkScore, setTeamBPkScore] = useState(match.teamBPkScore?.toString() ?? "");
  const [advancingTeam, setAdvancingTeam] = useState<AdvancingTeam | null>(prediction?.advancingTeam ?? null);
  const [message, setMessage] = useState("");
  const [scoringDetailsOpen, setScoringDetailsOpen] = useState(false);
  const locked = matchDateFromUtc(match.startsAt) <= new Date();
  const completed = match.teamAScore !== null && match.teamBScore !== null;
  const knockout = KNOCKOUT_STAGES.some((option) => option.stage === match.stage);
  const isPlaceholder =
    !match.teamA ||
    !match.teamB ||
    match.teamA === "TBD" ||
    match.teamB === "TBD" ||
    match.teamA.startsWith("Winner") ||
    match.teamB.startsWith("Winner");
  const tiedScore = a !== "" && b !== "" && a === b;
  const showPenaltyInputs = admin && knockout && !isPlaceholder;
  const showAdvancerInputs = !admin && knockout && tiedScore && !isPlaceholder;
  const penaltyReady =
    !admin ||
    !knockout ||
    !tiedScore ||
    (teamAPkScore !== "" && teamBPkScore !== "" && teamAPkScore !== teamBPkScore);
  const hasPenaltyResult =
    knockout &&
    completed &&
    match.teamAScore === match.teamBScore &&
    match.teamAPkScore !== null &&
    match.teamBPkScore !== null;
  const canSubmit = a !== "" && b !== "" && penaltyReady && (!showAdvancerInputs || advancingTeam !== null);
  const matchTime = formatMatchTime(match.startsAt);
  const pointsEarned =
    !admin && completed && prediction
      ? predictionPoints(prediction.teamAScore, prediction.teamBScore, match.teamAScore!, match.teamBScore!)
      : null;
  const pointsBreakdown = completed && prediction ? pointBreakdown(prediction, match) : [];
  const showUserResultSummary = !admin && !showOfficialResult && (completed || (locked && !completed));

  useEffect(() => {
    setA((showOfficialResult || admin) && match.teamAScore !== null ? String(match.teamAScore) : prediction?.teamAScore.toString() ?? "");
    setB((showOfficialResult || admin) && match.teamBScore !== null ? String(match.teamBScore) : prediction?.teamBScore.toString() ?? "");
    setTeamAPkScore(match.teamAPkScore !== null ? String(match.teamAPkScore) : "");
    setTeamBPkScore(match.teamBPkScore !== null ? String(match.teamBPkScore) : "");
    setAdvancingTeam(prediction?.advancingTeam ?? null);
    setScoringDetailsOpen(false);
  }, [prediction, admin, showOfficialResult, match.teamAScore, match.teamBScore, match.teamAPkScore, match.teamBPkScore]);

  async function submit() {
    if (!canSubmit) return;
    setMessage("Saving...");
    try {
      if (admin) await onSaveResult(match.id, Number(a), Number(b), tiedScore ? Number(teamAPkScore) : undefined, tiedScore ? Number(teamBPkScore) : undefined);
      else await onSavePrediction({ matchId: match.id, teamAScore: Number(a), teamBScore: Number(b), advancingTeam: showAdvancerInputs ? advancingTeam : null });
      setMessage("Saved"); setTimeout(() => setMessage(""), 1600);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not save."); }
  }

  return (
    <article data-match-id={match.id} className="scroll-mt-6 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider text-ink/45">
        <span>{match.stage}</span>
        <span className="flex items-center gap-2">
          {locked && !admin && <span className="rounded-full bg-black/[0.06] px-2 py-1 text-[0.65rem] text-ink/65">Locked</span>}
          <span>{completed ? "Final" : matchTime}</span>
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right font-extrabold leading-tight">{match.teamA}</div>
        {isPlaceholder ? (
          <div className="max-w-36 text-center text-xs font-bold leading-4 text-ink/45">Bracket not determined yet</div>
        ) : (
          <div className="flex items-center gap-2"><ScoreInput label={`${match.teamA} goals`} value={a} onChange={setA} disabled={showOfficialResult || (!admin && locked)} /><span className="font-bold text-ink/30">:</span><ScoreInput label={`${match.teamB} goals`} value={b} onChange={setB} disabled={showOfficialResult || (!admin && locked)} /></div>
        )}
        <div className="font-extrabold leading-tight">{match.teamB}</div>
      </div>
      {showPenaltyInputs && (
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-black/[0.03] px-3 py-3">
          <div className="text-right text-xs font-black uppercase tracking-[0.16em] text-ink/45">PK</div>
          <div className="flex items-center gap-2">
            <ScoreInput label={`${match.teamA} penalty kicks`} value={teamAPkScore} onChange={setTeamAPkScore} max={20} />
            <span className="font-bold text-ink/30">:</span>
            <ScoreInput label={`${match.teamB} penalty kicks`} value={teamBPkScore} onChange={setTeamBPkScore} max={20} />
          </div>
          <div className="text-xs font-semibold text-ink/45">Penalties</div>
        </div>
      )}
      {showAdvancerInputs && (
        <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-3">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Who Advances?</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { value: "team_a" as const, label: match.teamA },
              { value: "team_b" as const, label: match.teamB },
            ].map((option) => (
              <label key={option.value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${advancingTeam === option.value ? "border-pitch bg-lime/40 text-pitch" : "border-black/10 bg-white text-ink/70 hover:bg-black/[0.02]"}`}>
                <input
                  checked={advancingTeam === option.value}
                  className="h-4 w-4 accent-pitch"
                  name={`advances-${match.id}`}
                  type="radio"
                  value={option.value}
                  onChange={() => setAdvancingTeam(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {hasPenaltyResult && !showUserResultSummary && (
        <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-2 text-center text-xs font-bold text-ink/55">
          <div>{match.teamA} {match.teamAScore} - {match.teamBScore} {match.teamB}</div>
          <div className="mt-1 text-pitch">{penaltyWinner(match)} wins {match.teamAPkScore} - {match.teamBPkScore} on penalties</div>
        </div>
      )}
      {showUserResultSummary && (
        <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-3 text-xs font-semibold leading-5 text-ink/65">
          {completed ? (
            <>
              <div>
                <button
                  type="button"
                  onClick={() => setScoringDetailsOpen((open) => !open)}
                  className="flex min-h-10 w-full items-center justify-between rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-ink transition hover:bg-black/[0.03] focus:outline-none focus:ring-2 focus:ring-pitch/20"
                  aria-expanded={scoringDetailsOpen}
                >
                  <span>{scoringDetailsOpen ? "Hide scoring details" : "Show scoring details"}</span>
                  <span className="text-pitch">{scoringDetailsOpen ? "▲" : "▼"}</span>
                </button>
                {scoringDetailsOpen && (
                  <div className="mt-3 space-y-2">
                    <div className="space-y-1 rounded-xl bg-white px-3 py-2">
                      {prediction ? (
                        <>
                        <div className="flex justify-between gap-3">
                          <span className="text-ink/45">Your pick</span>
                          <span className="font-black text-ink">{prediction.teamAScore} - {prediction.teamBScore}</span>
                        </div>
                        {prediction.advancingTeam && prediction.teamAScore === prediction.teamBScore && (
                          <div className="flex justify-between gap-3">
                            <span className="text-ink/45">Advances</span>
                            <span className="font-black text-ink">{prediction.advancingTeam === "team_a" ? match.teamA : match.teamB}</span>
                          </div>
                        )}
                        </>
                      ) : (
                        <div className="flex justify-between gap-3">
                          <span className="text-ink/45">Your pick</span>
                          <span className="font-black text-ink">No pick submitted</span>
                        </div>
                      )}
                        <div className="flex justify-between gap-3">
                          <span className="text-ink/45">Actual result</span>
                          <span className="font-black text-ink">{match.teamAScore} - {match.teamBScore}</span>
                        </div>
                        {hasPenaltyResult && (
                          <div className="flex justify-between gap-3">
                            <span className="text-ink/45">Penalties</span>
                            <span className="text-right font-black text-pitch">{penaltyWinner(match)} wins {match.teamAPkScore} - {match.teamBPkScore}</span>
                          </div>
                        )}
                      </div>
                      {prediction && pointsEarned === 0 && (
                        <div className="rounded-xl bg-white px-3 py-2 text-ink/55">No points earned</div>
                      )}
                      {prediction && pointsEarned !== 0 && pointsBreakdown.map((item) => (
                        <div key={item.label} className="flex justify-between gap-3 rounded-xl bg-white px-3 py-2">
                          <span>{item.label}</span>
                          <span className="shrink-0 font-black text-pitch">{item.points > 0 ? `+${item.points}` : "0 pts"}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-black/[0.06] pt-2 text-ink">
                        <span>Total</span>
                        <span>{pointsEarned ?? 0} {pointsEarned === 1 ? "point" : "points"}</span>
                      </div>
                    </div>
                )}
              </div>
            </>
          ) : (
            <div>Match locked - awaiting result.</div>
          )}
        </div>
      )}
      <div className="mt-4 flex min-h-9 items-center justify-between border-t border-black/[0.06] pt-3">
        <span className={`max-w-[65%] text-xs font-semibold ${message && message !== "Saved" && message !== "Saving..." ? "text-red-700" : "text-pitch"}`}>
          {message || (
            showOfficialResult ? (
              completed ? `Final: ${match.teamAScore} - ${match.teamBScore}${hasPenaltyResult ? `, ${penaltyWinner(match)} wins ${match.teamAPkScore} - ${match.teamBPkScore} on penalties` : ""}` : "Awaiting result"
            ) : !admin ? (
              <span className="flex flex-col gap-0.5">
                {!completed && prediction && <span>{`Your pick: ${prediction.teamAScore} - ${prediction.teamBScore}`}</span>}
                {!completed && prediction?.advancingTeam && prediction.teamAScore === prediction.teamBScore && (
                  <span>{`Advances: ${prediction.advancingTeam === "team_a" ? match.teamA : match.teamB}`}</span>
                )}
              </span>
            ) : ""
          )}
        </span>
        {!isPlaceholder && !showOfficialResult && (!locked || admin) && <button onClick={submit} disabled={!canSubmit} className="rounded-lg bg-ink px-4 py-2 text-xs font-bold text-white disabled:opacity-30">{admin ? "Set final" : "Save pick"}</button>}
      </div>
      {showPenaltyInputs && tiedScore && teamAPkScore === teamBPkScore && teamAPkScore !== "" && (
        <p className="mt-2 text-xs font-semibold text-red-700">Knockout match needs a winner.</p>
      )}
    </article>
  );
}

function leaderboardRank(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}.`;
}

function leaderboardMovement(playerId: string, currentIndex: number, previousRanks: Map<string, number>) {
  const previousRank = previousRanks.get(playerId);
  if (!previousRank) return "►";
  const currentRank = currentIndex + 1;
  if (previousRank > currentRank) return "▲";
  if (previousRank < currentRank) return "▼";
  return "►";
}

function leaderboardReasonLabel(reason: string) {
  if (reason === "exact") return "🎯 Exact score";
  if (reason === "outcome") return "🏆 Correct outcome";
  if (reason === "goal diff") return "📐 Correct margin";
  if (reason === "team score") return "⚽ Team score";
  return "Points";
}

function testScore() {
  return Math.floor(Math.random() * 5);
}

function testKnockoutScore() {
  const teamAScore = testScore();
  let teamBScore = testScore();

  if (teamAScore === teamBScore) {
    teamBScore = teamAScore === 4 ? teamAScore - 1 : teamAScore + 1;
  }

  return { teamAScore, teamBScore };
}

function isGroupStage(match: Match) {
  return /^Group [A-L]$/.test(match.stage);
}

function hasFinalScore(match: Match) {
  return match.teamAScore !== null && match.teamBScore !== null;
}

function isSameLocalDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function firstRelevantMatch(matches: Match[]) {
  const now = new Date();
  const sortedMatches = [...matches].sort((first, second) => matchDateFromUtc(first.startsAt).getTime() - matchDateFromUtc(second.startsAt).getTime());
  const todaysMatch = sortedMatches.find((match) => isSameLocalDay(matchDateFromUtc(match.startsAt), now));
  if (todaysMatch) return todaysMatch;

  return sortedMatches.find((match) => !hasFinalScore(match) && matchDateFromUtc(match.startsAt) > now) ?? null;
}

function scrollMatchIntoView(container: HTMLElement | null, matchId: string) {
  const target = Array.from(container?.querySelectorAll<HTMLElement>("[data-match-id]") ?? []).find(
    (element) => element.dataset.matchId === matchId,
  );
  if (!target) return false;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  return true;
}

export default function Home() {
  const maintenanceMode = isMaintenanceMode();
  const [player, setPlayer] = useState<Player | null>(null);
  const [data, setData] = useState<PoolData | null>(null);
  const [tab, setTab] = useState<"picks" | "bracket" | "table" | "profile" | "admin">("picks");
  const [bracketStage, setBracketStage] = useState("Round of 32");
  const [error, setError] = useState("");
  const [testBusy, setTestBusy] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [favoriteTeamBusy, setFavoriteTeamBusy] = useState(false);
  const [favoriteTeamMessage, setFavoriteTeamMessage] = useState("");
  const [previousLeaderboardRanks, setPreviousLeaderboardRanks] = useState<Map<string, number>>(new Map());
  const [openMatchHistories, setOpenMatchHistories] = useState<Set<string>>(new Set());
  const [showBackToTop, setShowBackToTop] = useState(false);
  const picksSectionRef = useRef<HTMLElement | null>(null);
  const bracketSectionRef = useRef<HTMLElement | null>(null);
  const picksAutoScrolledRef = useRef(false);
  const bracketAutoScrolledRef = useRef(false);
  const pendingBracketScrollMatchIdRef = useRef<string | null>(null);

  useEffect(() => { const saved = window.localStorage.getItem(SESSION_KEY); if (saved) setPlayer(JSON.parse(saved)); }, []);
  useEffect(() => {
    if (!player) return;
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(player));
    if (maintenanceMode && !player.isAdmin) {
      setData(null);
      return;
    }
    refresh(player);
    const timer = window.setInterval(() => refresh(player), 30000);
    return () => window.clearInterval(timer);
  }, [player, maintenanceMode]);
  useEffect(() => {
    function updateBackToTopVisibility() {
      setShowBackToTop(window.scrollY > 360);
    }

    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTopVisibility);
  }, []);
  useEffect(() => {
    if (!data) return;
    let previousOrder: string[] = [];
    try {
      previousOrder = JSON.parse(window.localStorage.getItem(LEADERBOARD_RANKS_KEY) ?? "[]") as string[];
    } catch {
      previousOrder = [];
    }
    setPreviousLeaderboardRanks(new Map(previousOrder.map((playerId, index) => [playerId, index + 1])));
    window.localStorage.setItem(LEADERBOARD_RANKS_KEY, JSON.stringify(data.leaderboard.map((row) => row.playerId)));
  }, [data]);
  useEffect(() => {
    const profile = data?.profiles[0];
    if (!profile) return;
    setFavoriteTeam(profile.favoriteTeam === "Not selected yet" ? "" : profile.favoriteTeam);
  }, [data]);

  async function refresh(current = player) { if (!current) return; try { setData(await loadPool(current)); setError(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not load the pool."); } }
  async function updatePrediction(prediction: Prediction) { if (!player) return; await savePrediction(player, prediction); await refresh(); }
  async function saveFinalResult(matchId: string, a: number, b: number, teamAPkScore?: number, teamBPkScore?: number) { if (!player) return; await saveResult(player, matchId, a, b, teamAPkScore, teamBPkScore); }
  async function updateResult(matchId: string, a: number, b: number, teamAPkScore?: number, teamBPkScore?: number) { await saveFinalResult(matchId, a, b, teamAPkScore, teamBPkScore); await refresh(); }
  async function saveTestGroupResults() {
    if (!player) return 0;
    const pool = await loadPool(player);
    const groupMatches = pool.matches.filter(isGroupStage);

    for (const match of groupMatches) {
      await saveFinalResult(match.id, testScore(), testScore());
    }

    return groupMatches.length;
  }
  async function saveTestKnockoutStageResults(stage: string) {
    if (!player) return 0;
    const pool = await loadPool(player);
    const stageMatches = pool.matches.filter((match) => match.stage === stage);
    if (stageMatches.length === 0) throw new Error(`No ${stage} matches found.`);

    for (const match of stageMatches) {
      const { teamAScore, teamBScore } = testKnockoutScore();
      await saveFinalResult(match.id, teamAScore, teamBScore);
    }

    return stageMatches.length;
  }
  function testStageMessage(count: number, singular: string, plural: string) {
    return `Updated ${count} ${count === 1 ? singular : plural}`;
  }
  async function generateTestGroupResults() {
    if (!player) return;
    setTestBusy("groups");
    setTestMessage("");
    setError("");

    try {
      const count = await saveTestGroupResults();
      await refresh(player);
      setTestMessage(`Updated ${count} group matches`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate group results.";
      setError(message);
      setTestMessage(message);
    } finally {
      setTestBusy(null);
    }
  }
  async function generateTestKnockoutResults(stage: string, busy: string, singular: string, plural: string) {
    if (!player) return;
    setTestBusy(busy);
    setTestMessage("");
    setError("");

    try {
      const count = await saveTestKnockoutStageResults(stage);
      await refresh(player);
      setTestMessage(testStageMessage(count, singular, plural));
    } catch (err) {
      const message = err instanceof Error ? err.message : `Could not generate ${stage} results.`;
      setError(message);
      setTestMessage(message);
    } finally {
      setTestBusy(null);
    }
  }
  async function generateTestRoundOf32Results() {
    await generateTestKnockoutResults("Round of 32", "r32", "Round of 32 match", "Round of 32 matches");
  }
  async function generateFullTestTournamentResults() {
    if (!player) return;
    setTestBusy("full");
    setTestMessage("");
    setError("");

    try {
      await saveTestGroupResults();

      for (const option of KNOCKOUT_STAGES) {
        await saveTestKnockoutStageResults(option.stage);
      }

      await refresh(player);
      setTestMessage("Generated full test tournament");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate full test tournament.";
      setError(message);
      setTestMessage(message);
    } finally {
      setTestBusy(null);
    }
  }
  async function resetTestResultScores() {
    if (!player) return;
    setTestBusy("reset");
    setTestMessage("");
    setError("");

    try {
      await resetTestResults(player);
      await refresh(player);
      setTestMessage("Test tournament reset");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reset test results.";
      setError(message);
      setTestMessage(message);
    } finally {
      setTestBusy(null);
    }
  }
  async function importOfficialScores() {
    if (!player) return;
    setTestBusy("official");
    setTestMessage("");
    setError("");

    try {
      await importOfficialScoresSoFar(player);
      await refresh(player);
      setTestMessage("Official scores imported and played matches locked.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not import official scores.";
      setError(message);
      setTestMessage(message);
    } finally {
      setTestBusy(null);
    }
  }
  async function resetLeaderboardStatistics() {
    if (!player) return;
    setTestBusy("leaderboard");
    setTestMessage("");
    setError("");

    try {
      await refresh(player);
      setTestMessage("Leaderboard statistics reset and recalculated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reset leaderboard statistics.";
      setError(message);
      setTestMessage(message);
    } finally {
      setTestBusy(null);
    }
  }

  function toggleMatchHistory(playerId: string) {
    setOpenMatchHistories((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }
  async function submitPinChange(event: FormEvent) {
    event.preventDefault();
    if (!player) return;
    setPinBusy(true);
    setPinMessage("");

    try {
      await changePin(player, currentPin, newPin, confirmNewPin);
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
      setPinMessage("PIN updated successfully.");
    } catch (err) {
      setPinMessage(err instanceof Error ? err.message : "Could not update PIN.");
    } finally {
      setPinBusy(false);
    }
  }
  async function submitFavoriteTeam(event: FormEvent) {
    event.preventDefault();
    if (!player || !favoriteTeam) return;
    setFavoriteTeamBusy(true);
    setFavoriteTeamMessage("");

    try {
      await saveFavoriteTeam(player, favoriteTeam);
      const updatedPlayer = { ...player, favoriteTeam };
      setPlayer(updatedPlayer);
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(updatedPlayer));
      await refresh(updatedPlayer);
      setFavoriteTeamMessage("Favorite team saved.");
    } catch (err) {
      setFavoriteTeamMessage(err instanceof Error ? err.message : "Could not save favorite team.");
    } finally {
      setFavoriteTeamBusy(false);
    }
  }
  function logout() { window.localStorage.removeItem(SESSION_KEY); setPlayer(null); setData(null); }
  function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const predictionMap = useMemo(() => new Map(data?.predictions.map((item) => [item.matchId, item])), [data]);
  const bracketMatches = useMemo(
    () => data?.matches.filter((match) => KNOCKOUT_STAGES.some((option) => option.stage === match.stage)) ?? [],
    [data],
  );
  const selectedBracketMatches = useMemo(
    () => bracketMatches.filter((match) => match.stage === bracketStage),
    [bracketMatches, bracketStage],
  );
  const worldCupTeams = data?.favoriteTeamOptions ?? [];

  useEffect(() => {
    if (tab !== "picks" || !data || picksAutoScrolledRef.current) return;
    const targetMatch = firstRelevantMatch(data.matches);
    if (!targetMatch) return;

    picksAutoScrolledRef.current = true;
    window.requestAnimationFrame(() => scrollMatchIntoView(picksSectionRef.current, targetMatch.id));
  }, [data, tab]);

  useEffect(() => {
    if (tab !== "bracket" || bracketAutoScrolledRef.current || bracketMatches.length === 0) return;
    const targetMatch = firstRelevantMatch(bracketMatches);
    if (!targetMatch) return;

    bracketAutoScrolledRef.current = true;
    pendingBracketScrollMatchIdRef.current = targetMatch.id;
    if (targetMatch.stage !== bracketStage) setBracketStage(targetMatch.stage);
  }, [bracketMatches, bracketStage, tab]);

  useEffect(() => {
    if (tab !== "bracket" || !pendingBracketScrollMatchIdRef.current) return;
    if (!selectedBracketMatches.some((match) => match.id === pendingBracketScrollMatchIdRef.current)) return;

    const matchId = pendingBracketScrollMatchIdRef.current;
    window.requestAnimationFrame(() => {
      if (scrollMatchIntoView(bracketSectionRef.current, matchId)) pendingBracketScrollMatchIdRef.current = null;
    });
  }, [selectedBracketMatches, tab]);

  if (maintenanceMode && !player?.isAdmin) {
    return <MaintenanceScreen player={player} onLogin={setPlayer} onLogout={logout} />;
  }

  if (!player) return <Login onLogin={setPlayer} />;
  const currentLeaderboardIndex = data?.leaderboard.findIndex((row) => row.playerId === player.id) ?? -1;
  const currentLeaderboardRow = currentLeaderboardIndex >= 0 ? data?.leaderboard[currentLeaderboardIndex] : null;
  const testToolsEnabled =
    player.isAdmin &&
    player.name.trim().toLowerCase() === "admin" &&
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-6 sm:px-6">
      <header className="flex items-center justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-pitch">Kickoff Pool</p><h1 className="mt-1 text-2xl font-black tracking-tight">Hi, {player.name}</h1></div>
        <div className="flex items-center gap-2">
          <button onClick={logout} className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold">Sign out</button>
        </div>
      </header>
      {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <section className="mt-5 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-sm font-extrabold text-ink">Welcome back, {player.name}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-black/[0.03] p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink/45">Current rank</p>
            <p className="mt-1 text-xl font-black">{currentLeaderboardIndex >= 0 ? `#${currentLeaderboardIndex + 1}` : "—"}</p>
          </div>
          <div className="rounded-xl bg-black/[0.03] p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink/45">Points</p>
            <p className="mt-1 text-xl font-black">{currentLeaderboardRow?.points ?? 0}</p>
          </div>
          <div className="rounded-xl bg-black/[0.03] p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink/45">Exact scores</p>
            <p className="mt-1 text-xl font-black">{currentLeaderboardRow?.exactScores ?? 0}</p>
          </div>
        </div>
      </section>

      <nav className={`mt-7 grid ${player.isAdmin ? "grid-cols-5" : "grid-cols-4"} rounded-xl bg-black/[0.05] p-1`}>
        <button onClick={() => setTab("picks")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "picks" ? "bg-white shadow-sm" : "text-ink/55"}`}>{player.isAdmin ? "Results" : "My picks"}</button>
        <button onClick={() => setTab("bracket")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "bracket" ? "bg-white shadow-sm" : "text-ink/55"}`}>Bracket</button>
        <button onClick={() => setTab("table")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "table" ? "bg-white shadow-sm" : "text-ink/55"}`}>Leaderboard</button>
        <button onClick={() => setTab("profile")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "profile" ? "bg-white shadow-sm" : "text-ink/55"}`}>Profile</button>
        {player.isAdmin && <button onClick={() => setTab("admin")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "admin" ? "bg-white shadow-sm" : "text-ink/55"}`}>Admin</button>}
      </nav>

      {tab === "picks" ? (
        <section ref={picksSectionRef} className="mt-6 space-y-3">
          <div className="mb-4"><h2 className="text-xl font-black">{player.isAdmin ? "Enter final scores" : "Upcoming matches"}</h2><p className="mt-1 text-sm text-ink/55">{player.isAdmin ? "The table recalculates after every saved result." : "Picks lock automatically at kickoff."}</p></div>
          {testToolsEnabled && (
            <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
              <div>
                <p className="text-sm font-extrabold">Fast bracket test</p>
                <p className="mt-1 text-xs leading-5 text-ink/55">Uses the same final-score save path as the Set final button.</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  className="min-h-11 rounded-xl bg-pitch px-4 py-2 text-sm font-bold text-white transition hover:bg-pitch/90 disabled:opacity-60"
                  disabled={testBusy !== null}
                  onClick={generateTestGroupResults}
                >
                  {testBusy === "groups" ? "Generating..." : "Generate Test Group Results"}
                </button>
                <button
                  className="min-h-11 rounded-xl bg-pitch px-4 py-2 text-sm font-bold text-white transition hover:bg-pitch/90 disabled:opacity-60"
                  disabled={testBusy !== null}
                  onClick={generateTestRoundOf32Results}
                >
                  {testBusy === "r32" ? "Generating..." : "Generate Test Round of 32 Results"}
                </button>
                {TEST_KNOCKOUT_STAGES.map((option) => (
                  <button
                    key={option.stage}
                    className="min-h-11 rounded-xl bg-pitch px-4 py-2 text-sm font-bold text-white transition hover:bg-pitch/90 disabled:opacity-60"
                    disabled={testBusy !== null}
                    onClick={() => generateTestKnockoutResults(option.stage, option.busy, option.singular, option.plural)}
                  >
                    {testBusy === option.busy ? "Generating..." : option.button}
                  </button>
                ))}
                <button
                  className="min-h-11 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-ink/90 disabled:opacity-60"
                  disabled={testBusy !== null}
                  onClick={generateFullTestTournamentResults}
                >
                  {testBusy === "full" ? "Generating..." : "Generate Full Test Tournament"}
                </button>
                <button
                  className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  disabled={testBusy !== null}
                  onClick={resetTestResultScores}
                >
                  {testBusy === "reset" ? "Resetting..." : "Reset Test Results"}
                </button>
                <button
                  className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 sm:col-span-2"
                  disabled={testBusy !== null}
                  onClick={importOfficialScores}
                >
                  {testBusy === "official" ? "Importing..." : "Import Official Scores So Far + Lock Played Matches"}
                </button>
                <button
                  className="min-h-11 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-black/[0.03] disabled:opacity-60 sm:col-span-2"
                  disabled={testBusy !== null}
                  onClick={resetLeaderboardStatistics}
                >
                  {testBusy === "leaderboard" ? "Recalculating..." : "Reset Leaderboard Statistics"}
                </button>
              </div>
              {testMessage && <p className="mt-3 text-sm font-semibold text-pitch">{testMessage}</p>}
            </div>
          )}
          {!data ? <p className="py-12 text-center text-sm text-ink/50">Loading matches...</p> : data.matches.map((match) => <MatchCard key={match.id} match={match} prediction={predictionMap.get(match.id)} admin={player.isAdmin} onSavePrediction={updatePrediction} onSaveResult={updateResult} />)}
        </section>
      ) : tab === "bracket" ? (
        <section ref={bracketSectionRef} className="mt-6">
          <div className="mb-4"><h2 className="text-xl font-black">Knockout bracket</h2><p className="mt-1 text-sm text-ink/55">Rounds appear automatically after the group stage is complete.</p></div>
          {!data ? (
            <p className="py-12 text-center text-sm text-ink/50">Loading bracket...</p>
          ) : bracketMatches.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-ink/55 shadow-card">The knockout bracket will appear when every group-stage result is in.</div>
          ) : (
            <div>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {KNOCKOUT_STAGES.map((option) => (
                  <button
                    key={option.stage}
                    onClick={() => setBracketStage(option.stage)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${
                      bracketStage === option.stage ? "bg-pitch text-white" : "bg-white text-ink/60 shadow-sm"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {selectedBracketMatches.length === 0 ? (
                  <div className="rounded-2xl bg-white p-6 text-center text-sm text-ink/55 shadow-card">No matches in this stage yet.</div>
                ) : (
                  selectedBracketMatches.map((match) => (
                    <MatchCard key={match.id} match={match} prediction={predictionMap.get(match.id)} admin={player.isAdmin} onSavePrediction={updatePrediction} onSaveResult={updateResult} />
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      ) : tab === "table" ? (
        <section className="mt-6">
          <div className="mb-4"><h2 className="text-xl font-black">Leaderboard</h2><p className="mt-1 text-sm text-ink/55">Exact scores break point ties.</p></div>
          <div className="space-y-3">
            {data?.leaderboard.map((row, index) => {
              const historyOpen = openMatchHistories.has(row.playerId);

              return (
                <article key={row.playerId} className="overflow-hidden rounded-2xl bg-white shadow-card">
                  <div className="p-4">
                    <div className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-3">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black ${index === 0 ? "bg-lime text-pitch" : "bg-black/[0.05] text-ink/75"}`}>{leaderboardRank(index)}</span>
                      <div className="min-w-0">
                        <p className="truncate font-extrabold"><span className="mr-1 text-pitch">{leaderboardMovement(row.playerId, index, previousLeaderboardRanks)}</span>{row.name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-ink/45">Rank #{index + 1}</p>
                      </div>
                      <div className="rounded-xl bg-pitch px-3 py-2 text-right text-white">
                        <span className="block text-2xl font-black leading-none">{row.points}</span>
                        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-white/75">pts</span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-black/[0.03] px-2 py-2">
                        <p className="text-lg font-black leading-none">{row.exactScores}</p>
                        <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink/45">Exact</p>
                      </div>
                      <div className="rounded-xl bg-black/[0.03] px-2 py-2">
                        <p className="text-lg font-black leading-none">{row.correctOutcomes}</p>
                        <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink/45">Outcomes</p>
                      </div>
                      <div className="rounded-xl bg-black/[0.03] px-2 py-2">
                        <p className="text-lg font-black leading-none">{row.goalDifferences}</p>
                        <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink/45">Goal diff</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMatchHistory(row.playerId)}
                      className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-ink transition hover:bg-black/[0.03] focus:outline-none focus:ring-2 focus:ring-pitch/20"
                      aria-expanded={historyOpen}
                    >
                      <span>{historyOpen ? "Hide match history" : "Show match history"}</span>
                      <span className="text-pitch">{row.details.length} scored</span>
                    </button>
                  </div>
                  {historyOpen && (
                    <div className="border-t border-black/[0.06] bg-black/[0.02] px-4 py-3">
                      {row.details.length === 0 ? (
                        <p className="py-2 text-sm font-semibold text-ink/50">No scored matches yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {row.details.map((detail) => (
                            <div key={detail.matchId} className="rounded-xl bg-white px-3 py-3 text-xs font-semibold leading-5 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-extrabold text-ink">{detail.label}</p>
                                  <p className="mt-1 text-ink/55">{leaderboardReasonLabel(detail.reason)}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-lime px-2.5 py-1 font-black text-pitch">+{detail.points} pts</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {data && data.leaderboard.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-sm text-ink/50 shadow-card">No players yet.</p>}
          </div>
          <div className="mt-5 rounded-2xl border border-black/[0.06] p-4 text-xs leading-6 text-ink/60"><strong className="text-ink">Tie-breakers:</strong> exact scores, then correct outcomes, then goal difference.</div>
        </section>
      ) : tab === "admin" && player.isAdmin ? (
        <section className="mt-6">
          <div className="mb-4"><h2 className="text-xl font-black">Admin dashboard</h2><p className="mt-1 text-sm text-ink/55">Quick overview of pool activity.</p></div>
          {!data?.adminDashboard ? (
            <p className="py-12 text-center text-sm text-ink/50">Loading dashboard...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-card"><p className="text-xs font-bold text-ink/45">Total players</p><p className="mt-2 text-2xl font-black">{data.adminDashboard.totalPlayers}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-card"><p className="text-xs font-bold text-ink/45">Predictions</p><p className="mt-2 text-2xl font-black">{data.adminDashboard.totalPredictions}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-card"><p className="text-xs font-bold text-ink/45">Completed</p><p className="mt-2 text-2xl font-black">{data.adminDashboard.completedMatches}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-card"><p className="text-xs font-bold text-ink/45">Locked awaiting</p><p className="mt-2 text-2xl font-black">{data.adminDashboard.lockedAwaitingResult}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-card sm:col-span-2"><p className="text-xs font-bold text-ink/45">Current leader</p><p className="mt-2 text-lg font-black">{data.adminDashboard.currentLeader}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-card sm:col-span-3"><p className="text-xs font-bold text-ink/45">Last official result</p><p className="mt-2 text-lg font-black">{data.adminDashboard.lastOfficialResult}</p></div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-card">
                <p className="text-sm font-extrabold">Quick admin actions</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60" disabled={testBusy !== null} onClick={importOfficialScores}>
                    {testBusy === "official" ? "Importing..." : "Import Official Scores So Far + Lock Played Matches"}
                  </button>
                  <button className="min-h-11 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-black/[0.03] disabled:opacity-60" disabled={testBusy !== null} onClick={resetLeaderboardStatistics}>
                    {testBusy === "leaderboard" ? "Recalculating..." : "Reset Leaderboard Statistics"}
                  </button>
                </div>
                {testMessage && <p className="mt-3 text-sm font-semibold text-pitch">{testMessage}</p>}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6">
          <div className="mb-4"><h2 className="text-xl font-black">Profile</h2><p className="mt-1 text-sm text-ink/55">Performance from completed matches and saved predictions.</p></div>
          <form onSubmit={submitPinChange} className="mb-4 rounded-2xl bg-white p-4 shadow-card">
            <h3 className="text-sm font-extrabold">Change PIN</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-bold text-ink/60">Current PIN<input className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15" inputMode="numeric" maxLength={8} type="password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label>
              <label className="block text-xs font-bold text-ink/60">New PIN<input className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15" inputMode="numeric" maxLength={8} type="password" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label>
              <label className="block text-xs font-bold text-ink/60">Confirm New PIN<input className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15" inputMode="numeric" maxLength={8} type="password" value={confirmNewPin} onChange={(event) => setConfirmNewPin(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={`text-xs font-semibold ${pinMessage === "PIN updated successfully." ? "text-pitch" : "text-red-700"}`}>{pinMessage}</p>
              <button disabled={pinBusy} className="h-10 rounded-xl bg-ink px-4 text-xs font-bold text-white transition hover:bg-ink/90 disabled:opacity-60">{pinBusy ? "Updating..." : "Update PIN"}</button>
            </div>
          </form>
          <form onSubmit={submitFavoriteTeam} className="mb-4 rounded-2xl bg-white p-4 shadow-card">
            <h3 className="text-sm font-extrabold">Favorite Team</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block text-xs font-bold text-ink/60">
                Choose a team
                <select className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15" value={favoriteTeam} onChange={(event) => { setFavoriteTeam(event.target.value); setFavoriteTeamMessage(""); }}>
                  <option value="">Not selected yet</option>
                  {worldCupTeams.map((team) => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </label>
              <button disabled={favoriteTeamBusy || !favoriteTeam} className="h-11 rounded-xl bg-ink px-4 text-xs font-bold text-white transition hover:bg-ink/90 disabled:opacity-60">{favoriteTeamBusy ? "Saving..." : "Save Favorite"}</button>
            </div>
            <p className={`mt-3 text-xs font-semibold ${favoriteTeamMessage === "Favorite team saved." ? "text-pitch" : "text-red-700"}`}>{favoriteTeamMessage}</p>
          </form>
          {!data ? (
            <p className="py-12 text-center text-sm text-ink/50">Loading profile...</p>
          ) : data.profiles.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-ink/55 shadow-card">No player profiles yet.</div>
          ) : (
            <div className="space-y-4">
              {data.profiles.map((profile) => (
                <article key={profile.playerId} className="rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black">{profile.name}</h3>
                      <p className="mt-1 text-xs font-semibold text-ink/45">{profile.rank ? `Rank #${profile.rank}` : "No rank yet"}</p>
                    </div>
                    <div className="text-right"><span className="text-3xl font-black">{profile.totalPoints}</span><span className="ml-1 text-xs font-bold text-ink/40">pts</span></div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-black uppercase tracking-wider text-ink/45">Prediction accuracy</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-bold text-ink/45">Exact scores</p><p className="mt-1 text-lg font-black">{profile.exactScores}</p></div>
                    <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-bold text-ink/45">Correct outcomes</p><p className="mt-1 text-lg font-black">{profile.correctOutcomes}</p></div>
                    <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-bold text-ink/45">Goal diff</p><p className="mt-1 text-lg font-black">{profile.goalDifferences}</p></div>
                    <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-bold text-ink/45">Matches predicted</p><p className="mt-1 text-lg font-black">{profile.totalPredictions}</p></div>
                    <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-bold text-ink/45">Completed counted</p><p className="mt-1 text-lg font-black">{profile.completedMatchesCount}</p></div>
                    <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-bold text-ink/45">Accuracy</p><p className="mt-1 text-lg font-black">{profile.accuracyPercentage}%</p></div>
                    <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-bold text-ink/45">Favorite team</p><p className="mt-1 text-base font-black">{profile.favoriteTeam}</p></div>
                    <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-bold text-ink/45">Best round</p><p className="mt-1 text-base font-black">{profile.bestRound}</p></div>
                    <div className="rounded-xl bg-black/[0.03] p-3"><p className="text-xs font-bold text-ink/45">Avg / completed match</p><p className="mt-1 text-lg font-black">{profile.averagePointsPerCompletedMatch}</p></div>
                  </div>
                  <div className="mt-5 border-t border-black/[0.06] pt-4">
                    <p className="text-xs font-black uppercase tracking-wider text-ink/45">Recent completed matches</p>
                    {profile.recentMatches.length === 0 ? (
                      <p className="mt-3 text-sm text-ink/50">No completed predictions yet.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {profile.recentMatches.map((match) => (
                          <div key={match.matchId} className="rounded-xl bg-black/[0.03] p-3 text-xs font-semibold leading-5 text-ink/65">
                            <div className="font-extrabold text-ink">{match.label}</div>
                            <div className="mt-1 grid grid-cols-[1fr_auto] gap-2"><span>Your pick: {match.pick}</span><span className="text-pitch">+{match.points}</span></div>
                            <div>Actual result: {match.actual}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white/95 px-4 py-2 text-xs font-black text-ink shadow-card backdrop-blur transition hover:bg-lime focus:outline-none focus:ring-2 focus:ring-pitch/25 sm:bottom-8 sm:right-8"
          aria-label="Back to top"
        >
          <span aria-hidden="true" className="text-base leading-none">↑</span>
          <span>Top</span>
        </button>
      )}
    </main>
  );
}
