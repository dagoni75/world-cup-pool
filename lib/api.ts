import { createClient } from "@supabase/supabase-js";
import { FAVORITE_TEAM_OPTIONS } from "./favorite-teams";
import { predictionPoints } from "./scoring";
import { Match, Player, PoolData, Prediction } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Supabase environment variables are not configured.");
}

const supabase = createClient(url, key);

type MatchRow = {
  id: string;
  team_a: string;
  team_b: string;
  starts_at: string;
  stage: string;
  bracket_slot: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  team_a_pk_score: number | null;
  team_b_pk_score: number | null;
};

type PlayerRow = {
  id: string;
  name: string;
  is_admin: boolean;
  favorite_team: string | null;
};

type TeamStanding = {
  team: string;
  group: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
};

type OfficialResult = {
  teamA: string;
  teamB: string;
  teamAScore: number;
  teamBScore: number;
};

const KNOCKOUT_STAGES = [
  "Round of 32",
  "Round of 16",
  "Quarterfinals",
  "Semifinals",
  "Third Place Match",
  "Final",
] as const;

const KNOCKOUT_STAGE_SET = new Set<string>(KNOCKOUT_STAGES);
const KNOCKOUT_SLOT_COUNTS = [
  { stage: "Round of 32", prefix: "R32", count: 16 },
  { stage: "Round of 16", prefix: "R16", count: 8 },
  { stage: "Quarterfinals", prefix: "QF", count: 4 },
  { stage: "Semifinals", prefix: "SF", count: 2 },
  { stage: "Third Place Match", prefix: "THIRD", count: 1 },
  { stage: "Final", prefix: "FINAL", count: 1 },
];
const KNOCKOUT_EXPECTED_SCORES = new Map(KNOCKOUT_SLOT_COUNTS.map((item) => [item.stage, item.count]));
const OFFICIAL_SCORES_SO_FAR: OfficialResult[] = [
  { teamA: "Mexico", teamB: "South Africa", teamAScore: 2, teamBScore: 0 },
  { teamA: "South Korea", teamB: "Czechia", teamAScore: 2, teamBScore: 1 },
  { teamA: "Canada", teamB: "Bosnia and Herzegovina", teamAScore: 1, teamBScore: 1 },
  { teamA: "United States", teamB: "Paraguay", teamAScore: 4, teamBScore: 1 },
  { teamA: "Qatar", teamB: "Switzerland", teamAScore: 1, teamBScore: 1 },
  { teamA: "Brazil", teamB: "Morocco", teamAScore: 1, teamBScore: 1 },
  { teamA: "Haiti", teamB: "Scotland", teamAScore: 0, teamBScore: 1 },
  { teamA: "Australia", teamB: "Turkey", teamAScore: 2, teamBScore: 0 },
  { teamA: "Germany", teamB: "Curacao", teamAScore: 7, teamBScore: 1 },
  { teamA: "Netherlands", teamB: "Japan", teamAScore: 2, teamBScore: 2 },
  { teamA: "Ivory Coast", teamB: "Ecuador", teamAScore: 1, teamBScore: 0 },
  { teamA: "Sweden", teamB: "Tunisia", teamAScore: 5, teamBScore: 1 },
  { teamA: "Spain", teamB: "Cape Verde", teamAScore: 0, teamBScore: 0 },
  { teamA: "Belgium", teamB: "Egypt", teamAScore: 1, teamBScore: 1 },
  { teamA: "Saudi Arabia", teamB: "Uruguay", teamAScore: 1, teamBScore: 1 },
  { teamA: "Iran", teamB: "New Zealand", teamAScore: 2, teamBScore: 2 },
  { teamA: "France", teamB: "Senegal", teamAScore: 3, teamBScore: 1 },
  { teamA: "Iraq", teamB: "Norway", teamAScore: 1, teamBScore: 4 },
  { teamA: "Argentina", teamB: "Algeria", teamAScore: 3, teamBScore: 0 },
  { teamA: "Austria", teamB: "Jordan", teamAScore: 3, teamBScore: 1 },
  { teamA: "Portugal", teamB: "DR Congo", teamAScore: 1, teamBScore: 1 },
  { teamA: "England", teamB: "Croatia", teamAScore: 4, teamBScore: 2 },
  { teamA: "Ghana", teamB: "Panama", teamAScore: 1, teamBScore: 0 },
  { teamA: "Uzbekistan", teamB: "Colombia", teamAScore: 1, teamBScore: 3 },
  { teamA: "Czechia", teamB: "South Africa", teamAScore: 1, teamBScore: 1 },
  { teamA: "Switzerland", teamB: "Bosnia and Herzegovina", teamAScore: 4, teamBScore: 1 },
  { teamA: "Canada", teamB: "Qatar", teamAScore: 6, teamBScore: 0 },
  { teamA: "Mexico", teamB: "South Korea", teamAScore: 1, teamBScore: 0 },
  { teamA: "United States", teamB: "Australia", teamAScore: 2, teamBScore: 0 },
  { teamA: "Scotland", teamB: "Morocco", teamAScore: 0, teamBScore: 1 },
  { teamA: "Brazil", teamB: "Haiti", teamAScore: 3, teamBScore: 0 },
  { teamA: "Turkey", teamB: "Paraguay", teamAScore: 0, teamBScore: 1 },
  { teamA: "Netherlands", teamB: "Sweden", teamAScore: 5, teamBScore: 1 },
  { teamA: "Germany", teamB: "Ivory Coast", teamAScore: 2, teamBScore: 1 },
  { teamA: "Ecuador", teamB: "Curacao", teamAScore: 0, teamBScore: 0 },
  { teamA: "Tunisia", teamB: "Japan", teamAScore: 0, teamBScore: 4 },
  { teamA: "Spain", teamB: "Saudi Arabia", teamAScore: 4, teamBScore: 0 },
  { teamA: "Belgium", teamB: "Iran", teamAScore: 0, teamBScore: 0 },
  { teamA: "Uruguay", teamB: "Cape Verde", teamAScore: 2, teamBScore: 2 },
  { teamA: "New Zealand", teamB: "Egypt", teamAScore: 1, teamBScore: 3 },
  { teamA: "Argentina", teamB: "Austria", teamAScore: 2, teamBScore: 0 },
];

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("No data returned.");
  return data;
}

function validScore(score: number) {
  return Number.isInteger(score) && score >= 0 && score <= 30;
}

function validPkScore(score: number) {
  return Number.isInteger(score) && score >= 0 && score <= 20;
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

function normalizePlayerName(name: string) {
  return name.trim();
}

function normalizeTeamName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
  const aliases: Record<string, string> = {
    "cabo verde": "cape verde",
    "congo dr": "dr congo",
    "cote d ivoire": "ivory coast",
    curacao: "curacao",
    "ir iran": "iran",
    "korea republic": "south korea",
    turkiye: "turkey",
    usa: "united states",
  };

  return aliases[normalized] ?? normalized;
}

function sameTeam(left: string, right: string) {
  return normalizeTeamName(left) === normalizeTeamName(right);
}

function isGroupMatch(match: MatchRow) {
  return /^Group [A-L]$/.test(match.stage);
}

function isKnockoutMatch(match: MatchRow) {
  return KNOCKOUT_STAGE_SET.has(match.stage);
}

function bracketSlot(stage: string, index: number) {
  const config = KNOCKOUT_SLOT_COUNTS.find((item) => item.stage === stage);
  if (!config) return null;
  if (config.prefix === "THIRD" || config.prefix === "FINAL") return config.prefix;
  return `${config.prefix}-${index + 1}`;
}

function knockoutStageOrder(stage: string) {
  return KNOCKOUT_SLOT_COUNTS.findIndex((item) => item.stage === stage);
}

function slotNumber(slot: string | null) {
  if (!slot) return Number.MAX_SAFE_INTEGER;
  const match = slot.match(/-(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function sortKnockoutRows(a: MatchRow, b: MatchRow) {
  return (
    knockoutStageOrder(a.stage) - knockoutStageOrder(b.stage) ||
    slotNumber(a.bracket_slot) - slotNumber(b.bracket_slot) ||
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime() ||
    a.id.localeCompare(b.id)
  );
}

function sameInstant(left: string, right: string) {
  return new Date(left).getTime() === new Date(right).getTime();
}

function avoidSameTeam(teamA: string, teamB: string, fallback: string) {
  return teamA === teamB ? fallback : teamB;
}

function completed(match: MatchRow) {
  return match.team_a_score !== null && match.team_b_score !== null;
}

function played(match: MatchRow) {
  return new Date(match.starts_at) <= new Date();
}

function leaderboardPointReason(
  predictedA: number,
  predictedB: number,
  actualA: number,
  actualB: number,
) {
  if (predictedA === actualA && predictedB === actualB) return "exact";

  const predictedGoalDifference = predictedA - predictedB;
  const actualGoalDifference = actualA - actualB;
  if (predictedGoalDifference === actualGoalDifference) return "goal diff";
  if (Math.sign(predictedGoalDifference) === Math.sign(actualGoalDifference)) return "outcome";
  if (predictedA === actualA || predictedB === actualB) return "team score";
  return "points";
}

function knockoutWinner(match?: MatchRow) {
  if (!match) return null;
  if (!completed(match)) return null;
  if (match.team_a_score! > match.team_b_score!) return match.team_a;
  if (match.team_b_score! > match.team_a_score!) return match.team_b;
  if (match.team_a_pk_score === null || match.team_b_pk_score === null) return null;
  if (match.team_a_pk_score > match.team_b_pk_score) return match.team_a;
  if (match.team_b_pk_score > match.team_a_pk_score) return match.team_b;
  return null;
}

function knockoutLoser(match?: MatchRow) {
  if (!match) return null;
  if (!completed(match)) return null;
  if (match.team_a_score! > match.team_b_score!) return match.team_b;
  if (match.team_b_score! > match.team_a_score!) return match.team_a;
  if (match.team_a_pk_score === null || match.team_b_pk_score === null) return null;
  if (match.team_a_pk_score > match.team_b_pk_score) return match.team_b;
  if (match.team_b_pk_score > match.team_a_pk_score) return match.team_a;
  return null;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function sortStandings(a: TeamStanding, b: TeamStanding) {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.team.localeCompare(b.team)
  );
}

function groupStandings(groupMatches: MatchRow[]) {
  const standings = new Map<string, TeamStanding>();

  for (const match of groupMatches) {
    for (const team of [match.team_a, match.team_b]) {
      if (!standings.has(team)) {
        standings.set(team, {
          team,
          group: match.stage,
          points: 0,
          goalDifference: 0,
          goalsFor: 0,
        });
      }
    }

    if (!completed(match)) continue;

    const teamA = standings.get(match.team_a)!;
    const teamB = standings.get(match.team_b)!;
    const teamAScore = match.team_a_score!;
    const teamBScore = match.team_b_score!;

    teamA.goalsFor += teamAScore;
    teamB.goalsFor += teamBScore;
    teamA.goalDifference += teamAScore - teamBScore;
    teamB.goalDifference += teamBScore - teamAScore;

    if (teamAScore > teamBScore) {
      teamA.points += 3;
    } else if (teamBScore > teamAScore) {
      teamB.points += 3;
    } else {
      teamA.points += 1;
      teamB.points += 1;
    }
  }

  return Array.from(standings.values()).sort(sortStandings);
}

function knockoutEntrants(matchRows: MatchRow[]) {
  const groupMatches = matchRows.filter(isGroupMatch);
  if (groupMatches.length === 0 || groupMatches.some((match) => !completed(match))) return null;

  const groups = Array.from(new Set(groupMatches.map((match) => match.stage))).sort();
  const winners: string[] = [];
  const runnersUp: string[] = [];
  const thirdPlaced: TeamStanding[] = [];

  for (const group of groups) {
    const standings = groupStandings(groupMatches.filter((match) => match.stage === group));
    if (standings.length < 3) return null;

    winners.push(standings[0].team);
    runnersUp.push(standings[1].team);
    thirdPlaced.push(standings[2]);
  }

  const bestThirds = thirdPlaced.sort(sortStandings).slice(0, 8).map((standing) => standing.team);
  return [...winners, ...runnersUp, ...bestThirds];
}

function buildKnockoutPlan(matchRows: MatchRow[]) {
  const entrants = knockoutEntrants(matchRows);
  if (!entrants) return [];

  const lastGroupStart = Math.max(
    ...matchRows.filter(isGroupMatch).map((match) => new Date(match.starts_at).getTime()),
  );
  const base = new Date(lastGroupStart + 3 * 24 * 60 * 60 * 1000);
  const existingKnockout = matchRows.filter(isKnockoutMatch);
  const roundRow = (stage: string, index: number) => {
    const slot = bracketSlot(stage, index);
    return existingKnockout.find((match) => match.stage === stage && match.bracket_slot === slot);
  };

  const r32Teams = Array.from({ length: 16 }, (_, index) => [
    entrants[index] ?? `Round of 32 ${index + 1} Team A`,
    avoidSameTeam(
      entrants[index] ?? `Round of 32 ${index + 1} Team A`,
      entrants[31 - index] ?? `Round of 32 ${index + 1} Team B`,
      `Round of 32 ${index + 1} Team B`,
    ),
  ]);
  const r16Teams = Array.from({ length: 8 }, (_, index) => [
    knockoutWinner(roundRow("Round of 32", index * 2)) ?? `Winner R32 ${index * 2 + 1}`,
    knockoutWinner(roundRow("Round of 32", index * 2 + 1)) ?? `Winner R32 ${index * 2 + 2}`,
  ]);
  const qfTeams = Array.from({ length: 4 }, (_, index) => [
    knockoutWinner(roundRow("Round of 16", index * 2)) ?? `Winner R16 ${index * 2 + 1}`,
    knockoutWinner(roundRow("Round of 16", index * 2 + 1)) ?? `Winner R16 ${index * 2 + 2}`,
  ]);
  const sfTeams = Array.from({ length: 2 }, (_, index) => [
    knockoutWinner(roundRow("Quarterfinals", index * 2)) ?? `Winner QF ${index * 2 + 1}`,
    knockoutWinner(roundRow("Quarterfinals", index * 2 + 1)) ?? `Winner QF ${index * 2 + 2}`,
  ]);
  const thirdPlaceTeams = [
    [
      knockoutLoser(roundRow("Semifinals", 0)) ?? "Loser SF 1",
      knockoutLoser(roundRow("Semifinals", 1)) ?? "Loser SF 2",
    ],
  ];
  const finalTeams = [
    [
      knockoutWinner(roundRow("Semifinals", 0)) ?? "Winner SF 1",
      knockoutWinner(roundRow("Semifinals", 1)) ?? "Winner SF 2",
    ],
  ];

  const rounds = [
    { stage: "Round of 32", offsetDays: 0, teams: r32Teams },
    { stage: "Round of 16", offsetDays: 5, teams: r16Teams },
    { stage: "Quarterfinals", offsetDays: 9, teams: qfTeams },
    { stage: "Semifinals", offsetDays: 13, teams: sfTeams },
    { stage: "Third Place Match", offsetDays: 16, teams: thirdPlaceTeams },
    { stage: "Final", offsetDays: 17, teams: finalTeams },
  ];

  return rounds.flatMap((round) =>
    round.teams.map(([teamA, teamB], index) => ({
      team_a: teamA,
      team_b: avoidSameTeam(teamA, teamB, "TBD"),
      starts_at: addHours(base, round.offsetDays * 24 + index * 3),
      stage: round.stage,
      bracket_slot: bracketSlot(round.stage, index),
    })),
  );
}

async function loadMatches() {
  const { data, error } = await supabase
    .from("matches")
    .select("id, team_a, team_b, starts_at, stage, bracket_slot, team_a_score, team_b_score, team_a_pk_score, team_b_pk_score")
    .order("starts_at");

  return unwrap(data, error) as MatchRow[];
}

async function adminUpsertMatch(player: Player, match: Omit<MatchRow, "id"> & { id?: string }) {
  const { data, error } = await supabase.rpc("app_admin_upsert_match", {
    p_player_id: player.id,
    p_token: player.token,
    p_match_id: match.id ?? null,
    p_team_a: match.team_a,
    p_team_b: match.team_b,
    p_starts_at: match.starts_at,
    p_stage: match.stage,
    p_bracket_slot: match.bracket_slot,
    p_team_a_score: match.team_a_score,
    p_team_b_score: match.team_b_score,
    p_team_a_pk_score: match.team_a_pk_score,
    p_team_b_pk_score: match.team_b_pk_score,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

async function adminDeleteKnockoutMatches(player: Player) {
  const { error } = await supabase.rpc("app_admin_delete_knockout_matches", {
    p_player_id: player.id,
    p_token: player.token,
  });

  if (error) throw new Error(error.message);
}

async function assignMissingBracketSlots(matchRows: MatchRow[], player: Player) {
  let changed = false;

  for (const config of KNOCKOUT_SLOT_COUNTS) {
    const stageRows = matchRows
      .filter((match) => match.stage === config.stage)
      .sort(sortKnockoutRows);
    const usedIds = new Set<string>();

    for (let index = 0; index < config.count; index += 1) {
      const slot = bracketSlot(config.stage, index);
      if (!slot) continue;

      const row =
        stageRows.find((match) => match.bracket_slot === slot && !usedIds.has(match.id)) ??
        stageRows.find((match) => !match.bracket_slot && !usedIds.has(match.id));

      if (!row) continue;
      usedIds.add(row.id);

      if (row.bracket_slot !== slot) {
        await adminUpsertMatch(player, { ...row, bracket_slot: slot });
        row.bracket_slot = slot;
        changed = true;
      }
    }
  }

  return changed ? loadMatches() : matchRows;
}

async function ensureKnockoutMatches(matchRows: MatchRow[], player: Player) {
  const slottedRows = await assignMissingBracketSlots(matchRows, player);
  const plan = buildKnockoutPlan(slottedRows);
  if (plan.length === 0) return slottedRows;

  const existing = slottedRows.filter(isKnockoutMatch);
  let changed = false;

  for (const plannedMatch of plan) {
    const current = existing.find(
      (match) => match.stage === plannedMatch.stage && match.bracket_slot === plannedMatch.bracket_slot,
    );

    if (!current) {
      await adminUpsertMatch(player, {
        ...plannedMatch,
        team_a_score: null,
        team_b_score: null,
        team_a_pk_score: null,
        team_b_pk_score: null,
      });
      changed = true;
      continue;
    }

    if (
      current.team_a !== plannedMatch.team_a ||
      current.team_b !== plannedMatch.team_b ||
      !sameInstant(current.starts_at, plannedMatch.starts_at)
    ) {
      await adminUpsertMatch(player, {
        ...current,
        team_a: plannedMatch.team_a,
        team_b: plannedMatch.team_b,
        starts_at: plannedMatch.starts_at,
        bracket_slot: plannedMatch.bracket_slot,
        team_a_score: null,
        team_b_score: null,
        team_a_pk_score: null,
        team_b_pk_score: null,
      });
      changed = true;
    }
  }

  return loadMatches();
}

async function ensureRoundOf32Matches(player: Player) {
  const matches = await ensureKnockoutMatches(await loadMatches(), player);
  const roundOf32Matches = matches.filter((match) => match.stage === "Round of 32");
  if (roundOf32Matches.length > 0) return matches;

  const rebuiltMatches = await ensureKnockoutMatches(await loadMatches(), player);
  if (rebuiltMatches.some((match) => match.stage === "Round of 32")) return rebuiltMatches;

  throw new Error("Round of 32 matches are not ready. Generate group results first.");
}

async function requireSession(player: Player) {
  const { data, error } = await supabase
    .rpc("app_require_session", { p_player_id: player.id, p_token: player.token })
    .single();

  if (error) throw new Error(error.message);
  return data as PlayerRow;
}

export async function login(name: string, pin: string): Promise<Player> {
  const normalizedName = normalizePlayerName(name);
  const { data, error } = await supabase
    .rpc("app_login_player", { p_name: normalizedName, p_pin: pin })
    .single();

  if (error) throw new Error(error.message);

  const row = unwrap(data, error) as PlayerRow & { token: string };
  return {
    id: row.id,
    name: row.name,
    isAdmin: row.is_admin,
    favoriteTeam: row.favorite_team ?? null,
    token: row.token,
  };
}

export async function changePin(
  player: Player,
  currentPin: string,
  newPin: string,
  confirmNewPin: string,
) {
  if (!/^\d{4,8}$/.test(newPin)) {
    throw new Error("PIN must be 4 to 8 digits.");
  }
  if (newPin !== confirmNewPin) {
    throw new Error("New PINs do not match.");
  }

  const { error } = await supabase.rpc("app_change_pin", {
    p_player_id: player.id,
    p_token: player.token,
    p_current_pin: currentPin,
    p_new_pin: newPin,
  });

  if (error) throw new Error(error.message);
}

export async function saveFavoriteTeam(player: Player, favoriteTeam: string) {
  await requireSession(player);

  const normalizedFavoriteTeam = favoriteTeam.trim();
  const teams = new Set(FAVORITE_TEAM_OPTIONS);

  if (!teams.has(normalizedFavoriteTeam)) {
    throw new Error("Choose a valid team.");
  }

  const { error } = await supabase.rpc("app_save_favorite_team", {
    p_player_id: player.id,
    p_token: player.token,
    p_favorite_team: normalizedFavoriteTeam,
  });

  if (error) throw new Error(error.message);
}

export async function loadPool(player: Player): Promise<PoolData> {
  const currentPlayer = await requireSession(player);

  const initialMatchRows = await loadMatches();
  const matchRows = currentPlayer.is_admin
    ? await ensureKnockoutMatches(initialMatchRows, player)
    : initialMatchRows;
  const favoriteTeamOptions = FAVORITE_TEAM_OPTIONS;

  const [myPredictionsResult, playersResult, allPredictionsResult] = await Promise.all([
    supabase
      .from("predictions")
      .select("match_id, team_a_score, team_b_score")
      .eq("player_id", player.id),
    supabase.from("players").select("id, name, is_admin, favorite_team"),
    supabase.from("predictions").select("player_id, match_id, team_a_score, team_b_score"),
  ]);

  const matches = matchRows.map((row): Match => ({
    id: row.id,
    teamA: row.team_a,
    teamB: row.team_b,
    startsAt: row.starts_at,
    stage: row.stage,
    teamAScore: row.team_a_score,
    teamBScore: row.team_b_score,
    teamAPkScore: row.team_a_pk_score,
    teamBPkScore: row.team_b_pk_score,
  }));

  const predictions = unwrap(myPredictionsResult.data, myPredictionsResult.error).map(
    (row): Prediction => ({
      matchId: row.match_id,
      teamAScore: row.team_a_score,
      teamBScore: row.team_b_score,
    }),
  );

  const completedMatchMap = new Map(
    matchRows
      .filter((match) => completed(match) && played(match))
      .map((match) => [match.id, match]),
  );
  const allPredictions = unwrap(allPredictionsResult.data, allPredictionsResult.error);
  const players = unwrap(playersResult.data, playersResult.error);
  const leaderboard = players
    .filter((item) => !item.is_admin)
    .map((item) => {
      let points = 0;
      let exactScores = 0;
      let correctOutcomes = 0;
      let goalDifferences = 0;
      const details = [];

      for (const prediction of allPredictions.filter((entry) => entry.player_id === item.id)) {
        const match = completedMatchMap.get(prediction.match_id);
        if (!match) continue;
        const actualTeamAScore = match.team_a_score;
        const actualTeamBScore = match.team_b_score;
        if (actualTeamAScore === null || actualTeamBScore === null) continue;

        const predictedGoalDifference = prediction.team_a_score - prediction.team_b_score;
        const actualGoalDifference = actualTeamAScore - actualTeamBScore;

        const matchPoints = predictionPoints(
          prediction.team_a_score,
          prediction.team_b_score,
          actualTeamAScore,
          actualTeamBScore,
        );
        points += matchPoints;
        if (matchPoints > 0) {
          details.push({
            matchId: match.id,
            label: `${match.team_a} ${actualTeamAScore}-${actualTeamBScore} ${match.team_b}`,
            points: matchPoints,
            reason: leaderboardPointReason(
              prediction.team_a_score,
              prediction.team_b_score,
              actualTeamAScore,
              actualTeamBScore,
            ),
          });
        }
        if (predictedGoalDifference === actualGoalDifference) {
          goalDifferences += 1;
        }
        if (Math.sign(predictedGoalDifference) === Math.sign(actualGoalDifference)) {
          correctOutcomes += 1;
        }
        if (
          prediction.team_a_score === actualTeamAScore &&
          prediction.team_b_score === actualTeamBScore
        ) {
          exactScores += 1;
        }
      }

      return { playerId: item.id, name: item.name, points, exactScores, correctOutcomes, goalDifferences, details };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.exactScores - a.exactScores ||
        b.goalDifferences - a.goalDifferences ||
        a.name.localeCompare(b.name),
    );
  const rankMap = new Map(leaderboard.map((row, index) => [row.playerId, index + 1]));
  const profilePlayers = players.filter((item) => item.id === player.id);
  const profiles = profilePlayers.map((item) => {
    let totalPoints = 0;
    let exactScores = 0;
    let correctOutcomes = 0;
    let goalDifferences = 0;
    let completedMatchesCount = 0;
    const playerPredictions = allPredictions.filter((entry) => entry.player_id === item.id);
    const roundStats = new Map<string, { points: number; count: number }>();
    const recentMatches = [];

    for (const prediction of playerPredictions) {
      const match = completedMatchMap.get(prediction.match_id);
      if (!match) continue;
      const actualTeamAScore = match.team_a_score;
      const actualTeamBScore = match.team_b_score;
      if (actualTeamAScore === null || actualTeamBScore === null) continue;

      completedMatchesCount += 1;
      const predictedGoalDifference = prediction.team_a_score - prediction.team_b_score;
      const actualGoalDifference = actualTeamAScore - actualTeamBScore;
      const matchPoints = predictionPoints(
        prediction.team_a_score,
        prediction.team_b_score,
        actualTeamAScore,
        actualTeamBScore,
      );

      totalPoints += matchPoints;
      const currentRoundStats = roundStats.get(match.stage) ?? { points: 0, count: 0 };
      currentRoundStats.points += matchPoints;
      currentRoundStats.count += 1;
      roundStats.set(match.stage, currentRoundStats);
      if (Math.sign(predictedGoalDifference) === Math.sign(actualGoalDifference)) {
        correctOutcomes += 1;
      }
      if (predictedGoalDifference === actualGoalDifference) {
        goalDifferences += 1;
      }
      if (prediction.team_a_score === actualTeamAScore && prediction.team_b_score === actualTeamBScore) {
        exactScores += 1;
      }
      recentMatches.push({
        matchId: match.id,
        label: `${match.team_a} vs ${match.team_b}`,
        pick: `${prediction.team_a_score} - ${prediction.team_b_score}`,
        actual: `${actualTeamAScore} - ${actualTeamBScore}`,
        points: matchPoints,
        startsAt: match.starts_at,
      });
    }

    recentMatches.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    const favoriteTeam = item.favorite_team ?? "Not selected yet";
    const bestRound = Array.from(roundStats.entries()).sort((a, b) => {
      const leftAverage = a[1].points / a[1].count;
      const rightAverage = b[1].points / b[1].count;
      return rightAverage - leftAverage || b[1].count - a[1].count || a[0].localeCompare(b[0]);
    })[0]?.[0] ?? "Not enough data yet";

    return {
      playerId: item.id,
      name: item.name,
      totalPoints,
      rank: rankMap.get(item.id) ?? null,
      exactScores,
      correctOutcomes,
      goalDifferences,
      totalPredictions: playerPredictions.length,
      completedMatchesCount,
      accuracyPercentage:
        completedMatchesCount === 0 ? 0 : Number(((correctOutcomes / completedMatchesCount) * 100).toFixed(1)),
      favoriteTeam,
      bestRound,
      averagePointsPerCompletedMatch:
        completedMatchesCount === 0 ? 0 : Number((totalPoints / completedMatchesCount).toFixed(2)),
      recentMatches: recentMatches.slice(0, 8).map(({ startsAt, ...match }) => match),
    };
  });
  const completedMatches = matchRows.filter((match) => completed(match) && played(match));
  const lockedAwaitingResult = matchRows.filter((match) => played(match) && !completed(match)).length;
  const lastOfficialMatch = completedMatches.sort(
    (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
  )[0];
  const adminDashboard = player.isAdmin
    ? {
        totalPlayers: players.filter((item) => !item.is_admin).length,
        totalPredictions: allPredictions.length,
        completedMatches: completedMatches.length,
        lockedAwaitingResult,
        currentLeader: leaderboard[0] ? `${leaderboard[0].name} (${leaderboard[0].points} pts)` : "No leader yet",
        lastOfficialResult: lastOfficialMatch
          ? `${lastOfficialMatch.team_a} ${lastOfficialMatch.team_a_score}-${lastOfficialMatch.team_b_score} ${lastOfficialMatch.team_b}`
          : "No official results yet",
      }
    : null;

  return { matches, predictions, leaderboard, profiles, favoriteTeamOptions, adminDashboard };
}

export async function savePrediction(player: Player, prediction: Prediction) {
  await requireSession(player);

  if (!validScore(prediction.teamAScore) || !validScore(prediction.teamBScore)) {
    throw new Error("Scores must be between 0 and 30.");
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("starts_at")
    .eq("id", prediction.matchId)
    .maybeSingle();

  if (matchError) throw new Error(matchError.message);
  if (!match) throw new Error("Match not found.");
  if (new Date(match.starts_at) <= new Date()) {
    throw new Error("This match has started. Predictions are locked.");
  }

  const { error } = await supabase.rpc("app_save_prediction", {
    p_player_id: player.id,
    p_token: player.token,
    p_match_id: prediction.matchId,
    p_team_a_score: prediction.teamAScore,
    p_team_b_score: prediction.teamBScore,
  });

  if (error) throw new Error(error.message);
}

export async function saveResult(
  player: Player,
  matchId: string,
  teamAScore: number,
  teamBScore: number,
  teamAPkScore?: number,
  teamBPkScore?: number,
) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");
  if (!validScore(teamAScore) || !validScore(teamBScore)) {
    throw new Error("Scores must be between 0 and 30.");
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("stage")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) throw new Error(matchError.message);
  if (!match) throw new Error("Match not found.");

  const tied = teamAScore === teamBScore;
  const knockout = KNOCKOUT_STAGE_SET.has(match.stage);
  let penaltyScores = {
    team_a_pk_score: null as number | null,
    team_b_pk_score: null as number | null,
  };

  if (knockout && tied) {
    if (teamAPkScore === undefined || teamBPkScore === undefined) {
      throw new Error("Penalty scores are required for tied knockout matches.");
    }
    if (!validPkScore(teamAPkScore) || !validPkScore(teamBPkScore)) {
      throw new Error("Penalty scores must be between 0 and 20.");
    }
    if (teamAPkScore === teamBPkScore) {
      throw new Error("Penalty scores cannot be tied.");
    }

    penaltyScores = { team_a_pk_score: teamAPkScore, team_b_pk_score: teamBPkScore };
  }

  const { data, error } = await supabase.rpc("app_admin_set_match_result", {
    p_player_id: player.id,
    p_token: player.token,
    p_match_id: matchId,
    p_team_a_score: teamAScore,
    p_team_b_score: teamBScore,
    p_team_a_pk_score: penaltyScores.team_a_pk_score,
    p_team_b_pk_score: penaltyScores.team_b_pk_score,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Match not found.");
  await ensureKnockoutMatches(await loadMatches(), player);
}

export async function generateTestGroupResults(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  const groupMatches = (await loadMatches()).filter(isGroupMatch);

  for (const match of groupMatches) {
    await adminUpsertMatch(player, {
      ...match,
      team_a_score: testScore(),
      team_b_score: testScore(),
      team_a_pk_score: null,
      team_b_pk_score: null,
    });
  }

  await ensureKnockoutMatches(await loadMatches(), player);
}

async function generateTestScoresForStage(player: Player, stage: string) {
  const matches = await ensureKnockoutMatches(await loadMatches(), player);
  const stageMatches = matches.filter((match) => match.stage === stage).sort(sortKnockoutRows);
  if (stageMatches.length === 0) throw new Error(`No ${stage} matches found.`);

  for (const match of stageMatches) {
    const { teamAScore, teamBScore } = testKnockoutScore();
    await adminUpsertMatch(player, {
      ...match,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      team_a_pk_score: null,
      team_b_pk_score: null,
    });
  }

  await ensureKnockoutMatches(await loadMatches(), player);
  await verifyScoredStage(stage);
}

async function verifyScoredStage(stage: string) {
  const expected = KNOCKOUT_EXPECTED_SCORES.get(stage);
  if (!expected) throw new Error(`Unknown knockout stage: ${stage}`);

  const matches = (await loadMatches()).filter((match) => match.stage === stage);
  const scored = matches.filter(
    (match) => match.team_a_score !== null && match.team_b_score !== null,
  ).length;

  if (scored !== expected) {
    throw new Error(`Failed: ${stage} updated ${scored} of ${expected}`);
  }
}

async function verifyFullTestTournament() {
  for (const stage of KNOCKOUT_STAGES) {
    await verifyScoredStage(stage);
  }
}

export async function resetTestKnockoutBracket(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  await adminDeleteKnockoutMatches(player);

  await ensureKnockoutMatches(await loadMatches(), player);
}

export async function resetTestResults(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  const matches = await loadMatches();
  const groupMatchIds = matches.filter(isGroupMatch).map((match) => match.id);

  if (groupMatchIds.length > 0) {
    for (const match of matches.filter(isGroupMatch)) {
      await adminUpsertMatch(player, {
        ...match,
        team_a_score: null,
        team_b_score: null,
        team_a_pk_score: null,
        team_b_pk_score: null,
      });
    }
  }

  await adminDeleteKnockoutMatches(player);
}

export async function importOfficialScoresSoFar(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  const groupMatches = (await loadMatches()).filter(isGroupMatch);
  const lockedAt = new Date(Date.now() - 60 * 1000).toISOString();

  for (const result of OFFICIAL_SCORES_SO_FAR) {
    const match = groupMatches.find(
      (item) =>
        (sameTeam(item.team_a, result.teamA) && sameTeam(item.team_b, result.teamB)) ||
        (sameTeam(item.team_a, result.teamB) && sameTeam(item.team_b, result.teamA)),
    );

    if (!match) throw new Error(`Could not find group match: ${result.teamA} vs ${result.teamB}`);

    const resultMatchesTeamOrder = sameTeam(match.team_a, result.teamA);
    const teamAScore = resultMatchesTeamOrder ? result.teamAScore : result.teamBScore;
    const teamBScore = resultMatchesTeamOrder ? result.teamBScore : result.teamAScore;
    const startsAt =
      new Date(match.starts_at).getTime() <= Date.now() ? match.starts_at : lockedAt;
    await adminUpsertMatch(player, {
      ...match,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      team_a_pk_score: null,
      team_b_pk_score: null,
      starts_at: startsAt,
    });
  }

  await ensureKnockoutMatches(await loadMatches(), player);
}

export async function generateFullTestTournament(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  await adminDeleteKnockoutMatches(player);

  const groupMatches = (await loadMatches()).filter(isGroupMatch);
  for (const match of groupMatches) {
    await adminUpsertMatch(player, {
      ...match,
      team_a_score: testScore(),
      team_b_score: testScore(),
      team_a_pk_score: null,
      team_b_pk_score: null,
    });
  }

  await ensureKnockoutMatches(await loadMatches(), player);

  for (const stage of KNOCKOUT_STAGES) {
    await generateTestScoresForStage(player, stage);
  }

  await verifyFullTestTournament();
}
