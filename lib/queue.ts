// Match queue generator for EasyPadelScore
// Builds the full session schedule upfront using penalty scoring
// Same fairness logic as the localStorage version, now applied across all rounds at once

export type QueuePlayer = {
  id: string;
  name: string;
  isActive: boolean;
};

export type QueueMatch = {
  queuePosition: number;
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
};

// How many matches to generate per player in the session
const MATCHES_PER_PLAYER = 5;

// Penalty weights — same as real-time generator
const PARTNER_PENALTY = 3;
const OPPONENT_PENALTY = 1;
const SITOUT_PENALTY = 4; // strong incentive to rotate sit-outs fairly
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

// Score a candidate round of matches against history
function scoreRound(
  matches: { tA: [string, string]; tB: [string, string] }[],
  partnerCount: Map<string, Map<string, number>>,
  opponentCount: Map<string, Map<string, number>>,
  sitOutCount: Map<string, number>,
  sitOuts: string[]
): number {
  let score = 0;

  for (const m of matches) {
    // Partner repeat penalty
    score += (partnerCount.get(m.tA[0])?.get(m.tA[1]) ?? 0) * PARTNER_PENALTY;
    score += (partnerCount.get(m.tB[0])?.get(m.tB[1]) ?? 0) * PARTNER_PENALTY;
    // Opponent repeat penalty
    for (const a of m.tA)
      for (const b of m.tB)
        score += (opponentCount.get(a)?.get(b) ?? 0) * OPPONENT_PENALTY;
  }

  // Sit-out fairness penalty — penalise if a player who already sat out is sitting out again
  for (const pid of sitOuts) {
    score += (sitOutCount.get(pid) ?? 0) * SITOUT_PENALTY;
  }

  return score;
}

export function generateMatchQueue(
  players: QueuePlayer[],
  courts: number
): QueueMatch[] {
  const activePlayers = players.filter((p) => p.isActive);
  const slotsPerRound = courts * 4;
  const totalRounds = Math.ceil(
    (activePlayers.length * MATCHES_PER_PLAYER) / slotsPerRound
  );

  const partnerCount = new Map<string, Map<string, number>>();
  const opponentCount = new Map<string, Map<string, number>>();
  const sitOutCount = new Map<string, number>();
  const matchCount = new Map<string, number>();

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

    // Determine who sits out this round
    let sitOuts: string[] = [];
    if (sitOutsNeeded > 0) {
      // Exclude last round's sit-outs from sitting out again
      const eligible = activePlayers.filter(
        (p) => !lastSitOutIds.has(p.id)
      );
      // Sort by sit-out count ascending, then by match count descending
      // (those who played most should sit out before those who played least)
      const sorted = [...eligible].sort((a, b) => {
        const sitDiff =
          (sitOutCount.get(a.id) ?? 0) - (sitOutCount.get(b.id) ?? 0);
        if (sitDiff !== 0) return sitDiff;
        return (
          (matchCount.get(b.id) ?? 0) - (matchCount.get(a.id) ?? 0)
        );
      });
      sitOuts = sorted.slice(0, sitOutsNeeded).map((p) => p.id);
    }

    const sitOutSet = new Set(sitOuts);
    const roundPlayers = activePlayers.filter((p) => !sitOutSet.has(p.id));

    // Generate best round via GENERATOR_ATTEMPTS shuffles
    let bestRound: { tA: [string, string]; tB: [string, string] }[] | null =
      null;
    let bestScore = Infinity;

    for (let attempt = 0; attempt < GENERATOR_ATTEMPTS; attempt++) {
      const shuffled = shuffle(roundPlayers);
      const candidate: { tA: [string, string]; tB: [string, string] }[] = [];

      for (let c = 0; c < courts; c++) {
        const b = c * 4;
        candidate.push({
          tA: [shuffled[b].id, shuffled[b + 1].id],
          tB: [shuffled[b + 2].id, shuffled[b + 3].id],
        });
      }

      const s = scoreRound(
        candidate,
        partnerCount,
        opponentCount,
        sitOutCount,
        sitOuts
      );
      if (s < bestScore) {
        bestScore = s;
        bestRound = candidate;
      }
    }

    // Commit the best round to history
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

    // Update sit-out tracking
    for (const pid of sitOuts) {
      sitOutCount.set(pid, (sitOutCount.get(pid) ?? 0) + 1);
    }
    lastSitOutIds = new Set(sitOuts);
  }

  return allMatches;
}