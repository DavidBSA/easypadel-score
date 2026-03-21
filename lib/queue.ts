// Match queue generator for EasyPadelScore
// generateMatchQueue     — MIXED format (rotating partners)
// generateTeamMatchQueue — TEAM format (fixed partners, true round-robin)

export type QueuePlayer = {
  id: string;
  name: string;
  isActive: boolean;
};

export type QueueTeam = {
  id: string;
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

// ─── MIXED: penalty weights ────────────────────────────────────────────────────
const MATCHES_PER_PLAYER  = 5;
const PARTNER_PENALTY     = 3;
const OPPONENT_PENALTY    = 1;
const SITOUT_PENALTY      = 4;
const GENERATOR_ATTEMPTS  = 300;

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
  for (const pid of sitOuts)
    score += (sitOutCount.get(pid) ?? 0) * SITOUT_PENALTY;
  return score;
}

// ─── MIXED queue generator (unchanged) ───────────────────────────────────────
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
      for (const pid of [...m.tA, ...m.tB])
        matchCount.set(pid, (matchCount.get(pid) ?? 0) + 1);
      allMatches.push({
        queuePosition: queuePosition++,
        teamAPlayer1: m.tA[0],
        teamAPlayer2: m.tA[1],
        teamBPlayer1: m.tB[0],
        teamBPlayer2: m.tB[1],
      });
    }

    for (const pid of sitOuts)
      sitOutCount.set(pid, (sitOutCount.get(pid) ?? 0) + 1);
    lastSitOutIds = new Set(sitOuts);
  }

  return allMatches;
}

// ─── TEAM queue generator — true round-robin ──────────────────────────────────
//
// Uses the circle method to guarantee every team plays every other team
// exactly once. Session ends naturally when the full round-robin is complete.
//
// For N teams (even): N-1 rounds, each with N/2 matches.
// For N teams (odd):  N rounds, each with (N-1)/2 matches — one team sits out
//                     each round, rotating so each team sits out exactly once.
//
// The courts parameter does not change the total schedule — it only determines
// how many matches run simultaneously (handled by auto-assign in the score route).
// Matches are ordered round by round so no team is double-scheduled within a round.
//
export function generateTeamMatchQueue(
  teams: QueueTeam[],
  courts: number
): QueueMatch[] {
  const active = teams.filter((t) => t.isActive);
  const n = active.length;

  if (n < 2) return [];

  // ── Circle method ──────────────────────────────────────────────────────────
  // If n is odd, add a virtual "bye" slot at the end (index n).
  // Any match that involves the bye is skipped (that team sits out that round).
  const size = n % 2 === 0 ? n : n + 1;

  // indices[0] is fixed; indices[1..size-1] rotate each round.
  const indices = Array.from({ length: size }, (_, i) => i);

  const allMatches: QueueMatch[] = [];
  let queuePosition = 0;

  for (let round = 0; round < size - 1; round++) {
    // Pair up: indices[0] vs indices[size-1],
    //          indices[1] vs indices[size-2], etc.
    for (let i = 0; i < size / 2; i++) {
      const a = indices[i];
      const b = indices[size - 1 - i];

      // Skip if either slot is the bye (index >= n)
      if (a >= n || b >= n) continue;

      const tA = active[a];
      const tB = active[b];

      allMatches.push({
        queuePosition: queuePosition++,
        teamAPlayer1: tA.player1Id,
        teamAPlayer2: tA.player2Id,
        teamBPlayer1: tB.player1Id,
        teamBPlayer2: tB.player2Id,
      });
    }

    // Rotate indices[1..size-1]: move the last element to position 1.
    const last = indices[size - 1];
    for (let i = size - 1; i > 1; i--) {
      indices[i] = indices[i - 1];
    }
    indices[1] = last;
  }

  return allMatches;
}