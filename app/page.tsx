"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { changePin, importOfficialScoresSoFar, loadPool, login, resetTestResults, saveFavoriteTeam, savePrediction, saveResult } from "@/lib/api";
import { predictionPoints } from "@/lib/scoring";
import { Match, Player, PoolData, Prediction } from "@/lib/types";

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

function ScoreInput({ value, onChange, disabled, label }: { value: string; onChange: (value: string) => void; disabled?: boolean; label: string }) {
  return <input aria-label={label} className="h-12 w-14 rounded-xl border border-black/10 bg-white text-center text-lg font-bold outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15 disabled:bg-black/5" disabled={disabled} inputMode="numeric" min="0" max="30" type="number" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function Login({ onLogin }: { onLogin: (player: Player) => void }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        <form onSubmit={submit} className="mt-9 rounded-3xl bg-white p-5 shadow-card">
          <label className="block text-sm font-bold">Your name<input autoComplete="name" className="mt-2 h-12 w-full rounded-xl border border-black/10 px-4 outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15" placeholder="e.g. Jamie" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="mt-4 block text-sm font-bold">Your PIN<input autoComplete="current-password" className="mt-2 h-12 w-full rounded-xl border border-black/10 px-4 tracking-[0.3em] outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/15" inputMode="numeric" minLength={4} placeholder="â€¢â€¢â€¢â€¢" type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} /></label>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
          <button disabled={busy} className="mt-5 h-12 w-full rounded-xl bg-pitch font-bold text-white transition hover:bg-pitch/90 disabled:opacity-60">{busy ? "Signing in..." : "Enter the pool"}</button>
        </form>
      </section>
    </main>
  );
}

function pointBreakdown(prediction: Prediction, match: Match) {
  if (match.teamAScore === null || match.teamBScore === null) return [];

  const predictedGoalDifference = prediction.teamAScore - prediction.teamBScore;
  const actualGoalDifference = match.teamAScore - match.teamBScore;
  const items: { label: string; points: number }[] = [];

  if (Math.sign(predictedGoalDifference) === Math.sign(actualGoalDifference)) {
    items.push({ label: "âš½ Correct outcome", points: 3 });
  }
  if (prediction.teamAScore === match.teamAScore && prediction.teamBScore === match.teamBScore) {
    items.push({ label: "â­ Exact score bonus", points: 2 });
  }
  if (predictedGoalDifference === actualGoalDifference) {
    items.push({ label: "ðŸ“ˆ Goal difference", points: 1 });
  }
  if (prediction.teamAScore === match.teamAScore) {
    items.push({ label: `${match.teamA} goals`, points: 1 });
  }
  if (prediction.teamBScore === match.teamBScore) {
    items.push({ label: `${match.teamB} goals`, points: 1 });
  }

  return items.length > 0 ? items : [{ label: "âŒ No points", points: 0 }];
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
  onSaveResult: (matchId: string, a: number, b: number) => Promise<void>;
}) {
  const [a, setA] = useState(prediction?.teamAScore.toString() ?? "");
  const [b, setB] = useState(prediction?.teamBScore.toString() ?? "");
  const [message, setMessage] = useState("");
  const locked = new Date(match.startsAt) <= new Date();
  const completed = match.teamAScore !== null && match.teamBScore !== null;
  const knockout = KNOCKOUT_STAGES.some((option) => option.stage === match.stage);
  const hasPenaltyResult =
    knockout &&
    completed &&
    match.teamAScore === match.teamBScore &&
    match.teamAPkScore !== null &&
    match.teamBPkScore !== null;
  const canSubmit = a !== "" && b !== "";
  const matchTime = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(match.startsAt));
  const pointsEarned =
    !admin && completed && prediction
      ? predictionPoints(prediction.teamAScore, prediction.teamBScore, match.teamAScore!, match.teamBScore!)
      : null;
  const pointsBreakdown = completed && prediction ? pointBreakdown(prediction, match) : [];
  const showUserResultSummary = !admin && !showOfficialResult && (completed || (locked && !completed));

  useEffect(() => {
    setA((showOfficialResult || admin) && match.teamAScore !== null ? String(match.teamAScore) : prediction?.teamAScore.toString() ?? "");
    setB((showOfficialResult || admin) && match.teamBScore !== null ? String(match.teamBScore) : prediction?.teamBScore.toString() ?? "");
  }, [prediction, admin, showOfficialResult, match.teamAScore, match.teamBScore]);

  async function submit() {
    if (!canSubmit) return;
    setMessage("Saving...");
    try {
      if (admin) await onSaveResult(match.id, Number(a), Number(b));
      else await onSavePrediction({ matchId: match.id, teamAScore: Number(a), teamBScore: Number(b) });
      setMessage("Saved"); setTimeout(() => setMessage(""), 1600);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not save."); }
  }

  return (
    <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider text-ink/45">
        <span>{match.stage}</span>
        <span className="flex items-center gap-2">
          {locked && !admin && <span className="rounded-full bg-black/[0.06] px-2 py-1 text-[0.65rem] text-ink/65">Locked</span>}
          <span>{completed ? "Final" : matchTime}</span>
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right font-extrabold leading-tight">{match.teamA}</div>
        <div className="flex items-center gap-2"><ScoreInput label={`${match.teamA} goals`} value={a} onChange={setA} disabled={showOfficialResult || (!admin && locked)} /><span className="font-bold text-ink/30">:</span><ScoreInput label={`${match.teamB} goals`} value={b} onChange={setB} disabled={showOfficialResult || (!admin && locked)} /></div>
        <div className="font-extrabold leading-tight">{match.teamB}</div>
      </div>
      {hasPenaltyResult && (
        <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-2 text-center text-xs font-bold text-ink/55">
          <div>{match.teamA} {match.teamAScore} - {match.teamBScore} {match.teamB}</div>
          <div className="mt-1 text-pitch">PK: {match.teamAPkScore} - {match.teamBPkScore}</div>
        </div>
      )}
      {showUserResultSummary && (
        <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-3 text-xs font-semibold leading-5 text-ink/65">
          {completed ? (
            <>
              {prediction && (
                <div>
                  <div className="text-ink/45">Your pick:</div>
                  <div className="text-ink">{prediction.teamAScore} - {prediction.teamBScore}</div>
                </div>
              )}
              <div className={prediction ? "mt-2" : ""}>
                <div className="text-ink/45">Actual result:</div>
                <div className="text-ink">{match.teamAScore} - {match.teamBScore}</div>
              </div>
              {prediction && (
                <div className="mt-3 border-t border-black/[0.06] pt-2">
                  <div className="text-ink/45">Points earned:</div>
                  <div className="mt-1 space-y-1">
                    {pointsBreakdown.map((item) => (
                      <div key={item.label} className="flex justify-between gap-3">
                        <span>{item.label}</span>
                        <span className="shrink-0 text-pitch">+{item.points}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between border-t border-black/[0.06] pt-2 text-ink">
                    <span>Total</span>
                    <span>{pointsEarned} {pointsEarned === 1 ? "point" : "points"}</span>
                  </div>
                </div>
              )}
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
              completed ? `Final: ${match.teamAScore} - ${match.teamBScore}` : "Awaiting result"
            ) : !admin ? (
              <span className="flex flex-col gap-0.5">
                {!completed && prediction && <span>{`Your pick: ${prediction.teamAScore} - ${prediction.teamBScore}`}</span>}
              </span>
            ) : ""
          )}
        </span>
        {!showOfficialResult && (!locked || admin) && <button onClick={submit} disabled={!canSubmit} className="rounded-lg bg-ink px-4 py-2 text-xs font-bold text-white disabled:opacity-30">{admin ? "Set final" : "Save pick"}</button>}
      </div>
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

export default function Home() {
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

  useEffect(() => { const saved = window.localStorage.getItem(SESSION_KEY); if (saved) setPlayer(JSON.parse(saved)); }, []);
  useEffect(() => { if (!player) return; window.localStorage.setItem(SESSION_KEY, JSON.stringify(player)); refresh(player); const timer = window.setInterval(() => refresh(player), 30000); return () => window.clearInterval(timer); }, [player]);
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
  async function saveFinalResult(matchId: string, a: number, b: number) { if (!player) return; await saveResult(player, matchId, a, b); }
  async function updateResult(matchId: string, a: number, b: number) { await saveFinalResult(matchId, a, b); await refresh(); }
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

  const predictionMap = useMemo(() => new Map(data?.predictions.map((item) => [item.matchId, item])), [data]);
  const bracketMatches = useMemo(
    () => data?.matches.filter((match) => KNOCKOUT_STAGES.some((option) => option.stage === match.stage)) ?? [],
    [data],
  );
  const selectedBracketMatches = useMemo(
    () => bracketMatches.filter((match) => match.stage === bracketStage),
    [bracketMatches, bracketStage],
  );
  const worldCupTeams = useMemo(
    () =>
      Array.from(
        new Set(
          data?.matches
            .filter(isGroupStage)
            .flatMap((match) => [match.teamA, match.teamB]) ?? [],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [data],
  );
  if (!player) return <Login onLogin={setPlayer} />;
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

      <nav className={`mt-7 grid ${player.isAdmin ? "grid-cols-5" : "grid-cols-4"} rounded-xl bg-black/[0.05] p-1`}>
        <button onClick={() => setTab("picks")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "picks" ? "bg-white shadow-sm" : "text-ink/55"}`}>{player.isAdmin ? "Results" : "My picks"}</button>
        <button onClick={() => setTab("bracket")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "bracket" ? "bg-white shadow-sm" : "text-ink/55"}`}>Bracket</button>
        <button onClick={() => setTab("table")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "table" ? "bg-white shadow-sm" : "text-ink/55"}`}>Leaderboard</button>
        <button onClick={() => setTab("profile")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "profile" ? "bg-white shadow-sm" : "text-ink/55"}`}>Profile</button>
        {player.isAdmin && <button onClick={() => setTab("admin")} className={`rounded-lg py-2.5 text-sm font-bold ${tab === "admin" ? "bg-white shadow-sm" : "text-ink/55"}`}>Admin</button>}
      </nav>

      {tab === "picks" ? (
        <section className="mt-6 space-y-3">
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
        <section className="mt-6">
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
                    <MatchCard key={match.id} match={match} admin={false} showOfficialResult onSavePrediction={updatePrediction} onSaveResult={updateResult} />
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      ) : tab === "table" ? (
        <section className="mt-6">
          <div className="mb-4"><h2 className="text-xl font-black">Leaderboard</h2><p className="mt-1 text-sm text-ink/55">Exact scores break point ties.</p></div>
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            {data?.leaderboard.map((row, index) => (
              <div key={row.playerId} className="border-b border-black/[0.06] px-4 py-4 last:border-0">
                <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${index === 0 ? "bg-lime text-pitch" : "bg-black/[0.05]"}`}>{leaderboardRank(index)}</span>
                  <div><p className="font-extrabold"><span className="mr-1 text-pitch">{leaderboardMovement(row.playerId, index, previousLeaderboardRanks)}</span>{row.name}</p><p className="text-xs text-ink/45">{row.exactScores} exact / {row.correctOutcomes} outcomes / {row.goalDifferences} goal diff</p></div>
                  <div className="text-right"><span className="text-2xl font-black">{row.points}</span><span className="ml-1 text-xs font-bold text-ink/40">pts</span></div>
                </div>
                {player.isAdmin && row.details.length > 0 && (
                  <div className="mt-3 space-y-1 pl-12 text-xs font-semibold leading-5 text-ink/60">
                    {row.details.map((detail) => (
                      <div key={detail.matchId} className="flex justify-between gap-3">
                        <span>{detail.label}</span>
                        <span className="shrink-0 text-pitch">+{detail.points} {detail.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {data && data.leaderboard.length === 0 && <p className="p-8 text-center text-sm text-ink/50">No players yet.</p>}
          </div>
          <div className="mt-5 rounded-2xl border border-black/[0.06] p-4 text-xs leading-6 text-ink/60"><strong className="text-ink">Scoring:</strong> 3 outcome Â· 2 exact score Â· 1 goal difference Â· 1 each correct team score</div>
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
    </main>
  );
}
