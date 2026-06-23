export type Player = { id: string; name: string; isAdmin: boolean; token: string; favoriteTeam: string | null };

export type Match = {
  id: string;
  teamA: string;
  teamB: string;
  startsAt: string;
  stage: string;
  teamAScore: number | null;
  teamBScore: number | null;
  teamAPkScore: number | null;
  teamBPkScore: number | null;
};

export type Prediction = { matchId: string; teamAScore: number; teamBScore: number };

export type LeaderboardRow = {
  playerId: string;
  name: string;
  points: number;
  exactScores: number;
  correctOutcomes: number;
  goalDifferences: number;
  details: LeaderboardDetail[];
};

export type LeaderboardDetail = {
  matchId: string;
  label: string;
  points: number;
  reason: string;
};

export type PlayerProfile = {
  playerId: string;
  name: string;
  totalPoints: number;
  rank: number | null;
  exactScores: number;
  correctOutcomes: number;
  goalDifferences: number;
  totalPredictions: number;
  completedMatchesCount: number;
  accuracyPercentage: number;
  favoriteTeam: string;
  bestRound: string;
  averagePointsPerCompletedMatch: number;
  recentMatches: ProfileMatch[];
};

export type ProfileMatch = {
  matchId: string;
  label: string;
  pick: string;
  actual: string;
  points: number;
};

export type AdminDashboard = {
  totalPlayers: number;
  totalPredictions: number;
  completedMatches: number;
  lockedAwaitingResult: number;
  currentLeader: string;
  lastOfficialResult: string;
};

export type PoolData = {
  matches: Match[];
  predictions: Prediction[];
  leaderboard: LeaderboardRow[];
  profiles: PlayerProfile[];
  favoriteTeamOptions: string[];
  adminDashboard: AdminDashboard | null;
};
