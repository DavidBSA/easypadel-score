"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const STORAGE_SESSION_KEY = "eps_session_active";

type Team = "A" | "B";
type SessionPlayer = { id: string; name: string };

type CourtMatch = {
  courtNumber: number;
  teamA: [string, string];
  teamB: [string, string];
  score: {
    setsA: number;
    setsB: number;
    gamesA: number;
    gamesB: number;
    pointsA?: number;
    pointsB?: number;
    firstServeTeam?: Team;
    isComplete: boolean;
  };
};

type Round = { roundNumber: number; matches: CourtMatch[] };

type AmericanoSession = {
  code: string;
  createdAtISO: string;
  courts: number;
  players: SessionPlayer[];
  currentRound: number;
  rounds: Round[];
  pointsPerMatch?: number;
};

type Score = CourtMatch["score"];

type MatchSnapshot = {
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  pointsA?: number;
  pointsB?: number;
  firstServeTeam?: Team;
  isComplete: boolean;
};

type LeaderRow = {
  playerId: string;
  name: string;
  played: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJSON<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function shallowSnapshot(s: Score): MatchSnapshot {
  return {
    setsA: s.setsA, setsB: s.setsB,
    gamesA: s.gamesA, gamesB: s.gamesB,
    pointsA: s.pointsA, pointsB: s.pointsB,
    firstServeTeam: s.firstServeTeam,
    isComplete: s.isComplete,
  };
}

function otherTeam(t: Team): Team { return t === "A" ? "B" : "A"; }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function addPairCount(map: Map<string, Map<string, number>>, a: string, b: string) {
  if (!map.has(a)) map.set(a, new Map());
  if (!map.has(b)) map.set(b, new Map());
  map.get(a)!.set(b, (map.get(a)!.get(b) ?? 0) + 1);
  map.get(b)!.set(a, (map.get(b)!.get(a) ?? 0) + 1);
}

function computeServingTeam(first: Team, totalPlayed: number, pointsPerMatch: number): Team {
  const remainder = pointsPerMatch % 4;
  const firstTurn = remainder === 0 ? 4 : 4 + remainder;
  if (totalPlayed < firstTurn) return first;
  const turnIndexAfterFirst = Math.floor((totalPlayed - firstTurn) / 4) + 1;
  return turnIndexAfterFirst % 2 === 0 ? first : otherTeam(first);
}

// ─── Round Generator ──────────────────────────────────────────────────────────

const PARTNER_PENALTY = 3;
const OPPONENT_PENALTY = 1;
const GENERATOR_ATTEMPTS = 200;

function buildNextRound(session: AmericanoSession): AmericanoSession {
  const { players, courts, rounds } = session;
  const nextRoundNumber = Math.max(...rounds.map((r) => r.roundNumber), 0) + 1;
  const slotsNeeded = courts * 4;

  const partnerCount = new Map<string, Map<string, number>>();
  const opponentCount = new Map<string, Map<string, number>>();
  const sitOutCount = new Map<string, number>();
  for (const p of players) {
    partnerCount.set(p.id, new Map());
    opponentCount.set(p.id, new Map());
    sitOutCount.set(p.id, 0);
  }

  let lastRoundSitOutIds = new Set<string>();
  for (const r of rounds) {
    const activeIds = new Set<string>();
    for (const m of r.matches) {
      for (const pid of [m.teamA[0], m.teamA[1], m.teamB[0], m.teamB[1]]) activeIds.add(pid);
      addPairCount(partnerCount, m.teamA[0], m.teamA[1]);
      addPairCount(partnerCount, m.teamB[0], m.teamB[1]);
      for (const a of m.teamA) for (const b of m.teamB) addPairCount(opponentCount, a, b);
    }
    const roundSitOuts = new Set<string>();
    for (const p of players) {
      if (!activeIds.has(p.id)) {
        roundSitOuts.add(p.id);
        sitOutCount.set(p.id, (sitOutCount.get(p.id) ?? 0) + 1);
      }
    }
    lastRoundSitOutIds = roundSitOuts;
  }

  const sitOutsNeeded = players.length - slotsNeeded;
  let activePlayers: SessionPlayer[];
  if (sitOutsNeeded <= 0) {
    activePlayers = [...players];
  } else {
    const eligible = players.filter((p) => !lastRoundSitOutIds.has(p.id));
    const sorted = [...eligible].sort((a, b) => (sitOutCount.get(a.id) ?? 0) - (sitOutCount.get(b.id) ?? 0));
    const sittingOutIds = new Set(sorted.slice(0, sitOutsNeeded).map((p) => p.id));
    activePlayers = players.filter((p) => !sittingOutIds.has(p.id));
  }

  function scoreMatches(matches: CourtMatch[]): number {
    let score = 0;
    for (const m of matches) {
      score += (partnerCount.get(m.teamA[0])?.get(m.teamA[1]) ?? 0) * PARTNER_PENALTY;
      score += (partnerCount.get(m.teamB[0])?.get(m.teamB[1]) ?? 0) * PARTNER_PENALTY;
      for (const a of m.teamA) for (const b of m.teamB) score += (opponentCount.get(a)?.get(b) ?? 0) * OPPONENT_PENALTY;
    }
    return score;
  }

  let bestMatches: CourtMatch[] | null = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < GENERATOR_ATTEMPTS; attempt++) {
    const shuffled = shuffle(activePlayers);
    const matches: CourtMatch[] = [];
    for (let c = 0; c < courts; c++) {
      const base = c * 4;
      matches.push({
        courtNumber: c + 1,
        teamA: [shuffled[base].id, shuffled[base + 1].id],
        teamB: [shuffled[base + 2].id, shuffled[base + 3].id],
        score: { setsA: 0, setsB: 0, gamesA: 0, gamesB: 0, pointsA: 0, pointsB: 0, firstServeTeam: "A", isComplete: false },
      });
    }
    const s = scoreMatches(matches);
    if (s < bestScore) { bestScore = s; bestMatches = matches; }
  }

  return {
    ...session,
    rounds: [...session.rounds, { roundNumber: nextRoundNumber, matches: bestMatches! }],
    currentRound: nextRoundNumber,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AmericanoSessionPage() {
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<AmericanoSession | null>(null);
  const [showServeHelper, setShowServeHelper] = useState(true);
  const [historyByKey, setHistoryByKey] = useState<Record<string, MatchSnapshot[]>>({});

  useEffect(() => {
    const s = safeParseJSON<AmericanoSession | null>(localStorage.getItem(STORAGE_SESSION_KEY), null);
    if (s) {
      const migrated: AmericanoSession = {
        ...s,
        pointsPerMatch: typeof s.pointsPerMatch === "number" ? s.pointsPerMatch : 21,
        rounds: s.rounds.map((r) => ({
          ...r,
          matches: r.matches.map((m) => ({
            ...m,
            score: {
              ...m.score,
              pointsA: typeof m.score.pointsA === "number" ? m.score.pointsA : 0,
              pointsB: typeof m.score.pointsB === "number" ? m.score.pointsB : 0,
              firstServeTeam: m.score.firstServeTeam ?? "A",
            },
          })),
        })),
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(migrated));
      setSession(migrated);
    } else {
      setSession(null);
    }
    setLoaded(true);
  }, []);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    (session?.players ?? []).forEach((p) => map.set(p.id, p.name));
    return map;
  }, [session]);

  const roundNumbers = useMemo(
    () => (session?.rounds ?? []).map((r) => r.roundNumber).sort((a, b) => a - b),
    [session]
  );

  const currentRound = useMemo(() => {
    if (!session) return null;
    return session.rounds.find((r) => r.roundNumber === session.currentRound) ?? session.rounds[0] ?? null;
  }, [session]);

  const currentRoundIndex = useMemo(() => {
    if (!session) return 0;
    const idx = roundNumbers.indexOf(session.currentRound);
    return idx >= 0 ? idx : 0;
  }, [roundNumbers, session]);

  const isLastRound = useMemo(() => currentRoundIndex >= roundNumbers.length - 1, [currentRoundIndex, roundNumbers]);
  const pointsPerMatch = useMemo(() => session?.pointsPerMatch ?? 21, [session]);

  const allMatchesComplete = useMemo(() => {
    if (!currentRound) return false;
    return currentRound.matches.every((m) => m.score.isComplete);
  }, [currentRound]);

  const currentRoundSitOuts = useMemo(() => {
    if (!session || !currentRound) return [];
    const activeIds = new Set<string>();
    for (const m of currentRound.matches)
      for (const pid of [m.teamA[0], m.teamA[1], m.teamB[0], m.teamB[1]]) activeIds.add(pid);
    return session.players.filter((p) => !activeIds.has(p.id));
  }, [session, currentRound]);

  function persist(next: AmericanoSession) {
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }

  function matchKey(roundNumber: number, courtNumber: number) { return `${roundNumber}:${courtNumber}`; }

  function pushHistory(key: string, snap: MatchSnapshot) {
    setHistoryByKey((prev: Record<string, MatchSnapshot[]>) => ({ ...prev, [key]: [...(prev[key] ?? []), snap] }));
  }

  function updateMatchScore(roundNumber: number, courtNumber: number, updater: (score: Score) => Score) {
    if (!session) return;
    const round = session.rounds.find((r) => r.roundNumber === roundNumber);
    const match = round?.matches.find((m) => m.courtNumber === courtNumber);
    if (!round || !match) return;
    pushHistory(matchKey(roundNumber, courtNumber), shallowSnapshot(match.score));
    persist({
      ...session,
      rounds: session.rounds.map((r) => r.roundNumber !== roundNumber ? r : {
        ...r,
        matches: r.matches.map((m) => m.courtNumber !== courtNumber ? m : { ...m, score: updater(m.score) }),
      }),
    });
  }

  function undoMatch(roundNumber: number, courtNumber: number) {
    if (!session) return;
    const key = matchKey(roundNumber, courtNumber);
    const stack = historyByKey[key] ?? [];
    if (stack.length === 0) return;
    const prevSnap = stack[stack.length - 1];
    setHistoryByKey((prev: Record<string, MatchSnapshot[]>) => ({ ...prev, [key]: stack.slice(0, -1) }));
    persist({
      ...session,
      rounds: session.rounds.map((r) => r.roundNumber !== roundNumber ? r : {
        ...r,
        matches: r.matches.map((m) => m.courtNumber !== courtNumber ? m : { ...m, score: { ...m.score, ...prevSnap } }),
      }),
    });
  }

  function resetMatch(roundNumber: number, courtNumber: number) {
    updateMatchScore(roundNumber, courtNumber, (s) => ({ ...s, pointsA: 0, pointsB: 0, isComplete: false }));
    setHistoryByKey((prev: Record<string, MatchSnapshot[]>) => ({ ...prev, [matchKey(roundNumber, courtNumber)]: [] }));
  }

  function toggleComplete(roundNumber: number, courtNumber: number) {
    updateMatchScore(roundNumber, courtNumber, (s) => ({ ...s, isComplete: !s.isComplete }));
  }

  function addPoint(roundNumber: number, courtNumber: number, team: Team) {
    updateMatchScore(roundNumber, courtNumber, (s) => {
      if (s.isComplete) return s;
      const a = typeof s.pointsA === "number" ? s.pointsA : 0;
      const b = typeof s.pointsB === "number" ? s.pointsB : 0;
      const nextA = team === "A" ? a + 1 : a;
      const nextB = team === "B" ? b + 1 : b;
      return { ...s, pointsA: nextA, pointsB: nextB, isComplete: nextA + nextB >= pointsPerMatch };
    });
  }

  function removePoint(roundNumber: number, courtNumber: number, team: Team) {
    updateMatchScore(roundNumber, courtNumber, (s) => {
      const a = typeof s.pointsA === "number" ? s.pointsA : 0;
      const b = typeof s.pointsB === "number" ? s.pointsB : 0;
      const nextA = team === "A" ? clamp(a - 1, 0, pointsPerMatch) : a;
      const nextB = team === "B" ? clamp(b - 1, 0, pointsPerMatch) : b;
      return { ...s, pointsA: nextA, pointsB: nextB, isComplete: nextA + nextB >= pointsPerMatch ? s.isComplete : false };
    });
  }

  function setFirstServe(roundNumber: number, courtNumber: number, team: Team) {
    updateMatchScore(roundNumber, courtNumber, (s) => ({ ...s, firstServeTeam: team }));
  }

  function randomFirstServeForMatch(roundNumber: number, courtNumber: number) {
    setFirstServe(roundNumber, courtNumber, Math.random() < 0.5 ? "A" : "B");
  }

  function randomFirstServeForRound() {
    if (!session || !currentRound) return;
    persist({
      ...session,
      rounds: session.rounds.map((r) => r.roundNumber !== currentRound.roundNumber ? r : {
        ...r,
        matches: r.matches.map((m) => ({ ...m, score: { ...m.score, firstServeTeam: (Math.random() < 0.5 ? "A" : "B") as Team } })),
      }),
    });
  }

  function setPointsPerMatch(nextPoints: number) {
    if (!session) return;
    persist({ ...session, pointsPerMatch: clamp(Math.round(nextPoints), 8, 99) });
  }

  function goNextRound() {
    if (!session || !allMatchesComplete) return;
    if (isLastRound) persist(buildNextRound(session));
    else persist({ ...session, currentRound: roundNumbers[currentRoundIndex + 1] });
  }

  function goPrevRound() {
    if (!session || currentRoundIndex <= 0) return;
    persist({ ...session, currentRound: roundNumbers[currentRoundIndex - 1] });
  }

  // ─── Leaderboard ──────────────────────────────────────────────────────────

  const leaderboard = useMemo((): LeaderRow[] => {
    if (!session) return [];
    const base = new Map<string, LeaderRow>();
    for (const p of session.players) base.set(p.id, { playerId: p.id, name: p.name, played: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 });
    for (const r of session.rounds) {
      for (const m of r.matches) {
        if (!m.score.isComplete) continue;
        const aPts = typeof m.score.pointsA === "number" ? m.score.pointsA : 0;
        const bPts = typeof m.score.pointsB === "number" ? m.score.pointsB : 0;
        for (const pid of m.teamA) { const row = base.get(pid); if (row) { row.played++; row.pointsFor += aPts; row.pointsAgainst += bPts; } }
        for (const pid of m.teamB) { const row = base.get(pid); if (row) { row.played++; row.pointsFor += bPts; row.pointsAgainst += aPts; } }
      }
    }
    return Array.from(base.values())
      .map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst }))
      .sort((x, y) => y.diff !== x.diff ? y.diff - x.diff : y.pointsFor !== x.pointsFor ? y.pointsFor - x.pointsFor : x.name.localeCompare(y.name));
  }, [session]);

  const completedMatchCount = useMemo(() => session?.rounds.flatMap((r) => r.matches).filter((m) => m.score.isComplete).length ?? 0, [session]);
  const totalMatchCount = useMemo(() => session?.rounds.reduce((acc, r) => acc + r.matches.length, 0) ?? 0, [session]);

  // ─── Styles ───────────────────────────────────────────────────────────────

  const lbRowStyle = (isTop3: boolean): React.CSSProperties => ({
    borderRadius: 14,
    padding: 12,
    background: isTop3 ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
    border: isTop3 ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gridTemplateColumns: "44px 1fr 80px 110px 80px",
    gap: 10,
    alignItems: "center",
  });

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 980, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.50)", marginTop: 12 },
    titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    title: { fontSize: 22, fontWeight: 1000 },
    subtitle: { color: WARM_WHITE, opacity: 0.6, fontSize: 13, marginTop: 5, lineHeight: 1.3 },
    topControls: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" },
    btn: { borderRadius: 14, padding: "12px 14px", fontSize: 15, fontWeight: 950, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" },
    btnPrimary: { borderRadius: 14, padding: "12px 16px", fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, whiteSpace: "nowrap" },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 16, marginBottom: 8 },
    settingsRow: { marginTop: 12, borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" },
    input: { width: 100, background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "12px", fontSize: 16, outline: "none", fontWeight: 900, textAlign: "center" },
    chip: { borderRadius: 999, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: WHITE, fontWeight: 950, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", fontSize: 13 },
    infoCard: { marginTop: 12, borderRadius: 14, padding: "12px 16px", background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.22)", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" },
    infoItem: { display: "grid", gap: 2 },
    infoLabel: { fontSize: 11, opacity: 0.6, fontWeight: 900, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    infoValue: { fontSize: 15, fontWeight: 1050 },
    warning: { marginTop: 10, borderRadius: 14, padding: 12, background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.24)", fontSize: 12, fontWeight: 900, lineHeight: 1.35, color: WHITE },
    grid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    tile: { borderRadius: 18, padding: 14, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 10 },
    tileHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    courtTitle: { fontWeight: 1000, color: ORANGE, letterSpacing: 0.2 },
    statusPill: { borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 1000, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", whiteSpace: "nowrap" },
    teamLine: { fontWeight: 900, opacity: 0.88, lineHeight: 1.35, fontSize: 14 },
    serveHint: { fontSize: 12, fontWeight: 1000, color: ORANGE, lineHeight: 1.3 },
    pointsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    pointsBox: { borderRadius: 16, padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8 },
    boxTitle: { fontWeight: 1000, fontSize: 13, opacity: 0.85 },
    bigNums: { fontSize: 36, fontWeight: 1150, letterSpacing: 0.4, lineHeight: 1.05, color: WHITE },
    controlsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    ctrlBtnPrimary: { borderRadius: 14, padding: "14px 10px", fontSize: 16, fontWeight: 1100, cursor: "pointer", border: "none", background: ORANGE, color: WHITE },
    ctrlBtn: { borderRadius: 14, padding: "14px 10px", fontSize: 16, fontWeight: 1100, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE },
    smallMeta: { fontSize: 12, opacity: 0.7, fontWeight: 850 },
    tinyRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
    tinyBtn: { borderRadius: 12, padding: "11px 8px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: WHITE },
    hint: { fontSize: 12, opacity: 0.55, lineHeight: 1.35, color: WARM_WHITE },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "12px 0" },
    leaderboardWrap: { marginTop: 14, borderRadius: 18, padding: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 10 },
    lbHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" },
    lbTitle: { fontWeight: 1000, fontSize: 15, color: ORANGE },
    lbMeta: { fontSize: 12, opacity: 0.6, fontWeight: 850 },
    lbHead: { display: "grid", gridTemplateColumns: "44px 1fr 80px 110px 80px", gap: 10, fontSize: 11, opacity: 0.5, fontWeight: 950, padding: "0 12px", textTransform: "uppercase" as const, letterSpacing: 0.5 },
    lbCellRight: { textAlign: "right" },
    lbRank: { fontSize: 16, fontWeight: 1100, color: WHITE, textAlign: "center" },
    lbName: { fontSize: 15, fontWeight: 1050 },
    lbNum: { fontSize: 14, fontWeight: 1050, textAlign: "right" },
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!loaded) {
    return <div style={styles.page}><div style={styles.card}><div style={{ opacity: 0.7, fontWeight: 900 }}>Loading…</div></div></div>;
  }

  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.titleRow}>
            <div>
              <div style={styles.title}>Americano Session</div>
              <div style={styles.subtitle}>No active session found on this device.</div>
            </div>
            <button style={styles.btn} onClick={() => router.push("/americano")}>Back</button>
          </div>
          <div style={styles.hint} >Create a session from the Americano screen.</div>
        </div>
      </div>
    );
  }

  const sitOutNames = currentRoundSitOuts.map((p) => p.name);
  const nextRoundLabel = isLastRound ? "Generate next round" : "Next round →";

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* ── Header ── */}
        <div style={styles.titleRow}>
          <div>
            <div style={styles.title}>Session {session.code}</div>
            <div style={styles.subtitle}>
              Round {session.currentRound} · {session.courts} court{session.courts > 1 ? "s" : ""} · {pointsPerMatch} pts
            </div>
          </div>
          <div style={styles.topControls}>
            <button style={styles.btn} onClick={() => router.push("/americano")}>Settings</button>
            <button style={{ ...styles.btn, opacity: currentRoundIndex <= 0 ? 0.4 : 1 }} onClick={goPrevRound} disabled={currentRoundIndex <= 0}>← Prev</button>
            <button style={{ ...styles.btnPrimary, opacity: allMatchesComplete ? 1 : 0.4 }} onClick={goNextRound} disabled={!allMatchesComplete}>{nextRoundLabel}</button>
          </div>
        </div>

        {/* ── Settings row ── */}
        <div style={styles.settingsRow}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 14 }}>Points per match</div>
            <div style={styles.hint}>Total points shared by both teams. e.g. 16, 21, 32</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              style={styles.input}
              value={String(pointsPerMatch)}
              inputMode="numeric"
              onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); if (Number.isFinite(n)) setPointsPerMatch(n); }}
              aria-label="Points per match"
            />
            <div
              style={{ ...styles.chip, borderColor: showServeHelper ? "rgba(255,107,0,0.55)" : "rgba(255,255,255,0.14)", background: showServeHelper ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.06)" }}
              onClick={() => setShowServeHelper((v) => !v)}
            >
              Serve helper
            </div>
            <div style={styles.chip} onClick={randomFirstServeForRound}>Random first serve</div>
          </div>
        </div>

        {/* ── Session info card ── */}
        <div style={styles.infoCard}>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Rounds</div>
            <div style={styles.infoValue}>{roundNumbers.length}</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Players</div>
            <div style={styles.infoValue}>{session.players.length}</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Courts</div>
            <div style={styles.infoValue}>{session.courts}</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Sitting out</div>
            <div style={styles.infoValue}>{sitOutNames.length === 0 ? "None" : sitOutNames.join(", ")}</div>
          </div>
        </div>

        {/* ── Warning ── */}
        {!allMatchesComplete && (
          <div style={styles.warning}>
            Complete all courts before generating the next round. Mark each court complete once the score is final.
          </div>
        )}

        <div style={styles.sectionLabel}>Round {session.currentRound}</div>

        {/* ── Court tiles ── */}
        {currentRound ? (
          <div style={styles.grid}>
            {currentRound.matches.map((m) => {
              const a1 = nameById.get(m.teamA[0]) ?? "A1";
              const a2 = nameById.get(m.teamA[1]) ?? "A2";
              const b1 = nameById.get(m.teamB[0]) ?? "B1";
              const b2 = nameById.get(m.teamB[1]) ?? "B2";
              const key = matchKey(currentRound.roundNumber, m.courtNumber);
              const canUndo = (historyByKey[key]?.length ?? 0) > 0;
              const pA = typeof m.score.pointsA === "number" ? m.score.pointsA : 0;
              const pB = typeof m.score.pointsB === "number" ? m.score.pointsB : 0;
              const totalPlayed = pA + pB;
              const firstServe = m.score.firstServeTeam ?? "A";
              const servingTeam = computeServingTeam(firstServe, totalPlayed, pointsPerMatch);

              return (
                <div key={m.courtNumber} style={{ ...styles.tile, borderColor: m.score.isComplete ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.08)" }}>
                  <div style={styles.tileHeader}>
                    <div style={styles.courtTitle}>Court {m.courtNumber}</div>
                    <div style={{ ...styles.statusPill, borderColor: m.score.isComplete ? "rgba(255,107,0,0.45)" : "rgba(255,255,255,0.12)", color: m.score.isComplete ? ORANGE : WHITE }}>
                      {m.score.isComplete ? "Complete" : "In play"}
                    </div>
                  </div>

                  <div style={styles.teamLine}>Team A: {a1}, {a2}</div>
                  <div style={styles.teamLine}>Team B: {b1}, {b2}</div>

                  {showServeHelper && (
                    <div style={styles.serveHint}>
                      Serving: Team {servingTeam} · First serve: Team {firstServe}
                    </div>
                  )}

                  <div style={styles.pointsRow}>
                    <div style={styles.pointsBox}>
                      <div style={styles.boxTitle}>Team A</div>
                      <div style={styles.bigNums}>{pA}</div>
                      <div style={styles.controlsRow}>
                        <button style={{ ...styles.ctrlBtnPrimary, opacity: m.score.isComplete ? 0.4 : 1 }} onClick={() => addPoint(currentRound.roundNumber, m.courtNumber, "A")} disabled={m.score.isComplete}>+1</button>
                        <button style={{ ...styles.ctrlBtn, opacity: m.score.isComplete ? 0.4 : 1 }} onClick={() => removePoint(currentRound.roundNumber, m.courtNumber, "A")} disabled={m.score.isComplete}>−1</button>
                      </div>
                    </div>
                    <div style={styles.pointsBox}>
                      <div style={styles.boxTitle}>Team B</div>
                      <div style={styles.bigNums}>{pB}</div>
                      <div style={styles.controlsRow}>
                        <button style={{ ...styles.ctrlBtnPrimary, opacity: m.score.isComplete ? 0.4 : 1 }} onClick={() => addPoint(currentRound.roundNumber, m.courtNumber, "B")} disabled={m.score.isComplete}>+1</button>
                        <button style={{ ...styles.ctrlBtn, opacity: m.score.isComplete ? 0.4 : 1 }} onClick={() => removePoint(currentRound.roundNumber, m.courtNumber, "B")} disabled={m.score.isComplete}>−1</button>
                      </div>
                    </div>
                  </div>

                  <div style={styles.smallMeta}>{totalPlayed} of {pointsPerMatch} points played</div>

                  <div style={styles.tinyRow}>
                    <button style={styles.tinyBtn} onClick={() => toggleComplete(currentRound.roundNumber, m.courtNumber)}>{m.score.isComplete ? "Reopen" : "Mark complete"}</button>
                    <button style={{ ...styles.tinyBtn, opacity: canUndo ? 1 : 0.4 }} onClick={() => undoMatch(currentRound.roundNumber, m.courtNumber)} disabled={!canUndo}>Undo</button>
                    <button style={styles.tinyBtn} onClick={() => resetMatch(currentRound.roundNumber, m.courtNumber)}>Reset</button>
                  </div>

                  <div style={styles.tinyRow}>
                    <button style={styles.tinyBtn} onClick={() => setFirstServe(currentRound.roundNumber, m.courtNumber, "A")}>Serve A</button>
                    <button style={styles.tinyBtn} onClick={() => setFirstServe(currentRound.roundNumber, m.courtNumber, "B")}>Serve B</button>
                    <button style={styles.tinyBtn} onClick={() => randomFirstServeForMatch(currentRound.roundNumber, m.courtNumber)}>Random</button>
                  </div>

                  <div style={styles.hint}>Serve rotates every 4 points. Only completed matches count toward leaderboard.</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.hint}>No round data.</div>
        )}

        <div style={styles.divider} />

        {/* ── Leaderboard ── */}
        <div style={styles.leaderboardWrap}>
          <div style={styles.lbHeaderRow}>
            <div style={styles.lbTitle}>Leaderboard</div>
            <div style={styles.lbMeta}>{completedMatchCount} of {totalMatchCount} matches completed</div>
          </div>
          <div style={styles.lbHead}>
            <div style={{ textAlign: "center" }}>Rank</div>
            <div>Player</div>
            <div style={styles.lbCellRight}>Played</div>
            <div style={styles.lbCellRight}>Points</div>
            <div style={styles.lbCellRight}>Diff</div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {leaderboard.map((r, idx) => (
              <div key={r.playerId} style={lbRowStyle(idx < 3)}>
                <div style={styles.lbRank}>{idx + 1}</div>
                <div style={styles.lbName}>{r.name}</div>
                <div style={styles.lbNum}>{r.played}</div>
                <div style={styles.lbNum}>{r.pointsFor} – {r.pointsAgainst}</div>
                <div style={styles.lbNum}>{r.diff > 0 ? `+${r.diff}` : r.diff}</div>
              </div>
            ))}
          </div>
          <div style={styles.hint}>Ranked by point difference, then points for. Completed matches only.</div>
        </div>

      </div>
    </div>
  );
}