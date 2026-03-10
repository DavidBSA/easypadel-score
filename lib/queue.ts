// Match queue generator for EasyPadelScore
// Builds the full session schedule upfront using penalty scoring
// generateMatchQueue     — MIXED format (rotating partners)
// generateTeamMatchQueue — TEAM format (fixed partners, rotating opponents)

export type QueuePlayer = {
  id: string;
  name: string;
  isActive: boolean;
};

export type QueueTeam = {
  id: string;           // unique team id (player1Id + player2Id concatenated or cuid)
  player1Id: string;
  player2Id: string;
  isActive: boolean;
};

export type QueueMatch = {
  queuePosition: number;
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
};

// How many matches to generate per player / per team in the session
const MATCHES_PER_PLAYER = 5;
const MATCHES_PER_TEAM   = 5;

// Penalty weights
const PARTNER_PENALTY  = 3;
const OPPONENT_PENALTY = 1;
const SITOUT_PENALTY   = 4;
const GENERATOR_ATTEMPTS = 300;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function addPairCount(
  map: Map<string, Map<string, number>>,
  a: string,
  b: string
) {
  if (!map.has(a)) map.set(a, new Map());
  if (!map.has(b)) map.set(b, new Map());
  map.get(a)!.set(b, (map.get(a)!.get(b) ?? 0) + 1);
  map.get(b)!.set(a, (map.get(b)!.get(a) ?? 0) + 1);
}

// ─── MIXED: Score a candidate round against history ───────────────────────────
function scoreRound(
  matches: { tA: [string, string]; tB: [string, string] }[],
  partnerCount: Map<string, Map<string, number>>,
  opponentCount: Map<string, Map<string, number>>,
  sitOutCount: Map<string, number>,
  sitOuts: string[]
): number {
  let score = 0;
  for (const m of matches) {
    score += (partnerCount.get(m.tA[0])?.get(m.tA[1]) ?? 0) * PARTNER_PENALTY;
    score += (partnerCount.get(m.tB[0])?.get(m.tB[1]) ?? 0) * PARTNER_PENALTY;
    for (const a of m.tA)
      for (const b of m.tB)
        score += (opponentCount.get(a)?.get(b) ?? 0) * OPPONENT_PENALTY;
  }
  for (const pid of sitOuts) {
    score += (sitOutCount.get(pid) ?? 0) * SITOUT_PENALTY;
  }
  return score;
}

// ─── TEAM: Score a candidate round against history ────────────────────────────
// Units here are team IDs, not player IDs
function scoreTeamRound(
  matches: { tA: string; tB: string }[],   // tA/tB are team IDs
  opponentCount: Map<string, Map<string, number>>,
  sitOutCount: Map<string, number>,
  sitOuts: string[]
): number {
  let score = 0;
  for (const m of matches) {
    score += (opponentCount.get(m.tA)?.get(m.tB) ?? 0) * OPPONENT_PENALTY;
  }
  for (const tid of sitOuts) {
    score += (sitOutCount.get(tid) ?? 0) * SITOUT_PENALTY;
  }
  return score;
}

// ─── MIXED queue generator ────────────────────────────────────────────────────
export function generateMatchQueue(
  players: QueuePlayer[],
  courts: number
): QueueMatch[] {
  const activePlayers = players.filter((p) => p.isActive);
  const slotsPerRound = courts * 4;
  const totalRounds = Math.ceil(
    (activePlayers.length * MATCHES_PER_PLAYER) / slotsPerRound
  );

  const partnerCount  = new Map<string, Map<string, number>>();
  const opponentCount = new Map<string, Map<string, number>>();
  const sitOutCount   = new Map<string, number>();
  const matchCount    = new Map<string, number>();

  for (const p of activePlayers) {
    partnerCount.set(p.id, new Map());
    opponentCount.set(p.id, new Map());
    sitOutCount.set(p.id, 0);
    matchCount.set(p.id, 0);
  }

  const allMatches: QueueMatch[] = [];
  let queuePosition = 0;
  let lastSitOutIds = new Set<string>();

  for (let round = 0; round < totalRounds; round++) {
    const sitOutsNeeded = activePlayers.length - slotsPerRound;
    let sitOuts: string[] = [];

    if (sitOutsNeeded > 0) {
      const eligible = activePlayers.filter((p) => !lastSitOutIds.has(p.id));
      const sorted = [...eligible].sort((a, b) => {
        const sitDiff = (sitOutCount.get(a.id) ?? 0) - (sitOutCount.get(b.id) ?? 0);
        if (sitDiff !== 0) return sitDiff;
        return (matchCount.get(b.id) ?? 0) - (matchCount.get(a.id) ?? 0);
      });
      sitOuts = sorted.slice(0, sitOutsNeeded).map((p) => p.id);
    }

    const sitOutSet    = new Set(sitOuts);
    const roundPlayers = activePlayers.filter((p) => !sitOutSet.has(p.id));

    let bestRound: { tA: [string, string]; tB: [string, string] }[] | null = null;
    let bestScore = Infinity;

    for (let attempt = 0; attempt < GENERATOR_ATTEMPTS; attempt++) {
      const shuffled  = shuffle(roundPlayers);
      const candidate: { tA: [string, string]; tB: [string, string] }[] = [];
      for (let c = 0; c < courts; c++) {
        const b = c * 4;
        candidate.push({
          tA: [shuffled[b].id, shuffled[b + 1].id],
          tB: [shuffled[b + 2].id, shuffled[b + 3].id],
        });
      }
      const s = scoreRound(candidate, partnerCount, opponentCount, sitOutCount, sitOuts);
      if (s < bestScore) { bestScore = s; bestRound = candidate; }
    }

    for (const m of bestRound!) {
      addPairCount(partnerCount, m.tA[0], m.tA[1]);
      addPairCount(partnerCount, m.tB[0], m.tB[1]);
      for (const a of m.tA)
        for (const b of m.tB) addPairCount(opponentCount, a, b);
      for (const pid of [...m.tA, ...m.tB]) {
        matchCount.set(pid, (matchCount.get(pid) ?? 0) + 1);
      }
      allMatches.push({
        queuePosition: queuePosition++,
        teamAPlayer1: m.tA[0],
        teamAPlayer2: m.tA[1],
        teamBPlayer1: m.tB[0],
        teamBPlayer2: m.tB[1],
      });
    }

    for (const pid of sitOuts) {
      sitOutCount.set(pid, (sitOutCount.get(pid) ?? 0) + 1);
    }
    lastSitOutIds = new Set(sitOuts);
  }

  return allMatches;
}

// ─── TEAM queue generator ─────────────────────────────────────────────────────
// Partners are fixed. We schedule which teams play each other.
// teamAPlayer1/teamAPlayer2 = team A's fixed pair; same for B.
export function generateTeamMatchQueue(
  teams: QueueTeam[],
  courts: number
): QueueMatch[] {
  const activeTeams    = teams.filter((t) => t.isActive);
  const teamsPerRound  = courts * 2;
  const totalRounds    = Math.ceil(
    (activeTeams.length * MATCHES_PER_TEAM) / teamsPerRound
  );

  // Opponent tracking is by team ID
  const opponentCount = new Map<string, Map<string, number>>();
  const sitOutCount   = new Map<string, number>();
  const matchCount    = new Map<string, number>();

  for (const t of activeTeams) {
    opponentCount.set(t.id, new Map());
    sitOutCount.set(t.id, 0);
    matchCount.set(t.id, 0);
  }

  const allMatches: QueueMatch[] = [];
  let queuePosition = 0;
  let lastSitOutIds = new Set<string>();

  for (let round = 0; round < totalRounds; round++) {
    const sitOutsNeeded = activeTeams.length - teamsPerRound;
    let sitOuts: string[] = [];

    if (sitOutsNeeded > 0) {
      const eligible = activeTeams.filter((t) => !lastSitOutIds.has(t.id));
      const sorted = [...eligible].sort((a, b) => {
        const sitDiff = (sitOutCount.get(a.id) ?? 0) - (sitOutCount.get(b.id) ?? 0);
        if (sitDiff !== 0) return sitDiff;
        return (matchCount.get(b.id) ?? 0) - (matchCount.get(a.id) ?? 0);
      });
      sitOuts = sorted.slice(0, sitOutsNeeded).map((t) => t.id);
    }

    const sitOutSet   = new Set(sitOuts);
    const roundTeams  = activeTeams.filter((t) => !sitOutSet.has(t.id));

    let bestRound: { tA: string; tB: string }[] | null = null;
    let bestScore = Infinity;

    for (let attempt = 0; attempt < GENERATOR_ATTEMPTS; attempt++) {
      const shuffled  = shuffle(roundTeams);
      const candidate: { tA: string; tB: string }[] = [];
      for (let c = 0; c < courts; c++) {
        const b = c * 2;
        candidate.push({ tA: shuffled[b].id, tB: shuffled[b + 1].id });
      }
      const s = scoreTeamRound(candidate, opponentCount, sitOutCount, sitOuts);
      if (s < bestScore) { bestScore = s; bestRound = candidate; }
    }

    // Commit round — resolve team IDs back to player IDs for QueueMatch
    const teamById = new Map(activeTeams.map((t) => [t.id, t]));
    for (const m of bestRound!) {
      const tA = teamById.get(m.tA)!;
      const tB = teamById.get(m.tB)!;

      addPairCount(opponentCount, m.tA, m.tB);
      matchCount.set(m.tA, (matchCount.get(m.tA) ?? 0) + 1);
      matchCount.set(m.tB, (matchCount.get(m.tB) ?? 0) + 1);

      allMatches.push({
        queuePosition: queuePosition++,
        teamAPlayer1: tA.player1Id,
        teamAPlayer2: tA.player2Id,
        teamBPlayer1: tB.player1Id,
        teamBPlayer2: tB.player2Id,
      });
    }

    for (const tid of sitOuts) {
      sitOutCount.set(tid, (sitOutCount.get(tid) ?? 0) + 1);
    }
    lastSitOutIds = new Set(sitOuts);
  }

  return allMatches;
}