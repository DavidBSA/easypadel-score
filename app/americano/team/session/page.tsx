"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const STORAGE_KEY = "eps_team_session_active";

type Team = "A" | "B";
type TeamPair = { id: string; name: string; player1: string; player2: string };
type CourtMatch = { courtNumber: number; teamA: string; teamB: string; score: { pointsA: number; pointsB: number; firstServeTeam?: Team; isComplete: boolean } };
type TeamRound = { roundNumber: number; matches: CourtMatch[] };
type TeamSession = { code: string; createdAtISO: string; courts: number; teams: TeamPair[]; currentRound: number; rounds: TeamRound[]; pointsPerMatch: number };
type MatchSnapshot = { pointsA: number; pointsB: number; firstServeTeam?: Team; isComplete: boolean };
type LeaderRow = { teamId: string; name: string; player1: string; player2: string; played: number; wins: number; draws: number; losses: number; pointsFor: number; pointsAgainst: number; diff: number };

function safeParseJSON<T>(v: string | null, fb: T): T { try { if (!v) return fb; return JSON.parse(v) as T; } catch { return fb; } }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function addOpponentCount(map: Map<string, Map<string, number>>, a: string, b: string) {
  if (!map.has(a)) map.set(a, new Map()); if (!map.has(b)) map.set(b, new Map());
  map.get(a)!.set(b, (map.get(a)!.get(b) ?? 0) + 1); map.get(b)!.set(a, (map.get(b)!.get(a) ?? 0) + 1);
}

// Equal-distribution: remainder serves go to last players in order
// Order: P1(A)=pos0, P1(B)=pos1, P2(A)=pos2, P2(B)=pos3
function serveDistribution(pts: number): [number, number, number, number] {
  const base = Math.floor(pts / 4);
  const rem = pts % 4;
  return [
    base,
    base + (rem >= 3 ? 1 : 0),
    base + (rem >= 2 ? 1 : 0),
    base + (rem >= 1 ? 1 : 0),
  ] as [number, number, number, number];
}

function serveHintText(pts: number): { even: boolean; text: string } {
  const [a1, b1, a2, b2] = serveDistribution(pts);
  if (a1 === b1 && b1 === a2 && a2 === b2) {
    const rotations = Math.floor(a1 / 4);
    const extra = a1 % 4;
    const rotStr = rotations > 1 ? `${rotations} × 4 serves` : rotations === 1 && extra === 0 ? `1 × 4 serves` : `${a1} serves`;
    const label = rotations >= 2 && extra === 0 ? `${rotStr} each (${rotations} full rotations)` : `each player serves ${a1} pts`;
    return { even: true, text: `✓ Equal — ${label}` };
  }
  return { even: false, text: `P1(A): ${a1} pts · P1(B): ${b1} pts · P2(A): ${a2} pts · P2(B): ${b2} pts` };
}

// Cumulative threshold: find which player's bucket totalPlayed falls into
function computeCurrentServer(first: Team, totalPlayed: number, dist: [number, number, number, number]): { team: Team; slot: 0 | 1 } {
  const order: { team: Team; slot: 0 | 1 }[] = first === "A"
    ? [{ team: "A", slot: 0 }, { team: "B", slot: 0 }, { team: "A", slot: 1 }, { team: "B", slot: 1 }]
    : [{ team: "B", slot: 0 }, { team: "A", slot: 0 }, { team: "B", slot: 1 }, { team: "A", slot: 1 }];
  let cumulative = 0;
  for (let i = 0; i < 4; i++) {
    cumulative += dist[i];
    if (totalPlayed < cumulative) return order[i];
  }
  return order[3];
}

// ─── Round Generator ──────────────────────────────────────────────────────────
const OPPONENT_PENALTY = 3; const COURT_PENALTY = 1; const GENERATOR_ATTEMPTS = 200;

function buildNextRound(session: TeamSession): TeamSession {
  const { teams, courts, rounds } = session;
  const nextRoundNumber = Math.max(...rounds.map((r) => r.roundNumber), 0) + 1;
  const slotsNeeded = courts * 2;
  const opponentCount = new Map<string, Map<string, number>>();
  const courtPlayCount = new Map<string, Map<number, number>>();
  for (const t of teams) { opponentCount.set(t.id, new Map()); courtPlayCount.set(t.id, new Map()); }
  for (const r of rounds) {
    for (const m of r.matches) {
      addOpponentCount(opponentCount, m.teamA, m.teamB);
      for (const tid of [m.teamA, m.teamB]) { const c = courtPlayCount.get(tid)!; c.set(m.courtNumber, (c.get(m.courtNumber) ?? 0) + 1); }
    }
  }
  const activeTeams = teams.slice(0, slotsNeeded);
  function scoreMatches(matches: CourtMatch[]): number {
    let s = 0;
    for (const m of matches) {
      s += (opponentCount.get(m.teamA)?.get(m.teamB) ?? 0) * OPPONENT_PENALTY;
      for (const tid of [m.teamA, m.teamB]) s += (courtPlayCount.get(tid)?.get(m.courtNumber) ?? 0) * COURT_PENALTY;
    }
    return s;
  }
  let bestMatches: CourtMatch[] | null = null; let bestScore = Infinity;
  for (let attempt = 0; attempt < GENERATOR_ATTEMPTS; attempt++) {
    const shuffled = shuffle(activeTeams); const matches: CourtMatch[] = [];
    for (let c = 0; c < courts; c++) { const b = c * 2; matches.push({ courtNumber: c + 1, teamA: shuffled[b].id, teamB: shuffled[b + 1].id, score: { pointsA: 0, pointsB: 0, firstServeTeam: "A", isComplete: false } }); }
    const s = scoreMatches(matches); if (s < bestScore) { bestScore = s; bestMatches = matches; }
  }
  return { ...session, rounds: [...session.rounds, { roundNumber: nextRoundNumber, matches: bestMatches! }], currentRound: nextRoundNumber };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TeamSessionPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<TeamSession | null>(null);
  const [showServeHelper, setShowServeHelper] = useState(true);
  const [historyByKey, setHistoryByKey] = useState<Record<string, MatchSnapshot[]>>({});
  const [editingScore, setEditingScore] = useState<{ rn: number; cn: number; team: Team } | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    const s = safeParseJSON<TeamSession | null>(localStorage.getItem(STORAGE_KEY), null);
    if (s) {
      const migrated: TeamSession = { ...s, rounds: s.rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m, score: { ...m.score, firstServeTeam: m.score.firstServeTeam ?? "A" } })) })) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); setSession(migrated);
    } else { setSession(null); }
    setLoaded(true);
  }, []);

  const teamById = useMemo(() => { const map = new Map<string, TeamPair>(); (session?.teams ?? []).forEach((t) => map.set(t.id, t)); return map; }, [session]);
  const roundNumbers = useMemo(() => (session?.rounds ?? []).map((r) => r.roundNumber).sort((a, b) => a - b), [session]);
  const currentRound = useMemo(() => { if (!session) return null; return session.rounds.find((r) => r.roundNumber === session.currentRound) ?? session.rounds[0] ?? null; }, [session]);
  const currentRoundIndex = useMemo(() => { if (!session) return 0; const idx = roundNumbers.indexOf(session.currentRound); return idx >= 0 ? idx : 0; }, [roundNumbers, session]);
  const isLastRound = useMemo(() => currentRoundIndex >= roundNumbers.length - 1, [currentRoundIndex, roundNumbers]);
  const pointsPerMatch = useMemo(() => session?.pointsPerMatch ?? 21, [session]);
  const serveHint = useMemo(() => serveHintText(pointsPerMatch), [pointsPerMatch]);

  const allMatchesComplete = useMemo(() => currentRound?.matches.every((m) => m.score.isComplete) ?? false, [currentRound]);
  const completedMatchCount = useMemo(() => session?.rounds.flatMap((r) => r.matches).filter((m) => m.score.isComplete).length ?? 0, [session]);
  const totalMatchCount = useMemo(() => session?.rounds.reduce((acc, r) => acc + r.matches.length, 0) ?? 0, [session]);

  function persist(next: TeamSession) { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSession(next); }
  function matchKey(r: number, c: number) { return `${r}:${c}`; }
  function pushHistory(key: string, snap: MatchSnapshot) { setHistoryByKey((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), snap] })); }

  function updateMatchScore(rn: number, cn: number, updater: (s: CourtMatch["score"]) => CourtMatch["score"]) {
    if (!session) return;
    const round = session.rounds.find((r) => r.roundNumber === rn); const match = round?.matches.find((m) => m.courtNumber === cn); if (!round || !match) return;
    pushHistory(matchKey(rn, cn), { ...match.score });
    persist({ ...session, rounds: session.rounds.map((r) => r.roundNumber !== rn ? r : { ...r, matches: r.matches.map((m) => m.courtNumber !== cn ? m : { ...m, score: updater(m.score) }) }) });
  }
  function undoMatch(rn: number, cn: number) {
    if (!session) return; const key = matchKey(rn, cn); const stack = historyByKey[key] ?? []; if (!stack.length) return;
    const prev = stack[stack.length - 1]; setHistoryByKey((h) => ({ ...h, [key]: stack.slice(0, -1) }));
    persist({ ...session, rounds: session.rounds.map((r) => r.roundNumber !== rn ? r : { ...r, matches: r.matches.map((m) => m.courtNumber !== cn ? m : { ...m, score: { ...m.score, ...prev } }) }) });
  }
  function resetMatch(rn: number, cn: number) { updateMatchScore(rn, cn, (s) => ({ ...s, pointsA: 0, pointsB: 0, isComplete: false })); setHistoryByKey((h) => ({ ...h, [matchKey(rn, cn)]: [] })); }
  function toggleComplete(rn: number, cn: number) { updateMatchScore(rn, cn, (s) => ({ ...s, isComplete: !s.isComplete })); }
  function addPoint(rn: number, cn: number, team: Team) {
    updateMatchScore(rn, cn, (s) => {
      if (s.isComplete) return s;
      const nA = team === "A" ? s.pointsA + 1 : s.pointsA; const nB = team === "B" ? s.pointsB + 1 : s.pointsB;
      return { ...s, pointsA: nA, pointsB: nB, isComplete: nA + nB >= pointsPerMatch };
    });
  }
  function removePoint(rn: number, cn: number, team: Team) {
    updateMatchScore(rn, cn, (s) => {
      const nA = team === "A" ? clamp(s.pointsA - 1, 0, pointsPerMatch) : s.pointsA; const nB = team === "B" ? clamp(s.pointsB - 1, 0, pointsPerMatch) : s.pointsB;
      return { ...s, pointsA: nA, pointsB: nB, isComplete: nA + nB >= pointsPerMatch ? s.isComplete : false };
    });
  }
  function setFirstServe(rn: number, cn: number, team: Team) { updateMatchScore(rn, cn, (s) => ({ ...s, firstServeTeam: team })); }
  function randomFirstServeForMatch(rn: number, cn: number) { setFirstServe(rn, cn, Math.random() < 0.5 ? "A" : "B"); }
  function randomFirstServeForRound() {
    if (!session || !currentRound) return;
    persist({ ...session, rounds: session.rounds.map((r) => r.roundNumber !== currentRound.roundNumber ? r : { ...r, matches: r.matches.map((m) => ({ ...m, score: { ...m.score, firstServeTeam: (Math.random() < 0.5 ? "A" : "B") as Team } })) }) });
  }
  function goNextRound() { if (!session || !allMatchesComplete) return; if (isLastRound) persist(buildNextRound(session)); else persist({ ...session, currentRound: roundNumbers[currentRoundIndex + 1] }); }
  function goPrevRound() { if (!session || currentRoundIndex <= 0) return; persist({ ...session, currentRound: roundNumbers[currentRoundIndex - 1] }); }
  function startEditScore(rn: number, cn: number, team: Team, current: number) {
    if (!session) return;
    const round = session.rounds.find((r) => r.roundNumber === rn);
    const match = round?.matches.find((m) => m.courtNumber === cn);
    if (match?.score.isComplete) return;
    setEditingScore({ rn, cn, team }); setEditDraft(String(current));
  }
  function commitEditScore() {
    if (!editingScore || !session) return;
    const { rn, cn, team } = editingScore;
    const val = parseInt(editDraft, 10);
    if (!isNaN(val) && val >= 0) {
      updateMatchScore(rn, cn, (s) => {
        const nA = team === "A" ? clamp(val, 0, pointsPerMatch) : s.pointsA;
        const nB = team === "B" ? clamp(val, 0, pointsPerMatch) : s.pointsB;
        return { ...s, pointsA: nA, pointsB: nB, isComplete: nA + nB >= pointsPerMatch };
      });
    }
    setEditingScore(null); setEditDraft("");
  }

  const leaderboard = useMemo((): LeaderRow[] => {
    if (!session) return [];
    const base = new Map<string, LeaderRow>();
    for (const t of session.teams) base.set(t.id, { teamId: t.id, name: t.name, player1: t.player1, player2: t.player2, played: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 });
    for (const r of session.rounds) for (const m of r.matches) {
      if (!m.score.isComplete) continue;
      const aResult = m.score.pointsA > m.score.pointsB ? "win" : m.score.pointsA === m.score.pointsB ? "draw" : "loss";
      const bResult = m.score.pointsB > m.score.pointsA ? "win" : m.score.pointsA === m.score.pointsB ? "draw" : "loss";
      const ra = base.get(m.teamA); const rb = base.get(m.teamB);
      if (ra) { ra.played++; ra.pointsFor += m.score.pointsA; ra.pointsAgainst += m.score.pointsB; if (aResult === "win") ra.wins++; else if (aResult === "draw") ra.draws++; else ra.losses++; }
      if (rb) { rb.played++; rb.pointsFor += m.score.pointsB; rb.pointsAgainst += m.score.pointsA; if (bResult === "win") rb.wins++; else if (bResult === "draw") rb.draws++; else rb.losses++; }
    }
    return Array.from(base.values()).map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst })).sort((x, y) => y.diff !== x.diff ? y.diff - x.diff : y.pointsFor !== x.pointsFor ? y.pointsFor - x.pointsFor : x.name.localeCompare(y.name));
  }, [session]);

  const lbRowStyle = (top3: boolean): React.CSSProperties => ({ borderRadius: 14, padding: 12, background: top3 ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: top3 ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", display: "grid", gridTemplateColumns: "36px 1fr 90px 100px 64px", gap: 8, alignItems: "center" });

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 980, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.50)", marginTop: 12 },
    titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" as const },
    title: { fontSize: 22, fontWeight: 1000 },
    subtitle: { color: WARM_WHITE, opacity: 0.6, fontSize: 13, marginTop: 5, lineHeight: 1.3 },
    topControls: { display: "flex", gap: 10, flexWrap: "wrap" as const, alignItems: "center", justifyContent: "flex-end" },
    btn: { borderRadius: 14, padding: "12px 14px", fontSize: 15, fontWeight: 950, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnPrimary: { borderRadius: 14, padding: "12px 16px", fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, whiteSpace: "nowrap" as const },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 16, marginBottom: 8 },
    settingsRow: { marginTop: 12, borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 12, flexWrap: "wrap" as const, alignItems: "flex-start", justifyContent: "space-between" },
    chip: { borderRadius: 999, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: WHITE, fontWeight: 950, cursor: "pointer", userSelect: "none" as const, whiteSpace: "nowrap" as const, fontSize: 13 },
    serveHintEven: { borderRadius: 12, padding: "8px 14px", background: "rgba(0,200,100,0.08)", border: "1px solid rgba(0,200,100,0.28)", fontSize: 12, fontWeight: 900, color: WHITE, width: "100%" },
    serveHintOdd: { borderRadius: 12, padding: "8px 14px", background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.28)", fontSize: 12, fontWeight: 900, color: WHITE, width: "100%" },
    infoCard: { marginTop: 12, borderRadius: 14, padding: "12px 16px", background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.22)", display: "flex", gap: 20, flexWrap: "wrap" as const, alignItems: "center" },
    infoItem: { display: "grid", gap: 2 },
    infoLabel: { fontSize: 11, opacity: 0.6, fontWeight: 900, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    infoValue: { fontSize: 15, fontWeight: 1050 },
    warning: { marginTop: 10, borderRadius: 14, padding: 12, background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.24)", fontSize: 12, fontWeight: 900, lineHeight: 1.35, color: WHITE },
    grid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    tile: { borderRadius: 18, padding: 14, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 10 },
    tileHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" as const },
    courtTitle: { fontWeight: 1000, color: ORANGE, letterSpacing: 0.2 },
    statusPill: { borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 1000, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", whiteSpace: "nowrap" as const },
    teamBlock: { borderRadius: 10, padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" },
    teamName: { fontWeight: 1000, fontSize: 14, marginBottom: 2 },
    playerNames: { fontSize: 12, opacity: 0.65 },
    vsLabel: { fontWeight: 1000, fontSize: 13, opacity: 0.5, textAlign: "center" as const },
    serveHintInline: { fontSize: 12, fontWeight: 1000, color: ORANGE, lineHeight: 1.3 },
    pointsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    pointsBox: { borderRadius: 16, padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8 },
    boxTitle: { fontWeight: 1000, fontSize: 13, opacity: 0.85 },
    bigNums: { fontSize: 36, fontWeight: 1150, letterSpacing: 0.4, lineHeight: 1.05, color: WHITE, cursor: "pointer", userSelect: "none" as const },
    bigNumsInput: { fontSize: 36, fontWeight: 1150, width: "100%", background: "rgba(255,107,0,0.12)", color: WHITE, border: "1px solid rgba(255,107,0,0.55)", borderRadius: 10, padding: "2px 8px", outline: "none", boxSizing: "border-box" as const },
    controlsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    ctrlBtnPrimary: { borderRadius: 14, padding: "14px 10px", fontSize: 16, fontWeight: 1100, cursor: "pointer", border: "none", background: ORANGE, color: WHITE },
    ctrlBtn: { borderRadius: 14, padding: "14px 10px", fontSize: 16, fontWeight: 1100, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE },
    smallMeta: { fontSize: 12, opacity: 0.7, fontWeight: 850 },
    tinyRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
    tinyBtn: { borderRadius: 12, padding: "11px 8px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: WHITE },
    hint: { fontSize: 12, opacity: 0.55, lineHeight: 1.35, color: WARM_WHITE },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "12px 0" },
    leaderboardWrap: { marginTop: 14, borderRadius: 18, padding: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 10 },
    lbHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" as const },
    lbTitle: { fontWeight: 1000, fontSize: 15, color: ORANGE },
    lbMeta: { fontSize: 12, opacity: 0.6, fontWeight: 850 },
    lbHead: { display: "grid", gridTemplateColumns: "36px 1fr 90px 100px 64px", gap: 8, fontSize: 11, opacity: 0.5, fontWeight: 950, padding: "0 12px", textTransform: "uppercase" as const, letterSpacing: 0.5 },
    lbCellRight: { textAlign: "right" as const },
    lbRank: { fontSize: 16, fontWeight: 1100, color: WHITE, textAlign: "center" as const },
    lbName: { fontSize: 15, fontWeight: 1050 },
    lbSub: { fontSize: 11, opacity: 0.55, marginTop: 1 },
    lbNum: { fontSize: 14, fontWeight: 1050, textAlign: "right" as const },
  };

  if (!loaded) return <div style={styles.page}><div style={styles.card}><div style={{ opacity: 0.7, fontWeight: 900 }}>Loading…</div></div></div>;

  if (!session) return (
    <div style={styles.page}><div style={styles.card}>
      <div style={styles.titleRow}><div><div style={styles.title}>Team Americano</div><div style={styles.subtitle}>No active session.</div></div><button style={styles.btn} onClick={() => router.push("/americano/team")}>Back</button></div>
      <div style={styles.hint}>Create a session from the Team Americano screen.</div>
    </div></div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <div>
            <div style={styles.title}>Session {session.code}</div>
            <div style={styles.subtitle}>Round {session.currentRound} · {session.courts} court{session.courts > 1 ? "s" : ""} · {pointsPerMatch} pts</div>
          </div>
          <div style={styles.topControls}>
            <button style={styles.btn} onClick={() => router.push("/americano/team")}>Settings</button>
            <button style={{ ...styles.btn, opacity: currentRoundIndex <= 0 ? 0.4 : 1 }} onClick={goPrevRound} disabled={currentRoundIndex <= 0}>← Prev</button>
            <button style={{ ...styles.btnPrimary, opacity: allMatchesComplete ? 1 : 0.4 }} onClick={goNextRound} disabled={!allMatchesComplete}>{isLastRound ? "Generate next round" : "Next round →"}</button>
          </div>
        </div>

        <div style={styles.settingsRow}>
          <div><div style={{ fontWeight: 1000, fontSize: 14 }}>Serve distribution</div><div style={styles.hint}>For {pointsPerMatch} pts</div></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, justifyContent: "flex-end", alignItems: "center" }}>
            <div style={{ ...styles.chip, borderColor: showServeHelper ? "rgba(255,107,0,0.55)" : "rgba(255,255,255,0.14)", background: showServeHelper ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.06)" }} onClick={() => setShowServeHelper((v) => !v)}>Serve helper</div>
            <div style={styles.chip} onClick={randomFirstServeForRound}>Random first serve</div>
          </div>
          <div style={serveHint.even ? styles.serveHintEven : styles.serveHintOdd}>{serveHint.text}</div>
        </div>

        <div style={styles.infoCard}>
          <div style={styles.infoItem}><div style={styles.infoLabel}>Rounds</div><div style={styles.infoValue}>{roundNumbers.length}</div></div>
          <div style={styles.infoItem}><div style={styles.infoLabel}>Teams</div><div style={styles.infoValue}>{session.teams.length}</div></div>
          <div style={styles.infoItem}><div style={styles.infoLabel}>Courts</div><div style={styles.infoValue}>{session.courts}</div></div>
        </div>

        {!allMatchesComplete && <div style={styles.warning}>Complete all courts before generating the next round.</div>}

        <div style={styles.sectionLabel}>Round {session.currentRound}</div>

        {currentRound ? (
          <div style={styles.grid}>
            {currentRound.matches.map((m) => {
              const tA = teamById.get(m.teamA); const tB = teamById.get(m.teamB);
              if (!tA || !tB) return null;
              const key = matchKey(currentRound.roundNumber, m.courtNumber);
              const canUndo = (historyByKey[key]?.length ?? 0) > 0;
              const totalPlayed = m.score.pointsA + m.score.pointsB;
              const firstServe = m.score.firstServeTeam ?? "A";
              const dist = serveDistribution(pointsPerMatch);
              const server = computeCurrentServer(firstServe, totalPlayed, dist);
              const serverTeam = server.team === "A" ? tA : tB;
              const servingPlayerName = server.slot === 0 ? serverTeam.player1 : serverTeam.player2;
              const firstServeTeamObj = firstServe === "A" ? tA : tB;

              return (
                <div key={m.courtNumber} style={{ ...styles.tile, borderColor: m.score.isComplete ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.08)" }}>
                  <div style={styles.tileHeader}>
                    <div style={styles.courtTitle}>Court {m.courtNumber}</div>
                    <div style={{ ...styles.statusPill, borderColor: m.score.isComplete ? "rgba(255,107,0,0.45)" : "rgba(255,255,255,0.12)", color: m.score.isComplete ? ORANGE : WHITE }}>{m.score.isComplete ? "Complete" : "In play"}</div>
                  </div>

                  <div style={styles.teamBlock}><div style={styles.teamName}>{tA.name}</div><div style={styles.playerNames}>{tA.player1} &amp; {tA.player2}</div></div>
                  <div style={styles.vsLabel}>vs</div>
                  <div style={styles.teamBlock}><div style={styles.teamName}>{tB.name}</div><div style={styles.playerNames}>{tB.player1} &amp; {tB.player2}</div></div>

                  {showServeHelper && (
                    <div style={styles.serveHintInline}>
                      Serving: {servingPlayerName} · First serve: {firstServeTeamObj.player1}
                    </div>
                  )}

                  <div style={styles.pointsRow}>
                    <div style={styles.pointsBox}>
                      <div style={styles.boxTitle}>{tA.name}</div>
                      {editingScore?.rn === currentRound.roundNumber && editingScore?.cn === m.courtNumber && editingScore?.team === "A" ? (
                        <input style={styles.bigNumsInput} type="number" inputMode="numeric" value={editDraft} autoFocus
                          onChange={(e) => setEditDraft(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={commitEditScore}
                          onKeyDown={(e) => { if (e.key === "Enter") commitEditScore(); if (e.key === "Escape") { setEditingScore(null); setEditDraft(""); } }} />
                      ) : (
                        <div style={{ ...styles.bigNums, opacity: m.score.isComplete ? 0.6 : 1 }} onClick={() => startEditScore(currentRound.roundNumber, m.courtNumber, "A", m.score.pointsA)} title="Tap to edit">{m.score.pointsA}</div>
                      )}
                      <div style={styles.controlsRow}>
                        <button style={{ ...styles.ctrlBtnPrimary, opacity: m.score.isComplete ? 0.4 : 1 }} onClick={() => addPoint(currentRound.roundNumber, m.courtNumber, "A")} disabled={m.score.isComplete}>+1</button>
                        <button style={{ ...styles.ctrlBtn, opacity: m.score.isComplete ? 0.4 : 1 }} onClick={() => removePoint(currentRound.roundNumber, m.courtNumber, "A")} disabled={m.score.isComplete}>−1</button>
                      </div>
                    </div>
                    <div style={styles.pointsBox}>
                      <div style={styles.boxTitle}>{tB.name}</div>
                      {editingScore?.rn === currentRound.roundNumber && editingScore?.cn === m.courtNumber && editingScore?.team === "B" ? (
                        <input style={styles.bigNumsInput} type="number" inputMode="numeric" value={editDraft} autoFocus
                          onChange={(e) => setEditDraft(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={commitEditScore}
                          onKeyDown={(e) => { if (e.key === "Enter") commitEditScore(); if (e.key === "Escape") { setEditingScore(null); setEditDraft(""); } }} />
                      ) : (
                        <div style={{ ...styles.bigNums, opacity: m.score.isComplete ? 0.6 : 1 }} onClick={() => startEditScore(currentRound.roundNumber, m.courtNumber, "B", m.score.pointsB)} title="Tap to edit">{m.score.pointsB}</div>
                      )}
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
                    <button style={{ ...styles.tinyBtn, fontSize: 12 }} onClick={() => setFirstServe(currentRound.roundNumber, m.courtNumber, "A")}>🪙 {tA.name} won</button>
                    <button style={{ ...styles.tinyBtn, fontSize: 12 }} onClick={() => setFirstServe(currentRound.roundNumber, m.courtNumber, "B")}>🪙 {tB.name} won</button>
                    <button style={styles.tinyBtn} onClick={() => randomFirstServeForMatch(currentRound.roundNumber, m.courtNumber)}>Random</button>
                  </div>

                  <div style={styles.hint}>Serve order: {tA.player1} → {tB.player1} → {tA.player2} → {tB.player2} · {dist[0]}:{dist[1]}:{dist[2]}:{dist[3]} pts</div>
                </div>
              );
            })}
          </div>
        ) : <div style={styles.hint}>No round data.</div>}

        <div style={styles.divider} />

        <div style={styles.leaderboardWrap}>
          <div style={styles.lbHeaderRow}><div style={styles.lbTitle}>Leaderboard</div><div style={styles.lbMeta}>{completedMatchCount} of {totalMatchCount} matches completed</div></div>
          <div style={styles.lbHead}><div style={{ textAlign: "center" as const }}>#</div><div>Team</div><div style={styles.lbCellRight}>W / D / L</div><div style={styles.lbCellRight}>Points</div><div style={styles.lbCellRight}>Diff</div></div>
          <div style={{ display: "grid", gap: 8 }}>
            {leaderboard.map((r, idx) => (
              <div key={r.teamId} style={lbRowStyle(idx < 3)}>
                <div style={styles.lbRank}>{idx + 1}</div>
                <div><div style={styles.lbName}>{r.name}</div><div style={styles.lbSub}>{r.player1} &amp; {r.player2}</div></div>
                <div style={styles.lbNum}><span style={{ color: "#4ade80" }}>{r.wins}</span><span style={{ opacity: 0.4 }}> / </span><span style={{ opacity: 0.7 }}>{r.draws}</span><span style={{ opacity: 0.4 }}> / </span><span style={{ color: "#f87171" }}>{r.losses}</span></div>
                <div style={styles.lbNum}>{r.pointsFor} – {r.pointsAgainst}</div>
                <div style={{ ...styles.lbNum, color: r.diff > 0 ? "#4ade80" : r.diff < 0 ? "#f87171" : WHITE }}>{r.diff > 0 ? `+${r.diff}` : r.diff}</div>
              </div>
            ))}
          </div>
          <div style={styles.hint}>Ranked by point difference, then points for. Completed matches only.</div>
        </div>
      </div>
    </div>
  );
}
