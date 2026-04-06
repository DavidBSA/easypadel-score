"use client";

import React, { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { useParams, useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";
const GREEN = "#00C851";
const RED = "#FF4040";

type DeuceMode = "star" | "golden" | "traditional";
type MatchRules = { deuceMode: DeuceMode; tiebreak: boolean; superTiebreak: boolean };
type TennisPayload = { sets: number; rules: MatchRules };

// ── Tennis / set scoring helpers (shared with organiser) ──────────────────
function setsToWin(n: number) { return Math.ceil(n / 2); }
function isFinalSetSuperTBForScore(setIdx: number, tp: TennisPayload): boolean {
  return tp.rules.superTiebreak && tp.sets > 1 && setIdx === tp.sets - 1;
}
function detectSetWinner(gA: number, gB: number, tp: TennisPayload, setIdx: number): "A" | "B" | null {
  if (isFinalSetSuperTBForScore(setIdx, tp)) {
    if (gA >= 10 && gA - gB >= 2) return "A";
    if (gB >= 10 && gB - gA >= 2) return "B";
    return null;
  }
  if (gA === 7 && gB === 6) return "A";
  if (gB === 7 && gA === 6) return "B";
  if (gA >= 6 && gA - gB >= 2) return "A";
  if (gB >= 6 && gB - gA >= 2) return "B";
  return null;
}
function isGameScoreValid(gA: number, gB: number, tp: TennisPayload, setIdx: number): boolean {
  if (gA === 0 && gB === 0) return true;
  if (isFinalSetSuperTBForScore(setIdx, tp)) return gA <= 25 && gB <= 25;
  if (gA > 7 || gB > 7) return false;
  if (gA === 7 && gB !== 5 && gB !== 6) return false;
  if (gB === 7 && gA !== 5 && gA !== 6) return false;
  return true;
}
function getMaxGames(tp: TennisPayload, setIdx: number): number {
  return isFinalSetSuperTBForScore(setIdx, tp) ? 25 : 7;
}

type Player = { id: string; name: string; isActive: boolean };
type ScoreSubmission = { id: string; deviceId: string; pointsA: number; pointsB: number };
type Match = {
  id: string; queuePosition: number; courtNumber: number | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE";
  teamAPlayer1: string; teamAPlayer2: string; teamBPlayer1: string; teamBPlayer2: string;
  pointsA: number | null; pointsB: number | null;
  scoreStatus: "PENDING" | "CONFIRMED" | "CONFLICT" | null;
  scoreSubmissions: ScoreSubmission[];
};
type Session = {
  code: string; name?: string | null; format: "SINGLE" | "MIXED" | "TEAM"; status: string;
  courts: number; pointsPerMatch: number; servesPerRotation: number | null;
  players: Player[]; matches: Match[]; scheduledAt: string | null;
  matchRules?: TennisPayload | null;
};
type LeaderRow = { playerId: string; name: string; played: number; pointsFor: number; pointsAgainst: number; diff: number; };
type ScoringMode = "final" | "live";
type Team = "A" | "B";

function formatLabel(f: "SINGLE" | "MIXED" | "TEAM"): string {
  if (f === "SINGLE") return "Single Match";
  if (f === "MIXED") return "Mixed Americano";
  return "Team Americano";
}
function formatScheduled(iso: string): string { try { const d = new Date(iso); return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch { return ""; } }

function serveDistribution(pts: number, spr: number): [number, number, number, number] {
  const base = Math.floor(pts / 4); const rem = pts % 4;
  return [base, base + (rem >= 3 ? 1 : 0), base + (rem >= 2 ? 1 : 0), base + (rem >= 1 ? 1 : 0)] as [number, number, number, number];
}

function computeCurrentServer(first: Team, totalPlayed: number, spr: number): { team: Team; slot: 0 | 1 } {
  const pos = Math.floor(totalPlayed / spr) % 4;
  const order: { team: Team; slot: 0 | 1 }[] = first === "A"
    ? [{ team: "A", slot: 0 }, { team: "B", slot: 0 }, { team: "A", slot: 1 }, { team: "B", slot: 1 }]
    : [{ team: "B", slot: 0 }, { team: "A", slot: 0 }, { team: "B", slot: 1 }, { team: "A", slot: 1 }];
  return order[pos];
}

function chipStyle(active: boolean): React.CSSProperties {
  return { borderRadius: 14, padding: "12px 14px", background: active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)", border: active ? "1px solid " + ORANGE : "1px solid rgba(255,255,255,0.10)", cursor: "pointer", fontWeight: 900, fontSize: 14, color: WHITE };
}
function modeTabStyle(active: boolean): React.CSSProperties {
  return { flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", borderRadius: 10, background: active ? ORANGE : "transparent", color: active ? WHITE : WARM_WHITE, opacity: active ? 1 : 0.55 };
}
function statusBoxStyle(color: string): React.CSSProperties {
  return { borderRadius: 18, padding: "24px 20px", background: color + "12", border: "1px solid " + color + "30", textAlign: "center" as const };
}

export default function PlayerPage() {
  const params = useParams();
  const code = (Array.isArray(params?.code) ? params.code[0] : params?.code ?? "") as string;
  const router = useRouter();

  const [isMobile, setIsMobile] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [scoringMode, setScoringMode] = useState<ScoringMode>("final");

  // ── Match rules (read from localStorage, written by organiser) ──────────
  const [tennisPayload, setTennisPayload] = useState<TennisPayload | null>(null);

  // ── Americano scoring state ──────────────────────────────────────────────
  const [myScore, setMyScore] = useState<string>("");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  // ── SINGLE final mode: games-first steppers ──────────────────────────────
  const [finalGamesA, setFinalGamesA] = useState(0);
  const [finalGamesB, setFinalGamesB] = useState(0);
  const [finalSetsA, setFinalSetsA] = useState(0);
  const [finalSetsB, setFinalSetsB] = useState(0);
  const [finalSetLog, setFinalSetLog] = useState<{ gamesA: number; gamesB: number }[]>([]);

  // ── SINGLE live mode: text inputs + set completion ───────────────────────
  const [liveSetsA, setLiveSetsA] = useState(0);
  const [liveSetsB, setLiveSetsB] = useState(0);
  const [currentGamesA, setCurrentGamesA] = useState("");
  const [currentGamesB, setCurrentGamesB] = useState("");
  const [liveSetLog, setLiveSetLog] = useState<{ gamesA: number; gamesB: number }[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submittedPointsA, setSubmittedPointsA] = useState<number | null>(null);
  const [submittedPointsB, setSubmittedPointsB] = useState<number | null>(null);
  const [showWatchToast, setShowWatchToast] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 600); check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check); }, []);

  useEffect(() => {
    if (!code) return;
    try { const stored = localStorage.getItem("eps_join_" + code); if (stored) { const { deviceId: did } = JSON.parse(stored); if (did) setDeviceId(did); } } catch { }
    try { const ps = localStorage.getItem("eps_player_" + code); if (ps) setSelectedPlayer(JSON.parse(ps)); } catch { }
    try { const rules = localStorage.getItem("eps_match_rules_" + code); if (rules) setTennisPayload(JSON.parse(rules)); } catch { }
    setBootstrapped(true);
  }, [code]);

  const applySession = useCallback((data: Session) => {
    setSession(data);
    if (data.matchRules && !localStorage.getItem("eps_match_rules_" + data.code)) {
      setTennisPayload(data.matchRules);
    }
  }, []);

  useEffect(() => {
    if (!code) return;
    fetch("/api/sessions/" + code).then((r) => r.json()).then((data) => startTransition(() => applySession(data))).catch(() => { });
    const es = new EventSource("/api/sessions/" + code + "/stream"); esRef.current = es;
    es.onmessage = (e) => { try { const data = JSON.parse(e.data); startTransition(() => applySession(data)); } catch { } };
    es.onerror = () => { es.close(); if (!pollRef.current) { pollRef.current = setInterval(() => { fetch("/api/sessions/" + code).then((r) => r.json()).then((data) => startTransition(() => applySession(data))).catch(() => { }); }, 3000); } };
    return () => { es.close(); if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [code, applySession]);

  async function claimPlayer(p: Player) {
    setClaiming(true); setClaimError("");
    try {
      const r = await fetch("/api/sessions/" + code + "/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: p.id }) });
      const data = await r.json();
      if (!r.ok) { setClaimError(data.message ?? data.error ?? "Could not register device."); setClaiming(false); return; }
      const did = data.deviceId;
      setDeviceId(did);
      localStorage.setItem("eps_join_" + code, JSON.stringify({ deviceId: did, isOrganiser: false }));
      localStorage.setItem("eps_player_" + code, JSON.stringify(p));
      setSelectedPlayer(p);
    } catch { setClaimError("Network error. Please try again."); }
    setClaiming(false);
  }

  function changeName() {
    localStorage.removeItem("eps_player_" + code); localStorage.removeItem("eps_join_" + code);
    setSelectedPlayer(null); setDeviceId(null);
    setSubmitResult(null); setClaimError(""); setSubmittedPointsA(null); setSubmittedPointsB(null);
  }

  // ── SINGLE final mode: confirm a detected set ──────────────────────────
  function finalConfirmSet(winner: "A" | "B") {
    setFinalSetLog((prev) => [...prev, { gamesA: finalGamesA, gamesB: finalGamesB }]);
    if (winner === "A") setFinalSetsA((v) => v + 1); else setFinalSetsB((v) => v + 1);
    setFinalGamesA(0); setFinalGamesB(0);
  }

  // ── SINGLE live mode: complete a set ──────────────────────────────────
  function liveCompleteSet() {
    const gA = parseInt(currentGamesA, 10); const gB = parseInt(currentGamesB, 10);
    if (isNaN(gA) || isNaN(gB) || gA === gB) return;
    setLiveSetLog((prev) => [...prev, { gamesA: gA, gamesB: gB }]);
    if (gA > gB) setLiveSetsA((v) => v + 1); else setLiveSetsB((v) => v + 1);
    setCurrentGamesA(""); setCurrentGamesB("");
  }

  function resetAllScoringState() {
    setMyScore(""); setScoreA(0); setScoreB(0);
    setFinalGamesA(0); setFinalGamesB(0);
    setFinalSetsA(0); setFinalSetsB(0); setFinalSetLog([]);
    setLiveSetsA(0); setLiveSetsB(0);
    setCurrentGamesA(""); setCurrentGamesB(""); setLiveSetLog([]);
  }

  async function submitScore() {
    if (!myMatch || !myTeam) return;
    if (!deviceId) { setSubmitError("Device not registered — tap 'Change' and re-select your name."); return; }
    setSubmitting(true); setSubmitError(""); setSubmitResult(null);

    let pA: number; let pB: number;
    const total = session?.pointsPerMatch ?? 21;

    if (isSingle) {
      if (scoringMode === "final") { pA = finalSetsA; pB = finalSetsB; }
      else { pA = liveSetsA; pB = liveSetsB; }
    } else if (scoringMode === "final") {
      const mine = parseInt(myScore, 10);
      if (isNaN(mine) || mine < 0 || mine > total) { setSubmitError("Enter a valid score between 0 and " + total + "."); setSubmitting(false); return; }
      pA = myTeam === "A" ? mine : total - mine; pB = myTeam === "B" ? mine : total - mine;
    } else {
      pA = scoreA; pB = scoreB;
      if (pA + pB !== total) { setSubmitError("Total must equal " + total + " pts. Currently " + (pA + pB) + " of " + total + " played."); setSubmitting(false); return; }
    }

    try {
      const r = await fetch("/api/matches/" + myMatch.id + "/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, pointsA: pA, pointsB: pB }) });
      const data = await r.json();
      if (!r.ok) { setSubmitError(data.error ?? "Failed to submit."); setSubmitting(false); return; }
      setSubmittedPointsA(pA); setSubmittedPointsB(pB); setSubmitResult(data.result);
      resetAllScoringState();
    } catch { setSubmitError("Network error."); }
    setSubmitting(false);
  }

  const nameById = (session?.players ?? []).reduce<Record<string, string>>((m, p) => { m[p.id] = p.name; return m; }, {});
  const total = session?.pointsPerMatch ?? 21;
  const spr = session?.servesPerRotation ?? 4;
  const isSingle = session?.format === "SINGLE";
  const showServeHelper = !isSingle && !!session?.servesPerRotation;

  const myMatch = (selectedPlayer && session) ? (
    session.matches.find((m) => m.status === "IN_PROGRESS" && [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].includes(selectedPlayer.id)) ??
    session.matches.filter((m) => m.status === "COMPLETE" && [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].includes(selectedPlayer.id)).sort((a, b) => b.queuePosition - a.queuePosition)[0]
  ) : undefined;

  const myTeam: Team | null = (myMatch && selectedPlayer)
    ? ([myMatch.teamAPlayer1, myMatch.teamAPlayer2].includes(selectedPlayer.id) ? "A" : "B") : null;

  const upcomingMatches = (selectedPlayer && session)
    ? session.matches.filter((m) => m.status === "PENDING" && [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].includes(selectedPlayer.id)).sort((a, b) => a.queuePosition - b.queuePosition)
    : [];

  // ── SINGLE final mode derived values ─────────────────────────────────────
  const tp: TennisPayload = tennisPayload ?? { sets: 1, rules: { deuceMode: "traditional", tiebreak: true, superTiebreak: false } };
  const finalCurrentSetIdx = finalSetLog.length;
  const finalMaxGames = getMaxGames(tp, finalCurrentSetIdx);
  const finalDetectedWinner = detectSetWinner(finalGamesA, finalGamesB, tp, finalCurrentSetIdx);
  const finalScoreValid = isGameScoreValid(finalGamesA, finalGamesB, tp, finalCurrentSetIdx);
  const finalScoreNonZero = finalGamesA > 0 || finalGamesB > 0;
  const isSuperTBSet = isFinalSetSuperTBForScore(finalCurrentSetIdx, tp);
  const maxSetsPerTeam = setsToWin(tp.sets);
  const totalSetsPlayed = finalSetsA + finalSetsB;
  const canIncrFinalSetsA = finalSetsA < maxSetsPerTeam && totalSetsPlayed < tp.sets;
  const canIncrFinalSetsB = finalSetsB < maxSetsPerTeam && totalSetsPlayed < tp.sets;
  const finalSetLabel = finalCurrentSetIdx === tp.sets - 1 && isSuperTBSet ? "Super Tiebreak" : `Set ${finalCurrentSetIdx + 1}`;
  const finalGameUnit = isSuperTBSet ? "points" : "games";

  // ── SINGLE live mode derived values ──────────────────────────────────────
  const liveCanCompleteSet = (() => { const gA = parseInt(currentGamesA, 10); const gB = parseInt(currentGamesB, 10); return !isNaN(gA) && !isNaN(gB) && gA !== gB; })();

  const leaderboard: LeaderRow[] = (() => {
    if (!session) return [];
    const base = new Map<string, LeaderRow>();
    for (const p of session.players) base.set(p.id, { playerId: p.id, name: p.name, played: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 });
    for (const m of session.matches) {
      if (m.status !== "COMPLETE" || m.pointsA === null || m.pointsB === null) continue;
      for (const pid of [m.teamAPlayer1, m.teamAPlayer2]) { const row = base.get(pid); if (row) { row.played++; row.pointsFor += m.pointsA; row.pointsAgainst += m.pointsB; } }
      for (const pid of [m.teamBPlayer1, m.teamBPlayer2]) { const row = base.get(pid); if (row) { row.played++; row.pointsFor += m.pointsB; row.pointsAgainst += m.pointsA; } }
    }
    return Array.from(base.values()).map((row) => ({ ...row, diff: row.pointsFor - row.pointsAgainst })).sort((a, b) => b.diff !== a.diff ? b.diff - a.diff : b.pointsFor !== a.pointsFor ? b.pointsFor - a.pointsFor : a.name.localeCompare(b.name));
  })();

  const completedCount = session?.matches.filter((m) => m.status === "COMPLETE").length ?? 0;
  const sessionComplete = !!(session && session.matches.length > 0 && session.matches.every((m) => m.status === "COMPLETE"));
  const myScoreNum = parseInt(myScore, 10);
  const otherScore = (!isNaN(myScoreNum) && myScoreNum >= 0 && myScoreNum <= total) ? total - myScoreNum : null;
  const liveTotalPlayed = scoreA + scoreB;
  const liveAtMax = liveTotalPlayed >= total;

  const liveServer = (() => {
    if (!showServeHelper || !myMatch || !myTeam) return null;
    const server = computeCurrentServer("A", scoreA + scoreB, spr);
    const playerNames = { A: [nameById[myMatch.teamAPlayer1] ?? "A1", nameById[myMatch.teamAPlayer2] ?? "A2"], B: [nameById[myMatch.teamBPlayer1] ?? "B1", nameById[myMatch.teamBPlayer2] ?? "B2"] };
    return playerNames[server.team][server.slot];
  })();

  const serveHint = (() => {
    if (!showServeHelper || !myMatch) return null;
    const [a1c, b1c, a2c, b2c] = serveDistribution(total, spr);
    const a1n = nameById[myMatch.teamAPlayer1] ?? "A1"; const b1n = nameById[myMatch.teamBPlayer1] ?? "B1";
    const a2n = nameById[myMatch.teamAPlayer2] ?? "A2"; const b2n = nameById[myMatch.teamBPlayer2] ?? "B2";
    if (a1c === b1c && b1c === a2c && a2c === b2c) return "Equal serves — each player serves " + a1c + " pts";
    return a1n + ": " + a1c + " · " + b1n + ": " + b1c + " · " + a2n + ": " + a2c + " · " + b2n + ": " + b2c;
  })();

  const lbCols = isMobile ? "32px 1fr 56px" : "32px 1fr 60px 80px";

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 480, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", marginTop: 12 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
    title: { fontSize: 22, fontWeight: 1000 },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4, lineHeight: 1.4 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 0" },
    sectionDivider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "18px 0" },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 16, marginBottom: 10 },
    btn: { borderRadius: 14, padding: "10px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnActive: { borderRadius: 14, padding: "10px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,107,0,0.5)", background: "rgba(255,107,0,0.15)", color: WHITE, whiteSpace: "nowrap" as const },
    btnOrange: { width: "100%", borderRadius: 14, padding: "14px 18px", fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, marginTop: 16 },
    grid2: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0,1fr))" },
    bigNum: { fontSize: 56, fontWeight: 1200, letterSpacing: 0, lineHeight: 1 },
    stepBtn: { width: 52, height: 52, borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 26, fontWeight: 1000, cursor: "pointer" },
    scoreRow: { display: "flex", alignItems: "center", gap: 14, justifyContent: "center", margin: "8px 0" },
    primaryBtn: { width: "100%", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, marginTop: 14 },
    confirmSetBtn: { width: "100%", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: GREEN, color: WHITE, marginTop: 10 },
    secondaryBtn: { width: "100%", borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", color: WHITE, marginTop: 10 },
    errorBox: { marginTop: 10, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    modeToggle: { display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 4, marginBottom: 14 },
    scoreInput: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.20)", borderRadius: 14, padding: "16px 12px", fontSize: 48, fontWeight: 1200, textAlign: "center" as const, outline: "none", boxSizing: "border-box" as const, lineHeight: 1 },
    autoScore: { textAlign: "center" as const, borderRadius: 14, padding: "16px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 48, fontWeight: 1200, lineHeight: 1, color: WARM_WHITE, opacity: 0.4 },
    teamLabel: { fontWeight: 1000, fontSize: 13, opacity: 0.75, marginBottom: 8, textAlign: "center" as const },
    hint: { fontSize: 12, color: WARM_WHITE, opacity: 0.5, textAlign: "center" as const, marginTop: 8, lineHeight: 1.4 },
    serveBox: { marginTop: 10, borderRadius: 12, padding: "10px 14px", background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.25)", fontSize: 12, fontWeight: 900, color: WHITE, textAlign: "center" as const, lineHeight: 1.4 },
    upcomingCard: { borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    upcomingMatch: { fontSize: 13, fontWeight: 900, lineHeight: 1.4 },
    upcomingLabel: { fontSize: 11, fontWeight: 1000, color: ORANGE, whiteSpace: "nowrap" as const },
    lbWrap: { marginTop: 4, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" },
    lbHead: { display: "grid", gridTemplateColumns: lbCols, gap: 8, fontSize: 11, opacity: 0.5, fontWeight: 950, padding: "8px 12px", textTransform: "uppercase" as const, letterSpacing: 0.5, background: "rgba(0,0,0,0.2)" },
    lbRow: { display: "grid", gridTemplateColumns: lbCols, gap: 8, alignItems: "center", padding: "10px 12px" },
    lbRight: { textAlign: "right" as const },
    lbCenter: { textAlign: "center" as const },
    resultPill: { marginTop: 12, borderRadius: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    // SINGLE final score specific
    setsDisplay: { display: "flex", justifyContent: "center", alignItems: "baseline", gap: 14, padding: "10px 0 4px" },
    setLogItem: { fontSize: 12, fontWeight: 900, opacity: 0.55, textAlign: "center" as const, padding: "3px 0" },
    setCurrentLabel: { fontSize: 11, fontWeight: 1000, opacity: 0.45, letterSpacing: 1.2, textTransform: "uppercase" as const, textAlign: "center" as const, marginBottom: 10 },
    gameWinnerBanner: { marginTop: 10, borderRadius: 14, padding: "12px 16px", background: "rgba(0,200,80,0.10)", border: "1px solid rgba(0,200,80,0.35)", textAlign: "center" as const },
    gameWarnBanner: { marginTop: 10, borderRadius: 14, padding: "10px 14px", background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.30)", textAlign: "center" as const, fontSize: 12, fontWeight: 900, color: WHITE },
  };

  if (!bootstrapped) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading...</div></div></div>;

  if (!selectedPlayer) {
    return (
      <div style={st.page}><div style={st.card}>
        <button style={{ ...st.btn, marginBottom: 14 }} onClick={() => router.push("/")}>Home</button>
        <div style={st.title}>Who are you?</div>
        <div style={{ ...st.sub, marginBottom: 4 }}>Tap your name to claim your spot.{" "}<span style={{ color: ORANGE, cursor: "pointer", fontWeight: 1000 }} onClick={() => router.push("/join?code=" + code)}>Join with the session code</span>{" "}if you have not joined yet.</div>
        {!session ? <div style={{ opacity: 0.6, marginTop: 14, fontWeight: 900 }}>Loading player list...</div> : (
          <>
            <div style={st.sectionLabel}>Session {code} · {formatLabel(session.format)} — tap your name</div>
            <div style={st.grid2}>{session.players.map((p) => <div key={p.id} style={{ ...chipStyle(false), opacity: claiming ? 0.5 : 1 }} onClick={() => { if (!claiming) claimPlayer(p); }}>{p.name}</div>)}</div>
            {claimError && <div style={st.errorBox}>{claimError}</div>}
          </>
        )}
      </div></div>
    );
  }

  const leaderboardPanel = showLeaderboard && (
    <>
      <div style={st.divider} />
      <div style={st.lbWrap}>
        <div style={st.lbHead}><div style={st.lbCenter}>#</div><div>Player</div>{!isMobile && <div style={st.lbRight}>Played</div>}<div style={st.lbRight}>Diff</div></div>
        {leaderboard.map((row, idx) => {
          const isMe = row.playerId === selectedPlayer.id; const isTop3 = idx < 3 && row.played > 0;
          return (
            <div key={row.playerId} style={{ ...st.lbRow, background: isMe ? "rgba(255,107,0,0.12)" : isTop3 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ ...st.lbCenter, fontSize: 14, fontWeight: 1100, color: idx === 0 && row.played > 0 ? ORANGE : WHITE }}>{idx + 1}</div>
              <div style={{ fontSize: 14, fontWeight: isMe ? 1100 : 900, color: isMe ? ORANGE : WHITE }}>{row.name}{isMe ? " *" : ""}</div>
              {!isMobile && <div style={{ ...st.lbRight, fontSize: 13, fontWeight: 900, opacity: 0.7 }}>{row.played}</div>}
              <div style={{ ...st.lbRight, fontSize: 13, fontWeight: 1100, color: row.diff > 0 ? GREEN : row.diff < 0 ? RED : WHITE }}>{row.diff > 0 ? "+" + row.diff : row.diff}</div>
            </div>
          );
        })}
        {completedCount === 0 && <div style={{ padding: "12px 14px", fontSize: 12, opacity: 0.5, textAlign: "center" as const }}>No completed matches yet.</div>}
      </div>
    </>
  );

  const upcomingBlock = upcomingMatches.length > 0 ? (
    <>
      <div style={st.sectionLabel}>Your upcoming matches</div>
      <div style={{ display: "grid", gap: 8 }}>
        {upcomingMatches.slice(0, 3).map((m, i) => {
          const isMyTeamA = [m.teamAPlayer1, m.teamAPlayer2].includes(selectedPlayer.id);
          const partner = isMyTeamA ? nameById[m.teamAPlayer1 === selectedPlayer.id ? m.teamAPlayer2 : m.teamAPlayer1] : nameById[m.teamBPlayer1 === selectedPlayer.id ? m.teamBPlayer2 : m.teamBPlayer1];
          const opp1 = isMyTeamA ? nameById[m.teamBPlayer1] : nameById[m.teamAPlayer1];
          const opp2 = isMyTeamA ? nameById[m.teamBPlayer2] : nameById[m.teamAPlayer2];
          return (
            <div key={m.id} style={st.upcomingCard}>
              <div style={st.upcomingMatch}><span style={{ color: ORANGE, fontWeight: 1000 }}>You &amp; {partner}</span><span style={{ opacity: 0.5 }}> vs </span>{opp1} &amp; {opp2}</div>
              <div style={st.upcomingLabel}>#{i + 1}</div>
            </div>
          );
        })}
        {upcomingMatches.length > 3 && <div style={{ fontSize: 12, opacity: 0.45, textAlign: "center" as const, paddingTop: 4 }}>+{upcomingMatches.length - 3} more matches scheduled</div>}
      </div>
    </>
  ) : null;

  let statusBlock: React.ReactNode;

  if (sessionComplete) {
    const myRank = leaderboard.findIndex((row) => row.playerId === selectedPlayer.id) + 1;
    const myRow = leaderboard.find((row) => row.playerId === selectedPlayer.id);
    const rankLabel = myRank === 1 ? "1st" : myRank === 2 ? "2nd" : myRank === 3 ? "3rd" : "#" + myRank;
    statusBlock = (
      <>
        <div style={{ borderRadius: 18, padding: 24, background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.30)", textAlign: "center" as const }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 22, fontWeight: 1100, color: ORANGE }}>Session Complete!</div>
          {myRow && <><div style={{ fontSize: 36, fontWeight: 1200, marginTop: 12 }}>{rankLabel}</div><div style={{ fontSize: 15, fontWeight: 1000, marginTop: 6 }}>{myRow.pointsFor} pts · {myRow.diff > 0 ? "+" + myRow.diff : myRow.diff} diff</div></>}
        </div>
        <div style={st.sectionLabel}>Final standings</div>
        <div style={st.lbWrap}>
          <div style={st.lbHead}><div style={st.lbCenter}>#</div><div>Player</div>{!isMobile && <div style={st.lbRight}>Played</div>}<div style={st.lbRight}>Diff</div></div>
          {leaderboard.map((row, idx) => { const isMe = row.playerId === selectedPlayer.id; return <div key={row.playerId} style={{ ...st.lbRow, background: isMe ? "rgba(255,107,0,0.12)" : idx < 3 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}><div style={{ ...st.lbCenter, fontSize: 14, fontWeight: 1100, color: idx === 0 ? ORANGE : WHITE }}>{idx + 1}</div><div style={{ fontSize: 14, fontWeight: isMe ? 1100 : 900, color: isMe ? ORANGE : WHITE }}>{row.name}{isMe ? " *" : ""}</div>{!isMobile && <div style={{ ...st.lbRight, fontSize: 13, opacity: 0.7 }}>{row.played}</div>}<div style={{ ...st.lbRight, fontSize: 13, fontWeight: 1100, color: row.diff > 0 ? GREEN : row.diff < 0 ? RED : WHITE }}>{row.diff > 0 ? "+" + row.diff : row.diff}</div></div>; })}
        </div>
        <button style={st.btnOrange} onClick={() => router.push("/")}>Back to Home</button>
      </>
    );

  } else if (!myMatch) {
    statusBlock = (
      <>
        <div style={statusBoxStyle(WARM_WHITE)}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>{isSingle ? "Match starting soon" : "Waiting for court assignment"}</div>
          {session?.scheduledAt && (
            <div style={{ marginTop: 10, padding: "8px 14px", borderRadius: 10, background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.30)", fontSize: 14, fontWeight: 1000, color: "#FF6B00" }}>
              {formatLabel(session.format)} · {formatScheduled(session.scheduledAt)}
            </div>
          )}
          <div style={{ opacity: 0.6, marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>{isSingle ? "You're in — the organiser will start the match shortly." : "Hang tight — you'll be assigned to a court shortly."}</div>
        </div>
        {upcomingBlock}
      </>
    );

  } else if (myMatch.status === "COMPLETE") {
    const pA = myMatch.pointsA ?? 0; const pB = myMatch.pointsB ?? 0;
    const mine = myTeam === "A" ? pA : pB; const theirs = myTeam === "A" ? pB : pA; const won = mine > theirs;
    if (upcomingMatches.length > 0) {
      statusBlock = (
        <>
          <div style={statusBoxStyle(ORANGE)}><div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div><div style={{ fontWeight: 1000, fontSize: 20 }}>Waiting for next court</div><div style={{ opacity: 0.6, marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>Your next match is queued — you'll be called to a court shortly.</div></div>
          <div style={st.resultPill}><div style={{ fontSize: 13, fontWeight: 900, opacity: 0.7 }}>Last result</div><div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontSize: 22, fontWeight: 1200, color: myTeam === "A" ? ORANGE : WARM_WHITE }}>{pA}</span><span style={{ opacity: 0.35, fontSize: 16 }}>–</span><span style={{ fontSize: 22, fontWeight: 1200, color: myTeam === "B" ? ORANGE : WARM_WHITE }}>{pB}</span></div><div style={{ fontSize: 12, fontWeight: 1000, color: won ? GREEN : mine === theirs ? WARM_WHITE : RED }}>{won ? "Won" : mine === theirs ? "Draw" : "Lost"}</div></div>
          {upcomingBlock}
        </>
      );
    } else {
      statusBlock = (
        <>
          <div style={statusBoxStyle(won ? GREEN : ORANGE)}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{won ? "🏆" : "🎾"}</div>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>Match complete</div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "baseline", margin: "14px 0" }}><span style={{ ...st.bigNum, color: myTeam === "A" ? ORANGE : WARM_WHITE }}>{pA}</span><span style={{ opacity: 0.35, fontWeight: 900, fontSize: 24 }}>—</span><span style={{ ...st.bigNum, color: myTeam === "B" ? ORANGE : WARM_WHITE }}>{pB}</span></div>
            <div style={{ opacity: 0.6, fontSize: 13 }}>{won ? "You won " + mine + "–" + theirs : mine === theirs ? "It's a draw!" : "You scored " + mine}</div>
          </div>
          <div style={{ marginTop: 12, borderRadius: 14, padding: "12px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 13, fontWeight: 900, color: WARM_WHITE, opacity: 0.7, textAlign: "center" as const }}>No more matches queued yet — check back shortly.</div>
        </>
      );
    }

  } else if (myMatch.status === "IN_PROGRESS") {
    const a1 = nameById[myMatch.teamAPlayer1]; const a2 = nameById[myMatch.teamAPlayer2];
    const b1 = nameById[myMatch.teamBPlayer1]; const b2 = nameById[myMatch.teamBPlayer2];

    if (submitResult === "CONFIRMED" && submittedPointsA !== null && submittedPointsB !== null) {
      const pA = submittedPointsA; const pB = submittedPointsB;
      const mine = myTeam === "A" ? pA : pB; const theirs = myTeam === "A" ? pB : pA;
      statusBlock = (
        <>
          <div style={statusBoxStyle(GREEN)}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>Score confirmed!</div>
            <div style={{ fontSize: 32, fontWeight: 1200, margin: "12px 0" }}>{pA} — {pB}</div>
            <div style={{ opacity: 0.6, fontSize: 13 }}>{mine > theirs ? "You won " + mine + "–" + theirs : mine === theirs ? "Draw!" : "You scored " + mine}</div>
          </div>
          {upcomingBlock}
        </>
      );
    } else {
      statusBlock = (
        <>
          <div style={statusBoxStyle(ORANGE)}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>🎾</div>
            <div style={{ fontWeight: 1000, fontSize: 22 }}>Court {myMatch.courtNumber}</div>
            <div style={{ opacity: 0.65, marginTop: 6, fontSize: 13 }}>{a1} &amp; {a2} <span style={{ opacity: 0.5 }}>vs</span> {b1} &amp; {b2}</div>
          </div>

          <div style={st.sectionLabel}>Enter score</div>

          {isSingle ? (
            // ═══════════════════════════════════════════════════════
            // SINGLE FORMAT SCORING
            // ═══════════════════════════════════════════════════════
            <>
              <div style={st.modeToggle}>
                <button style={modeTabStyle(scoringMode === "final")} onClick={() => setScoringMode("final")}>Final score</button>
                <button style={modeTabStyle(scoringMode === "live")} onClick={() => setScoringMode("live")}>Live scoring</button>
              </div>

              {scoringMode === "final" ? (
                // ── FINAL SCORE: games first, then sets ──────────────
                <>
                  {/* ── GAMES ───────────────────────────────── */}
                  <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginBottom: 10 }}>
                    {finalSetLabel} — {finalGameUnit}
                    {isSuperTBSet && <span style={{ color: ORANGE, marginLeft: 8, opacity: 1 }}>Super Tiebreak</span>}
                  </div>

                  <div style={st.grid2}>
                    <div>
                      <div style={st.teamLabel}>Team A{myTeam === "A" ? " · You" : ""}</div>
                      <div style={st.scoreRow}>
                        <button style={{ ...st.stepBtn, opacity: finalGamesA === 0 ? 0.35 : 1 }} onClick={() => setFinalGamesA((v) => Math.max(0, v - 1))} disabled={finalGamesA === 0}>−</button>
                        <div style={{ ...st.bigNum, color: finalDetectedWinner === "A" ? GREEN : WHITE }}>{finalGamesA}</div>
                        <button style={{ ...st.stepBtn, opacity: finalGamesA >= finalMaxGames ? 0.35 : 1 }} onClick={() => setFinalGamesA((v) => Math.min(finalMaxGames, v + 1))} disabled={finalGamesA >= finalMaxGames}>+</button>
                      </div>
                    </div>
                    <div>
                      <div style={st.teamLabel}>Team B{myTeam === "B" ? " · You" : ""}</div>
                      <div style={st.scoreRow}>
                        <button style={{ ...st.stepBtn, opacity: finalGamesB === 0 ? 0.35 : 1 }} onClick={() => setFinalGamesB((v) => Math.max(0, v - 1))} disabled={finalGamesB === 0}>−</button>
                        <div style={{ ...st.bigNum, color: finalDetectedWinner === "B" ? GREEN : WHITE }}>{finalGamesB}</div>
                        <button style={{ ...st.stepBtn, opacity: finalGamesB >= finalMaxGames ? 0.35 : 1 }} onClick={() => setFinalGamesB((v) => Math.min(finalMaxGames, v + 1))} disabled={finalGamesB >= finalMaxGames}>+</button>
                      </div>
                    </div>
                  </div>

                  {/* Auto-detected winner */}
                  {finalDetectedWinner && (
                    <div style={st.gameWinnerBanner}>
                      <div style={{ fontSize: 14, fontWeight: 1000, color: GREEN }}>
                        ✓ Team {finalDetectedWinner} wins {finalSetLabel} ({finalGamesA}–{finalGamesB})
                      </div>
                      <button style={st.confirmSetBtn} onClick={() => finalConfirmSet(finalDetectedWinner)}>
                        Confirm {finalSetLabel}
                      </button>
                    </div>
                  )}

                  {/* Invalid score warning */}
                  {finalScoreNonZero && !finalDetectedWinner && !finalScoreValid && (
                    <div style={st.gameWarnBanner}>
                      ⚠ {finalGamesA}–{finalGamesB} is not a valid {isSuperTBSet ? "super tiebreak score (first to 10, win by 2)" : "game score (max 7-6 or 7-5)"}
                    </div>
                  )}

                  {/* Manual complete (valid partial) */}
                  {finalScoreNonZero && !finalDetectedWinner && finalScoreValid && finalGamesA !== finalGamesB && (
                    <div style={{ marginTop: 10, textAlign: "center" as const }}>
                      <button style={{ borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", color: WHITE }}
                        onClick={() => { const w = finalGamesA > finalGamesB ? "A" : "B"; finalConfirmSet(w); }}>
                        Manually complete {finalSetLabel}
                      </button>
                    </div>
                  )}

                  {/* ── SETS ─────────────────────────────────── */}
                  <div style={st.sectionDivider} />

                  <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Sets won <span style={{ opacity: 0.5, fontWeight: 900 }}>· {tp.sets === 1 ? "1 set" : "Best of " + tp.sets}</span>
                  </div>

                  <div style={st.setsDisplay}>
                    <div style={{ fontSize: 44, fontWeight: 1200, lineHeight: 1, display: "flex", alignItems: "baseline", gap: 12, justifyContent: "center" }}>
                      <span style={{ color: finalSetsA > finalSetsB ? (myTeam === "A" ? ORANGE : WHITE) : WHITE }}>{finalSetsA}</span>
                      <span style={{ opacity: 0.25, fontSize: 28 }}>–</span>
                      <span style={{ color: finalSetsB > finalSetsA ? (myTeam === "B" ? ORANGE : WHITE) : WHITE }}>{finalSetsB}</span>
                    </div>
                  </div>

                  <div style={st.grid2}>
                    <div>
                      <div style={st.teamLabel}>Team A{myTeam === "A" ? " · You" : ""} sets</div>
                      <div style={st.scoreRow}>
                        <button style={{ ...st.stepBtn, opacity: finalSetsA === 0 ? 0.35 : 1 }} onClick={() => setFinalSetsA((v) => Math.max(0, v - 1))} disabled={finalSetsA === 0}>−</button>
                        <div style={st.bigNum}>{finalSetsA}</div>
                        <button style={{ ...st.stepBtn, opacity: !canIncrFinalSetsA ? 0.35 : 1 }} onClick={() => { if (canIncrFinalSetsA) setFinalSetsA((v) => v + 1); }} disabled={!canIncrFinalSetsA}>+</button>
                      </div>
                    </div>
                    <div>
                      <div style={st.teamLabel}>Team B{myTeam === "B" ? " · You" : ""} sets</div>
                      <div style={st.scoreRow}>
                        <button style={{ ...st.stepBtn, opacity: finalSetsB === 0 ? 0.35 : 1 }} onClick={() => setFinalSetsB((v) => Math.max(0, v - 1))} disabled={finalSetsB === 0}>−</button>
                        <div style={st.bigNum}>{finalSetsB}</div>
                        <button style={{ ...st.stepBtn, opacity: !canIncrFinalSetsB ? 0.35 : 1 }} onClick={() => { if (canIncrFinalSetsB) setFinalSetsB((v) => v + 1); }} disabled={!canIncrFinalSetsB}>+</button>
                      </div>
                    </div>
                  </div>

                  {/* Set log */}
                  {finalSetLog.length > 0 && (
                    <div style={{ marginTop: 8, display: "grid", gap: 2 }}>
                      {finalSetLog.map((s, i) => <div key={i} style={st.setLogItem}>Set {i + 1}: {s.gamesA}–{s.gamesB} · {s.gamesA > s.gamesB ? (myTeam === "A" ? "You won" : "Team A won") : (myTeam === "B" ? "You won" : "Team B won")}</div>)}
                    </div>
                  )}

                  <div style={{ ...st.hint, marginTop: 8 }}>Max {maxSetsPerTeam} sets per team · {tp.sets} total sets in match</div>
                </>
              ) : (
                // ── LIVE SCORING: text inputs + set completion ────────
                <>
                  {/* Running sets total */}
                  <div style={st.setsDisplay}>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ fontSize: 11, fontWeight: 1000, opacity: 0.45, letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 8 }}>Sets</div>
                      <div style={{ fontSize: 44, fontWeight: 1200, lineHeight: 1, display: "flex", alignItems: "baseline", gap: 12, justifyContent: "center" }}>
                        <span style={{ color: myTeam === "A" ? ORANGE : WHITE }}>{liveSetsA}</span>
                        <span style={{ opacity: 0.25, fontSize: 28 }}>–</span>
                        <span style={{ color: myTeam === "B" ? ORANGE : WHITE }}>{liveSetsB}</span>
                      </div>
                    </div>
                  </div>

                  {/* Completed set history */}
                  {liveSetLog.length > 0 && (
                    <div style={{ marginBottom: 12, display: "grid", gap: 2 }}>
                      {liveSetLog.map((s, i) => <div key={i} style={st.setLogItem}>Set {i + 1}: {s.gamesA}–{s.gamesB} · {s.gamesA > s.gamesB ? (myTeam === "A" ? "You won" : "Team A won") : (myTeam === "B" ? "You won" : "Team B won")}</div>)}
                    </div>
                  )}

                  {/* Current set games entry */}
                  <div style={st.setCurrentLabel}>Set {liveSetLog.length + 1} — games</div>
                  <div style={st.grid2}>
                    <div>
                      <div style={st.teamLabel}>Team A{myTeam === "A" ? " · You" : ""}</div>
                      <input style={st.scoreInput} inputMode="numeric" placeholder="0" value={currentGamesA} onChange={(e) => setCurrentGamesA(e.target.value.replace(/[^\d]/g, ""))} />
                    </div>
                    <div>
                      <div style={st.teamLabel}>Team B{myTeam === "B" ? " · You" : ""}</div>
                      <input style={st.scoreInput} inputMode="numeric" placeholder="0" value={currentGamesB} onChange={(e) => setCurrentGamesB(e.target.value.replace(/[^\d]/g, ""))} />
                    </div>
                  </div>
                  <button style={{ ...st.secondaryBtn, opacity: liveCanCompleteSet ? 1 : 0.35 }} onClick={liveCompleteSet} disabled={!liveCanCompleteSet}>
                    ✓ Complete Set {liveSetLog.length + 1}
                  </button>
                  <div style={st.hint}>Update games as the set progresses. Tap "Complete Set" when the set finishes to log it and move to the next.</div>
                </>
              )}

              {/* Submit always available for SINGLE */}
              <button style={{ ...st.primaryBtn, opacity: submitting ? 0.5 : 1 }} onClick={submitScore} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit match result"}
              </button>
              {submitError && <div style={st.errorBox}>{submitError}</div>}
              {upcomingBlock}
            </>
          ) : (
            // ═══════════════════════════════════════════════════════
            // AMERICANO / TEAM FORMAT SCORING (unchanged)
            // ═══════════════════════════════════════════════════════
            <>
              <div style={st.modeToggle}>
                <button style={modeTabStyle(scoringMode === "final")} onClick={() => setScoringMode("final")}>Final score</button>
                <button style={modeTabStyle(scoringMode === "live")} onClick={() => setScoringMode("live")}>Live scoring</button>
              </div>

              {scoringMode === "final" ? (
                <>
                  <div style={st.grid2}>
                    <div>
                      <div style={st.teamLabel}>Your team{myTeam ? " (Team " + myTeam + ")" : ""}</div>
                      <input style={st.scoreInput} inputMode="numeric" placeholder="—" value={myScore}
                        onChange={(e) => { const val = e.target.value.replace(/[^\d]/g, ""); const num = parseInt(val, 10); if (val === "" || (!isNaN(num) && num <= total)) setMyScore(val); }} />
                    </div>
                    <div>
                      <div style={st.teamLabel}>Opponents</div>
                      <div style={st.autoScore}>{otherScore !== null ? otherScore : "—"}</div>
                    </div>
                  </div>
                  <div style={st.hint}>Enter your team's points — opponents auto-calculated from {total} total.</div>
                  {showServeHelper && serveHint && <div style={st.serveBox}>{serveHint}</div>}
                </>
              ) : (
                <>
                  <div style={st.grid2}>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={st.teamLabel}>Team A{myTeam === "A" ? " · You" : ""}</div>
                      <div style={st.scoreRow}>
                        <button style={{ ...st.stepBtn, opacity: liveAtMax ? 0.35 : 1 }} onClick={() => { if (!liveAtMax) setScoreA((v) => v + 1); }} disabled={liveAtMax}>+</button>
                        <div style={st.bigNum}>{scoreA}</div>
                        <button style={{ ...st.stepBtn, opacity: scoreA === 0 ? 0.35 : 1 }} onClick={() => setScoreA((v) => Math.max(0, v - 1))} disabled={scoreA === 0}>−</button>
                      </div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={st.teamLabel}>Team B{myTeam === "B" ? " · You" : ""}</div>
                      <div style={st.scoreRow}>
                        <button style={{ ...st.stepBtn, opacity: liveAtMax ? 0.35 : 1 }} onClick={() => { if (!liveAtMax) setScoreB((v) => v + 1); }} disabled={liveAtMax}>+</button>
                        <div style={st.bigNum}>{scoreB}</div>
                        <button style={{ ...st.stepBtn, opacity: scoreB === 0 ? 0.35 : 1 }} onClick={() => setScoreB((v) => Math.max(0, v - 1))} disabled={scoreB === 0}>−</button>
                      </div>
                    </div>
                  </div>
                  <div style={st.hint}>{liveTotalPlayed} of {total} pts played.{liveAtMax ? " Ready to submit." : " — " + (total - liveTotalPlayed) + " pts remaining."}</div>
                  {showServeHelper && liveServer && <div style={st.serveBox}>🎾 Serving now: <strong>{liveServer}</strong></div>}
                </>
              )}

              <button style={{ ...st.primaryBtn, opacity: (submitting || (scoringMode === "live" && !liveAtMax)) ? 0.5 : 1 }} onClick={submitScore} disabled={submitting || (scoringMode === "live" && !liveAtMax)}>
                {submitting ? "Submitting..." : scoringMode === "live" && !liveAtMax ? "Keep scoring (" + (total - liveTotalPlayed) + " remaining)" : "Submit score"}
              </button>
              {submitError && <div style={st.errorBox}>{submitError}</div>}
              {upcomingBlock}
            </>
          )}
        </>
      );
    }
  }

  const showWatchButton = !!selectedPlayer && session?.status === "ACTIVE";

  async function handleOpenOnWatch() {
    const watchUrl = `${window.location.origin}/watch/${code}?pid=${selectedPlayer!.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: "EasyPadelScore Watch", url: watchUrl }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(watchUrl); } catch {}
      setShowWatchToast(true);
      setTimeout(() => setShowWatchToast(false), 2000);
    }
  }

  return (
    <div style={st.page}><div style={st.card}>
      <div style={st.row}>
        <div><div style={st.title}>Hi, {selectedPlayer.name}</div><div style={st.sub}>Session {code} · {session ? formatLabel(session.format) : ""}</div>{session?.name && <div style={{ fontSize: 15, fontWeight: 900, color: WHITE, opacity: 0.85, marginTop: 2 }}>{session.name}</div>}</div>
        {!sessionComplete && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button style={showLeaderboard ? st.btnActive : st.btn} onClick={() => setShowLeaderboard((v) => !v)}>🏅</button>
            <button style={st.btn} onClick={changeName}>Change</button>
          </div>
        )}
      </div>
      {leaderboardPanel}
      <div style={st.divider} />
      {statusBlock}
      {showWatchButton && (
        <button
          onClick={handleOpenOnWatch}
          style={{ borderRadius: 14, padding: "12px 16px", fontSize: 14, fontWeight: 900, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: WHITE, display: "flex", alignItems: "center", gap: 8, marginTop: 12, width: "100%" }}
        >
          <span style={{ fontSize: 16 }}>⌚</span> Open on Watch
        </button>
      )}
      {showWatchToast && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.8)", color: WHITE, padding: "8px 16px", borderRadius: 20, fontSize: 13, zIndex: 9999, whiteSpace: "nowrap" }}>
          Link copied!
        </div>
      )}
    </div></div>
  );
}