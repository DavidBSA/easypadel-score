"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";
const GREEN = "#00C851";
const RED = "#FF4040";

// ─── Tennis scoring types (mirrors app/match/page.tsx) ───────────────────────
type DeuceMode = "star" | "golden" | "traditional";
type MatchRules = { deuceMode: DeuceMode; tiebreak: boolean; superTiebreak: boolean };
type TennisPayload = { sets: number; rules: MatchRules };
type TTeam = "A" | "B";
type TSnap = {
  gamesA: number; gamesB: number;
  setsA: number; setsB: number;
  setIndex: number;
  pA: number; pB: number;
  adTeam: TTeam | null;
  deuceCount: number;
  isTiebreak: boolean; tiebreakTarget: number;
  tbA: number; tbB: number; tbPointNumber: number;
  tbServingTeam: TTeam; tbPointsLeftInTurn: number;
  servingTeam: TTeam; nextServerA: 0 | 1; nextServerB: 0 | 1;
  matchOver: boolean; winner: TTeam | null;
};

const T0: TSnap = {
  gamesA: 0, gamesB: 0, setsA: 0, setsB: 0, setIndex: 0,
  pA: 0, pB: 0, adTeam: null, deuceCount: 0,
  isTiebreak: false, tiebreakTarget: 7,
  tbA: 0, tbB: 0, tbPointNumber: 0, tbServingTeam: "A", tbPointsLeftInTurn: 1,
  servingTeam: "A", nextServerA: 0, nextServerB: 0,
  matchOver: false, winner: null,
};

// ─── Tennis helpers ───────────────────────────────────────────────────────────
function setsToWin(n: number) { return Math.ceil(n / 2); }
function isFinalSet(idx: number, total: number) { return idx === total - 1; }
function shouldUseSuperTB(tp: TennisPayload, idx: number) {
  return tp.rules.superTiebreak && isFinalSet(idx, tp.sets) && tp.sets > 1;
}
function tbWinner(a: number, b: number, target: number): TTeam | null {
  if ((a >= target || b >= target) && Math.abs(a - b) >= 2) return a > b ? "A" : "B";
  return null;
}
function normalSetWinner(a: number, b: number): TTeam | null {
  if ((a >= 6 || b >= 6) && Math.abs(a - b) >= 2) return a > b ? "A" : "B";
  return null;
}
function tog(v: 0 | 1): 0 | 1 { return v === 0 ? 1 : 0; }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function checkMatchWinner(s: TSnap, tp: TennisPayload): TSnap {
  const needed = setsToWin(tp.sets);
  if (s.setsA >= needed) return { ...s, matchOver: true, winner: "A" };
  if (s.setsB >= needed) return { ...s, matchOver: true, winner: "B" };
  return s;
}

function startTiebreak(s: TSnap, target: number): TSnap {
  return { ...s, isTiebreak: true, tiebreakTarget: target, tbA: 0, tbB: 0, tbPointNumber: 0, tbServingTeam: s.servingTeam, tbPointsLeftInTurn: 1, pA: 0, pB: 0, adTeam: null, deuceCount: 0 };
}

function rotateServeAfterGame(s: TSnap): TSnap {
  if (s.servingTeam === "A") return { ...s, nextServerA: tog(s.nextServerA), servingTeam: "B" };
  return { ...s, nextServerB: tog(s.nextServerB), servingTeam: "A" };
}

function rotateServeAfterTBPoint(s: TSnap): TSnap {
  const rem = s.tbPointsLeftInTurn - 1;
  if (rem > 0) return { ...s, tbPointsLeftInTurn: rem };
  const newTeam: TTeam = s.tbServingTeam === "A" ? "B" : "A";
  const n = { ...s, tbServingTeam: newTeam, tbPointsLeftInTurn: 2 };
  if (newTeam === "A") n.nextServerA = tog(n.nextServerA);
  else n.nextServerB = tog(n.nextServerB);
  return n;
}

function winGame(s: TSnap, w: TTeam, tp: TennisPayload): TSnap {
  let n: TSnap = { ...s };
  if (w === "A") n.gamesA += 1; else n.gamesB += 1;
  n.pA = 0; n.pB = 0; n.adTeam = null; n.deuceCount = 0;
  n = rotateServeAfterGame(n);
  const sw = normalSetWinner(n.gamesA, n.gamesB);
  if (sw) {
    if (sw === "A") n.setsA += 1; else n.setsB += 1;
    n.gamesA = 0; n.gamesB = 0; n.isTiebreak = false; n.tiebreakTarget = 7;
    n.tbA = 0; n.tbB = 0; n.tbPointNumber = 0; n.tbServingTeam = n.servingTeam; n.tbPointsLeftInTurn = 1;
    n.setIndex += 1;
    n = checkMatchWinner(n, tp);
    if (!n.matchOver && shouldUseSuperTB(tp, n.setIndex)) n = startTiebreak(n, 10);
    return n;
  }
  if (tp.rules.tiebreak && !shouldUseSuperTB(tp, s.setIndex) && n.gamesA === 6 && n.gamesB === 6) {
    n = startTiebreak(n, 7);
  }
  return n;
}

function winTBAsSet(s: TSnap, w: TTeam, tp: TennisPayload): TSnap {
  let n: TSnap = { ...s };
  if (w === "A") n.setsA += 1; else n.setsB += 1;
  n.isTiebreak = false; n.tiebreakTarget = 7; n.tbA = 0; n.tbB = 0; n.tbPointNumber = 0; n.tbPointsLeftInTurn = 1;
  n.gamesA = 0; n.gamesB = 0; n.pA = 0; n.pB = 0; n.adTeam = null; n.deuceCount = 0;
  n.setIndex += 1;
  n = checkMatchWinner(n, tp);
  if (!n.matchOver && shouldUseSuperTB(tp, n.setIndex)) n = startTiebreak(n, 10);
  return n;
}

function addTennisPoint(prev: TSnap, team: TTeam, tp: TennisPayload): TSnap {
  if (prev.matchOver) return prev;
  if (prev.isTiebreak) {
    let n: TSnap = { ...prev };
    if (team === "A") n.tbA += 1; else n.tbB += 1;
    n.tbPointNumber += 1;
    n = rotateServeAfterTBPoint(n);
    const w = tbWinner(n.tbA, n.tbB, n.tiebreakTarget);
    if (w) n = winTBAsSet(n, w, tp);
    return n;
  }
  const mode = tp.rules.deuceMode;
  if (prev.pA >= 3 && prev.pB >= 3) {
    if (mode === "golden") return winGame(prev, team, tp);
    if (mode === "star") {
      if (prev.adTeam === null) return { ...prev, adTeam: team };
      if (prev.adTeam === team) return winGame(prev, team, tp);
      const dc = prev.deuceCount + 1;
      return { ...prev, adTeam: null, deuceCount: dc };
    }
    if (prev.adTeam === null) return { ...prev, adTeam: team };
    if (prev.adTeam === team) return winGame(prev, team, tp);
    return { ...prev, adTeam: null };
  }
  let n: TSnap = { ...prev };
  if (team === "A") n.pA += 1; else n.pB += 1;
  if (n.pA >= 4 && n.pB <= 2) return winGame(prev, "A", tp);
  if (n.pB >= 4 && n.pA <= 2) return winGame(prev, "B", tp);
  if (n.pA >= 3 && n.pB >= 3) {
    if (mode === "star" && n.deuceCount >= 2) return winGame({ ...n }, team, tp);
    if (mode === "golden") return winGame({ ...n }, team, tp);
  }
  return n;
}

function getScoreDisplay(s: TSnap): { a: string; b: string } {
  if (s.isTiebreak) return { a: String(s.tbA), b: String(s.tbB) };
  const map = ["0", "15", "30", "40"];
  if (s.pA >= 3 && s.pB >= 3) {
    if (s.adTeam === "A") return { a: "AD", b: "40" };
    if (s.adTeam === "B") return { a: "40", b: "AD" };
    return { a: "40", b: "40" };
  }
  return { a: map[clamp(s.pA, 0, 3)], b: map[clamp(s.pB, 0, 3)] };
}

// ─── Session types ────────────────────────────────────────────────────────────
type Player = { id: string; name: string; isActive: boolean };
type ScoreSubmission = { id: string; deviceId: string; pointsA: number; pointsB: number; submittedAt: string };
type Match = {
  id: string; queuePosition: number; courtNumber: number | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE";
  teamAPlayer1: string; teamAPlayer2: string;
  teamBPlayer1: string; teamBPlayer2: string;
  pointsA: number | null; pointsB: number | null;
  scoreStatus: "PENDING" | "CONFIRMED" | "CONFLICT" | null;
  scoreSubmissions: ScoreSubmission[];
  startedAt: string | null; completedAt: string | null;
};
type Session = {
  id: string; code: string; format: "SINGLE" | "MIXED" | "TEAM";
  status: "LOBBY" | "ACTIVE" | "COMPLETE";
  courts: number; pointsPerMatch: number; servesPerRotation: number | null;
  maxPlayers: number | null;
  players: Player[]; matches: Match[];
};
type LeaderRow = {
  playerId: string; name: string;
  played: number; wins: number; draws: number; losses: number;
  pointsFor: number; pointsAgainst: number; diff: number;
};
type CourtScore = { pA: number | null };

function formatLabel(f: "SINGLE" | "MIXED" | "TEAM"): string {
  if (f === "SINGLE") return "Single Match";
  if (f === "MIXED") return "Mixed Americano";
  return "Team Americano";
}

function pill(label: string, bg: string, border: string, onClick?: () => void): React.ReactNode {
  return (
    <span onClick={onClick} style={{
      display: "inline-block", borderRadius: 999, padding: "4px 10px",
      fontSize: 11, fontWeight: 1000, background: bg, border: `1px solid ${border}`, color: WHITE,
      cursor: onClick ? "pointer" : "default",
    }}>
      {label}
    </span>
  );
}

export default function OrganiserPage() {
  const params = useParams();
  const code = (Array.isArray(params?.code) ? params.code[0] : params?.code ?? "") as string;
  const router = useRouter();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">("idle");
  const [shareQRStatus, setShareQRStatus] = useState<"idle" | "loading" | "shared" | "copied">("idle");
  const [showQR, setShowQR] = useState(false);

  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState("");

  const [singleAssignment, setSingleAssignment] = useState<{ teamA: string[]; teamB: string[] }>({ teamA: [], teamB: [] });

  const [resolving, setResolving] = useState<Record<string, { pA: number; pB: number }>>({});
  const [resolveLoading, setResolveLoading] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState<string | null>(null);

  const [courtScores, setCourtScores] = useState<Record<string, CourtScore>>({});
  const [submitLoading, setSubmitLoading] = useState<string | null>(null);

  // ─── Tennis scoring state (SINGLE format) ─────────────────────────────────
  const [tennisState, setTennisState] = useState<TSnap>(T0);
  const [tennisHistory, setTennisHistory] = useState<TSnap[]>([]);
  const [showServeHelper, setShowServeHelper] = useState(true);
  const [tennisPayload, setTennisPayload] = useState<TennisPayload | null>(null);
  const scoreSubmittedRef = useRef(false);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!code) return;
    try {
      const stored = localStorage.getItem(`eps_join_${code}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.isOrganiser && parsed.deviceId) setDeviceId(parsed.deviceId);
      }
    } catch { /* ignore */ }
    // Load tennis rules for SINGLE
    try {
      const rules = localStorage.getItem(`eps_match_rules_${code}`);
      if (rules) setTennisPayload(JSON.parse(rules));
    } catch { /* ignore */ }
    // Load persisted tennis state
    try {
      const ts = localStorage.getItem(`eps_tennis_${code}`);
      if (ts) setTennisState(JSON.parse(ts));
    } catch { /* ignore */ }
    setBootstrapped(true);
  }, [code]);

  // Persist tennis state on every change
  useEffect(() => {
    if (!code) return;
    localStorage.setItem(`eps_tennis_${code}`, JSON.stringify(tennisState));
  }, [tennisState, code]);

  // Auto-submit score to DB when tennis match ends
  useEffect(() => {
    if (!tennisState.matchOver || scoreSubmittedRef.current || !deviceId || !session) return;
    const match = session.matches.find((m) => m.status === "IN_PROGRESS" || m.status === "PENDING");
    if (!match) return;
    scoreSubmittedRef.current = true;
    fetch(`/api/matches/${match.id}/score`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, pointsA: tennisState.setsA, pointsB: tennisState.setsB, isOrganiserOverride: true }),
    }).catch(() => { scoreSubmittedRef.current = false; });
  }, [tennisState.matchOver, deviceId, session]);

  const applySession = useCallback((data: Session) => {
    setSession(data);
    setResolving((prev) => {
      const next = { ...prev };
      for (const m of data.matches) {
        if (m.scoreStatus === "CONFLICT" && !(m.id in next)) {
          next[m.id] = { pA: m.pointsA ?? 0, pB: m.pointsB ?? 0 };
        }
      }
      return next;
    });
    setCourtScores((prev) => {
      const next = { ...prev };
      for (const m of data.matches) {
        if (m.status === "IN_PROGRESS" && !(m.id in next)) {
          next[m.id] = { pA: null };
        }
      }
      return next;
    });
    if (data.format === "SINGLE") {
      const validIds = new Set(data.players.map((p) => p.id));
      setSingleAssignment((prev) => ({
        teamA: prev.teamA.filter((id) => validIds.has(id)),
        teamB: prev.teamB.filter((id) => validIds.has(id)),
      }));
    }
  }, []);

  useEffect(() => {
    if (!deviceId || !code) return;
    fetch(`/api/sessions/${code}`)
      .then((r) => r.json()).then(applySession)
      .catch(() => setSessionError("Failed to load session."));
    const es = new EventSource(`/api/sessions/${code}/stream`);
    esRef.current = es;
    es.onmessage = (e) => { try { applySession(JSON.parse(e.data)); } catch { /* ignore */ } };
    es.onerror = () => {
      es.close();
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          fetch(`/api/sessions/${code}`).then((r) => r.json()).then(applySession).catch(() => { });
        }, 3000);
      }
    };
    return () => {
      es.close();
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [deviceId, code, applySession]);

  function toggleSingleAssign(playerId: string) {
    setSingleAssignment((prev) => {
      const inA = prev.teamA.includes(playerId);
      const inB = prev.teamB.includes(playerId);
      if (inA) return { ...prev, teamA: prev.teamA.filter((id) => id !== playerId) };
      if (inB) return { ...prev, teamB: prev.teamB.filter((id) => id !== playerId) };
      if (prev.teamA.length < 2) return { ...prev, teamA: [...prev.teamA, playerId] };
      if (prev.teamB.length < 2) return { ...prev, teamB: [...prev.teamB, playerId] };
      return prev;
    });
  }

  async function addPlayerManually() {
    const name = addName.trim();
    if (!name || !deviceId) return;
    setAddLoading(true); setAddError("");
    try {
      const r = await fetch(`/api/sessions/${code}/players`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, playerName: name }),
      });
      const data = await r.json();
      if (!r.ok) { setAddError(data.message ?? data.error ?? "Could not add player."); setAddLoading(false); return; }
      setAddName("");
    } catch { setAddError("Network error."); }
    setAddLoading(false);
  }

  async function lockAndStart() {
    if (!deviceId) return;
    setStartLoading(true); setStartError("");
    try {
      const isSingleFormat = session?.format === "SINGLE";
      const body: Record<string, unknown> = { deviceId };
      if (isSingleFormat) { body.teamA = singleAssignment.teamA; body.teamB = singleAssignment.teamB; }
      const r = await fetch(`/api/sessions/${code}/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { setStartError(data.error ?? "Could not start session."); setStartLoading(false); return; }
    } catch { setStartError("Network error."); }
    setStartLoading(false);
  }

  async function startMatch(matchId: string, courtNumber: number) {
    if (!deviceId) return;
    await fetch(`/api/matches/${matchId}/start`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courtNumber, deviceId }),
    });
  }

  async function confirmScore(matchId: string) {
    if (!deviceId) return;
    setConfirmLoading(matchId);
    try {
      await fetch(`/api/matches/${matchId}/score`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, isOrganiserConfirm: true }),
      });
    } finally { setConfirmLoading(null); }
  }

  async function resolveConflict(matchId: string) {
    if (!deviceId) return;
    const { pA, pB } = resolving[matchId] ?? { pA: 0, pB: 0 };
    setResolveLoading(matchId);
    try {
      await fetch(`/api/matches/${matchId}/score`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, pointsA: pA, pointsB: pB, isOrganiserOverride: true }),
      });
    } finally { setResolveLoading(null); }
  }

  async function submitCourtScore(matchId: string, ppm: number) {
    if (!deviceId) return;
    const cs = courtScores[matchId];
    if (cs?.pA === null || cs?.pA === undefined) return;
    const pA = cs.pA; const pB = ppm - pA;
    setSubmitLoading(matchId);
    try {
      await fetch(`/api/matches/${matchId}/score`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, pointsA: pA, pointsB: pB, isOrganiserOverride: true }),
      });
      setCourtScores((prev) => ({ ...prev, [matchId]: { pA: null } }));
    } finally { setSubmitLoading(null); }
  }

  function adjustCourtScore(matchId: string, delta: number, ppm: number) {
    setCourtScores((prev) => {
      const current = prev[matchId]?.pA ?? 0;
      const next = Math.max(0, Math.min(ppm, current + delta));
      return { ...prev, [matchId]: { pA: next } };
    });
  }

  // ─── Tennis actions ────────────────────────────────────────────────────────
  function tennisAddPoint(team: TTeam) {
    if (!tennisPayload) return;
    setTennisHistory((h) => [...h, tennisState]);
    setTennisState((prev) => addTennisPoint(prev, team, tennisPayload));
  }
  function tennisUndo() {
    setTennisHistory((h) => {
      if (h.length === 0) return h;
      setTennisState(h[h.length - 1]);
      scoreSubmittedRef.current = false;
      return h.slice(0, -1);
    });
  }
  function tennisReset() {
    setTennisHistory([]);
    setTennisState(T0);
    scoreSubmittedRef.current = false;
    localStorage.removeItem(`eps_tennis_${code}`);
  }
  function tennisRandomServer() {
    const t: TTeam = Math.random() < 0.5 ? "A" : "B";
    const a: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    const b: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    setTennisHistory((h) => [...h, tennisState]);
    setTennisState((prev) => ({ ...prev, servingTeam: t, nextServerA: a, nextServerB: b }));
  }

  function getJoinUrl() {
    return typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : `/join?code=${code}`;
  }

  async function shareLink() {
    const url = getJoinUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Join my padel session", text: `Join EasyPadelScore — code: ${code}`, url }); setShareStatus("shared"); setTimeout(() => setShareStatus("idle"), 2500); return; } catch (err: unknown) { if (err instanceof Error && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); setShareStatus("copied"); setTimeout(() => setShareStatus("idle"), 2500); } catch { /* ignore */ }
  }

  async function shareQR() {
    const url = getJoinUrl();
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&bgcolor=0D1B2A&color=FFFFFF&margin=16`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        setShareQRStatus("loading");
        const resp = await fetch(qrUrl); const blob = await resp.blob();
        const file = new File([blob], `EasyPadelScore-${code}.png`, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: "Join my padel session", text: `Scan to join session ${code}`, files: [file] });
          setShareQRStatus("shared"); setTimeout(() => setShareQRStatus("idle"), 2500); return;
        }
      } catch (err: unknown) { if (err instanceof Error && err.name === "AbortError") { setShareQRStatus("idle"); return; } }
      try { await navigator.share({ title: "Join my padel session", text: `Scan to join session ${code}`, url: qrUrl }); setShareQRStatus("shared"); setTimeout(() => setShareQRStatus("idle"), 2500); return; } catch (err: unknown) { if (err instanceof Error && err.name === "AbortError") { setShareQRStatus("idle"); return; } }
    }
    try { await navigator.clipboard.writeText(url); setShareQRStatus("copied"); setTimeout(() => setShareQRStatus("idle"), 2500); } catch { setShareQRStatus("idle"); }
  }

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 720, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", marginTop: 12 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" as const },
    title: { fontSize: 22, fontWeight: 1000 },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 0" },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 16, marginBottom: 10 },
    btn: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnOrange: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, whiteSpace: "nowrap" as const },
    btnGreen: { borderRadius: 14, padding: "14px 20px", fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: GREEN, color: WHITE, whiteSpace: "nowrap" as const },
    btnConfirm: { borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", background: GREEN, color: WHITE, whiteSpace: "nowrap" as const, marginTop: 10, width: "100%" },
    courtCard: { borderRadius: 16, padding: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 },
    conflictCard: { borderRadius: 16, padding: 14, background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.3)", marginBottom: 10 },
    queueCard: { borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 10 },
    stepBtn: { width: 44, height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.09)", color: WHITE, fontSize: 22, fontWeight: 1000, cursor: "pointer", flexShrink: 0 },
    val: { fontSize: 22, fontWeight: 1100, minWidth: 32, textAlign: "center" as const },
    names: { fontWeight: 900, fontSize: 14, lineHeight: 1.4 },
    pinInput: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "14px 12px", fontSize: 20, fontWeight: 900, textAlign: "center" as const, outline: "none", boxSizing: "border-box" as const },
    errorBox: { marginTop: 10, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    pillsRow: { display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 12 },
    shareCard: { marginTop: 12, borderRadius: 16, padding: 14, background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.22)" },
    shareTop: { display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" as const },
    codeBlock: { fontSize: 28, fontWeight: 1150, color: ORANGE, letterSpacing: 4, lineHeight: 1 },
    shareButtons: { display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" },
    btnShare: { borderRadius: 14, padding: "11px 16px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, whiteSpace: "nowrap" as const },
    btnShareSecondary: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    qrWrap: { marginTop: 12, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 10 },
    addRow: { display: "flex", gap: 10, alignItems: "center" },
    addInput: { flex: 1, background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 900, outline: "none" },
    playerPill: { borderRadius: 12, padding: "8px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 14, fontWeight: 900, color: WHITE },
    lobbyCard: { borderRadius: 18, padding: 18, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" },
    startSection: { marginTop: 16, borderRadius: 16, padding: 16, background: "rgba(0,200,80,0.06)", border: "1px solid rgba(0,200,80,0.20)", display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const },
    lbWrap: { marginTop: 4, borderRadius: 18, padding: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8 },
    lbHead: { display: "grid", gridTemplateColumns: "40px 1fr 90px 110px 64px", gap: 8, fontSize: 11, opacity: 0.5, fontWeight: 950, padding: "0 10px", textTransform: "uppercase" as const, letterSpacing: 0.5 },
    lbRow: { display: "grid", gridTemplateColumns: "40px 1fr 90px 110px 64px", gap: 8, alignItems: "center", borderRadius: 12, padding: "10px 10px" },
    lbRight: { textAlign: "right" as const },
    lbCenter: { textAlign: "center" as const },
    hint: { fontSize: 12, opacity: 0.55, color: WARM_WHITE, lineHeight: 1.4 },
    teamPairCard: { borderRadius: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 10, alignItems: "center" },
    // Tennis-specific
    tennisBoard: { background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 14 },
    tennisBoardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    tennisScoreRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 },
    tennisScoreBox: { borderRadius: 12, padding: "8px 6px", background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" as const },
    tennisScoreLabel: { fontSize: 10, opacity: 0.5, fontWeight: 950, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    tennisScoreBig: { fontSize: 38, fontWeight: 1150, letterSpacing: 0.4, lineHeight: 1, color: WHITE },
    tennisScoreMid: { fontSize: 22, fontWeight: 1000, lineHeight: 1.1, marginTop: 2, color: WHITE },
    tennisControls: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 },
    tennisBtnA: { borderRadius: 16, border: "none", padding: "22px 14px", fontSize: 20, fontWeight: 1100, cursor: "pointer", background: ORANGE, color: WHITE },
    tennisBtnB: { borderRadius: 16, padding: "22px 14px", fontSize: 20, fontWeight: 1100, cursor: "pointer", background: "rgba(255,255,255,0.08)", color: WHITE, border: "1px solid rgba(255,255,255,0.16)" },
    tennisActionRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 },
    tennisSmallBtn: { borderRadius: 14, padding: "13px 10px", fontSize: 14, fontWeight: 1000, cursor: "pointer", background: "rgba(255,255,255,0.06)", color: WHITE, border: "1px solid rgba(255,255,255,0.12)" },
    tennisWinnerBanner: { borderRadius: 18, padding: 20, background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.35)", textAlign: "center" as const },
    tennisChipRow: { display: "flex", gap: 8, flexWrap: "wrap" as const, justifyContent: "flex-end" },
    serveReminder: { marginTop: 12, borderRadius: 14, padding: "10px 14px", background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.22)", fontSize: 12, fontWeight: 900, color: WHITE, lineHeight: 1.5 },
    starPointBanner: { borderRadius: 14, padding: "10px 14px", background: "rgba(255,107,0,0.10)", border: "1px solid rgba(255,107,0,0.30)", fontSize: 13, fontWeight: 1000, color: ORANGE, textAlign: "center" as const, marginBottom: 10 },
  };

  const tennisTeamCard = (serving: boolean): React.CSSProperties => ({
    borderRadius: 16, padding: 14,
    background: serving ? "rgba(255,107,0,0.10)" : "rgba(255,255,255,0.04)",
    border: serving ? "1px solid rgba(255,107,0,0.45)" : "1px solid rgba(255,255,255,0.08)",
  });

  const tennisChip = (active: boolean): React.CSSProperties => ({
    padding: "9px 14px", borderRadius: 999,
    border: active ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,107,0,0.14)" : "rgba(255,255,255,0.06)",
    color: WHITE, fontWeight: 1000, cursor: "pointer", fontSize: 13,
  });

  if (!bootstrapped) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading…</div></div></div>;

   if (!session) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading session…{sessionError && ` — ${sessionError}`}</div></div></div>;

  const nameById = session.players.reduce<Record<string, string>>((m, p) => { m[p.id] = p.name; return m; }, {});
  function names(m: Match) {
    return { a1: nameById[m.teamAPlayer1] ?? "?", a2: nameById[m.teamAPlayer2] ?? "?", b1: nameById[m.teamBPlayer1] ?? "?", b2: nameById[m.teamBPlayer2] ?? "?" };
  }

  const isSingle = session.format === "SINGLE";
  const isTeam = session.format === "TEAM";
  const minPlayers = isSingle ? 4 : session.courts * 4;
  const canStart = isSingle
    ? singleAssignment.teamA.length === 2 && singleAssignment.teamB.length === 2
    : session.players.length >= minPlayers;
  const canWebShare = typeof navigator !== "undefined" && !!navigator.share;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getJoinUrl())}&bgcolor=0D1B2A&color=FFFFFF&margin=10`;
  const fLabel = formatLabel(session.format);

  const shareLinkLabel = shareStatus === "shared" ? "✓ Shared!" : shareStatus === "copied" ? "✓ Copied!" : "⬆ Share link";
  const shareQRLabel = shareQRStatus === "loading" ? "Loading…" : shareQRStatus === "shared" ? "✓ Shared!" : shareQRStatus === "copied" ? "✓ Link copied" : "Share QR";

  const shareCard = session.status === "LOBBY" ? (
    <div style={st.shareCard}>
      <div style={st.shareTop}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, fontWeight: 1000, opacity: 0.5, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 6 }}>Session code</div>
          <div style={st.codeBlock}>{code}</div>
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>Players join at <strong>/join</strong></div>
        </div>
        <div style={st.shareButtons}>
          <button style={{ ...st.btnShare, background: shareStatus !== "idle" ? "rgba(0,200,80,0.85)" : ORANGE }} onClick={shareLink}>
            {canWebShare ? "⬆" : "📋"} {shareLinkLabel}
          </button>
          <button style={{ ...st.btnShareSecondary, borderColor: showQR ? "rgba(255,107,0,0.45)" : "rgba(255,255,255,0.20)", background: showQR ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.07)" }} onClick={() => setShowQR((v) => !v)}>
            QR {showQR ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {showQR && (
        <div style={st.qrWrap}>
          <img src={qrUrl} alt={`Join ${code}`} width={160} height={160} style={{ borderRadius: 14, display: "block" }} />
          <button style={{ ...st.btnShareSecondary, background: shareQRStatus !== "idle" ? "rgba(0,200,80,0.15)" : "rgba(255,255,255,0.07)", borderColor: shareQRStatus !== "idle" ? "rgba(0,200,80,0.45)" : "rgba(255,255,255,0.20)", opacity: shareQRStatus === "loading" ? 0.6 : 1 }}
            onClick={shareQR} disabled={shareQRStatus === "loading"}>
            {canWebShare ? "⬆" : "📋"} {shareQRLabel}
          </button>
          <div style={st.hint}>Scan to join on any phone</div>
        </div>
      )}
    </div>
  ) : null;

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (session.status === "LOBBY") {
    const teamPairs: { p1: string; p2: string }[] = [];
    if (isTeam) {
      for (let i = 0; i + 1 < session.players.length; i += 2) {
        teamPairs.push({ p1: session.players[i].name, p2: session.players[i + 1].name });
      }
    }
    const assignedIds = new Set([...singleAssignment.teamA, ...singleAssignment.teamB]);
    const unassigned = session.players.filter((p) => !assignedIds.has(p.id));
    const bothTeamsFull = singleAssignment.teamA.length === 2 && singleAssignment.teamB.length === 2;
    const startHint = isSingle
      ? "Assign 2 players to each team, then lock to start."
      : isTeam
      ? "Players are paired in join order (1st+2nd, 3rd+4th…). Locking entries generates the full match queue."
      : "Locking entries generates the full match queue.";
    const startLabel = canStart && !startLoading ? "Lock & Start →" : startLoading ? "Starting…" : isSingle ? "Assign all 4 players to teams" : `Need ${minPlayers - session.players.length} more player${minPlayers - session.players.length !== 1 ? "s" : ""}`;
    const slotStyle = (filled: boolean): React.CSSProperties => ({
      borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 900,
      background: filled ? "rgba(255,107,0,0.14)" : "rgba(255,255,255,0.03)",
      border: filled ? "1px solid rgba(255,107,0,0.40)" : "1px dashed rgba(255,255,255,0.18)",
      color: filled ? WHITE : "rgba(255,255,255,0.25)",
      cursor: filled ? "pointer" : "default",
      minHeight: 42, display: "flex", alignItems: "center",
    });
    const unassignedChipStyle = (disabled: boolean): React.CSSProperties => ({
      borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 900,
      background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.14)",
      color: disabled ? "rgba(255,255,255,0.3)" : WHITE,
      cursor: disabled ? "default" : "pointer",
    });

    return (
      <div style={st.page}>
        <div style={st.card}>
          <div style={st.row}>
            <div>
              <div style={st.title}>Organiser · {code}</div>
              <div style={st.sub}>{fLabel} · {isSingle ? "1 court" : `${session.courts} court${session.courts > 1 ? "s" : ""}`} · {session.pointsPerMatch} pts · Waiting for players</div>
            </div>
            <button style={st.btn} onClick={() => router.push("/")}>Home</button>
          </div>
          <div style={st.pillsRow}>
            {pill(`${session.players.length} joined`, "rgba(255,107,0,0.18)", "rgba(255,107,0,0.45)")}
            {isSingle ? pill("4 players needed", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)") : pill(`${minPlayers} needed to start`, "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)")}
            </div>
          {shareCard}
          <div style={st.divider} />
          {isSingle ? (
            <>
              <div style={st.sectionLabel}>Assign teams</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ borderRadius: 14, padding: 14, background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.22)" }}>
                  <div style={{ fontSize: 12, fontWeight: 1000, color: ORANGE, marginBottom: 10, letterSpacing: 0.5 }}>TEAM A</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {[0, 1].map((slot) => {
                      const pid = singleAssignment.teamA[slot]; const name = pid ? nameById[pid] : null;
                      return <div key={slot} style={slotStyle(!!name)} onClick={() => pid && toggleSingleAssign(pid)}>{name ?? `Player ${slot + 1}`}{name && <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.5 }}>✕</span>}</div>;
                    })}
                  </div>
                </div>
                <div style={{ borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  <div style={{ fontSize: 12, fontWeight: 1000, color: WARM_WHITE, marginBottom: 10, letterSpacing: 0.5 }}>TEAM B</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {[0, 1].map((slot) => {
                      const pid = singleAssignment.teamB[slot]; const name = pid ? nameById[pid] : null;
                      return <div key={slot} style={slotStyle(!!name)} onClick={() => pid && toggleSingleAssign(pid)}>{name ?? `Player ${slot + 1}`}{name && <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.5 }}>✕</span>}</div>;
                    })}
                  </div>
                </div>
              </div>
              {session.players.length === 0 ? (
                <div style={{ ...st.hint, marginTop: 12 }}>No players yet — share the code above.</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 1000, opacity: 0.4, textTransform: "uppercase" as const, letterSpacing: 1.2, marginTop: 14, marginBottom: 8 }}>
                    {unassigned.length > 0 ? "Unassigned — tap to assign" : bothTeamsFull ? "✓ All players assigned" : "Waiting for more players…"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                    {unassigned.map((p) => {
                      const full = singleAssignment.teamA.length === 2 && singleAssignment.teamB.length === 2;
                      return <div key={p.id} style={unassignedChipStyle(full)} onClick={() => !full && toggleSingleAssign(p.id)}>{p.name}</div>;
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div style={st.sectionLabel}>{isTeam ? "Players — paired in join order" : `Players — ${session.players.length}${session.maxPlayers !== null ? ` / ${session.maxPlayers}` : ""}`}</div>
              <div style={st.lobbyCard}>
                {session.players.length === 0 ? (
                  <div style={st.hint}>No players yet — share the code above.</div>
                ) : isTeam && teamPairs.length > 0 ? (
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                    {teamPairs.map((tp, i) => (
                      <div key={i} style={st.teamPairCard}>
                        <div style={{ fontSize: 12, fontWeight: 1000, color: ORANGE, minWidth: 24 }}>T{i + 1}</div>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>{tp.p1} &amp; {tp.p2}</div>
                      </div>
                    ))}
                    {session.players.length % 2 !== 0 && (
                      <div style={{ ...st.teamPairCard, opacity: 0.5 }}>
                        <div style={{ fontSize: 12, fontWeight: 1000, color: ORANGE, minWidth: 24 }}>…</div>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>{session.players[session.players.length - 1].name} — waiting for partner</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                    {session.players.map((p) => <div key={p.id} style={st.playerPill}>{p.name}</div>)}
                  </div>
                )}
              </div>
            </>
          )}
          <div style={st.sectionLabel}>Add player manually</div>
          <div style={st.addRow}>
            <input style={st.addInput} value={addName} placeholder="Player name" maxLength={30}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addPlayerManually(); }} />
            <button style={{ ...st.btnOrange, opacity: addLoading ? 0.5 : 1 }} onClick={addPlayerManually} disabled={addLoading}>
              {addLoading ? "Adding…" : "Add"}
            </button>
          </div>
          {addError && <div style={st.errorBox}>{addError}</div>}
          <div style={st.startSection}>
            <div>
              <div style={{ fontWeight: 1000, fontSize: 15 }}>{canStart ? "Ready to start!" : startLabel}</div>
              <div style={st.hint}>{startHint}</div>
            </div>
            <button style={{ ...st.btnGreen, opacity: canStart && !startLoading ? 1 : 0.4 }} onClick={lockAndStart} disabled={!canStart || startLoading}>
              {startLoading ? "Starting…" : "Lock & Start →"}
            </button>
          </div>
          {startError && <div style={st.errorBox}>{startError}</div>}
        </div>
      </div>
    );
  }

  // ── ACTIVE / COMPLETE ──────────────────────────────────────────────────────
  const ppm = session.pointsPerMatch;
  const inProgress = session.matches.filter((m) => m.status === "IN_PROGRESS");
  const conflicts = session.matches.filter((m) => m.scoreStatus === "CONFLICT");
  const pending = session.matches.filter((m) => m.status === "PENDING");
  const complete = session.matches.filter((m) => m.status === "COMPLETE");
  const courtNumbers = Array.from({ length: session.courts }, (_, i) => i + 1);

  // Subtitle — no pts/serve shown
  const subtitleParts = [fLabel, `${session.players.length} players`, `${session.courts} court${session.courts > 1 ? "s" : ""}`, `${ppm} pts`];

  // ── SINGLE ACTIVE: full tennis scorecard ───────────────────────────────────
  if (isSingle) {
    const singleMatch = session.matches[0];
    const isMatchComplete = singleMatch?.status === "COMPLETE" || singleMatch?.scoreStatus === "CONFIRMED";

    // Get player names from the match
    const a1n = singleMatch ? (nameById[singleMatch.teamAPlayer1] ?? "A1") : "A1";
    const a2n = singleMatch ? (nameById[singleMatch.teamAPlayer2] ?? "A2") : "A2";
    const b1n = singleMatch ? (nameById[singleMatch.teamBPlayer1] ?? "B1") : "B1";
    const b2n = singleMatch ? (nameById[singleMatch.teamBPlayer2] ?? "B2") : "B2";
    const teamAPlayers = [a1n, a2n];
    const teamBPlayers = [b1n, b2n];

    const tp = tennisPayload ?? { sets: 1, rules: { deuceMode: "traditional" as DeuceMode, tiebreak: true, superTiebreak: false } };
    const targetSets = setsToWin(tp.sets);
    const inSuperFinalSet = shouldUseSuperTB(tp, tennisState.setIndex);
    const servingTeamForHighlight: TTeam = tennisState.isTiebreak ? tennisState.tbServingTeam : tennisState.servingTeam;
    const currentServerTeam = tennisState.isTiebreak ? tennisState.tbServingTeam : tennisState.servingTeam;
    const currentServerSlot = currentServerTeam === "A" ? tennisState.nextServerA : tennisState.nextServerB;
    const currentServerName = currentServerTeam === "A" ? teamAPlayers[currentServerSlot] : teamBPlayers[currentServerSlot];
    const scoreDisplay = getScoreDisplay(tennisState);
    const deuceLabel = tp.rules.deuceMode === "golden" ? "Golden point" : tp.rules.deuceMode === "star" ? "Star point (FIP 2026)" : "Traditional advantage";
    const isStarPointMoment = !tennisState.isTiebreak && tp.rules.deuceMode === "star" && tennisState.pA >= 3 && tennisState.pB >= 3 && tennisState.adTeam === null && tennisState.deuceCount >= 2;

    const headerTitle = tennisState.matchOver && tennisState.winner
      ? `${tennisState.winner === "A" ? teamAPlayers.join(" & ") : teamBPlayers.join(" & ")} win!`
      : tennisState.isTiebreak
      ? (tennisState.tiebreakTarget === 10 ? "Super Tiebreak" : "Tiebreak")
      : `Set ${tennisState.setIndex + 1}`;

    return (
      <div style={st.page}>
        <div style={{ ...st.card, maxWidth: 760 }}>

          {/* Top bar */}
          <div style={{ ...st.row, background: NAVY, borderRadius: 16, padding: 14, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 1000, fontSize: 22, letterSpacing: 0.2 }}>{headerTitle}</div>
              <div style={{ fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4 }}>
                Sets {tennisState.setsA} – {tennisState.setsB} · Games {tennisState.gamesA} – {tennisState.gamesB}
                {inSuperFinalSet && !tennisState.matchOver ? " · Super tiebreak" : ""}
              </div>
              {showServeHelper && !tennisState.matchOver && (
                <div style={{ fontSize: 13, marginTop: 6, fontWeight: 1000, color: ORANGE }}>Serving: {currentServerName}</div>
              )}
            </div>
            <div style={st.tennisChipRow}>
              <div style={tennisChip(showServeHelper)} onClick={() => setShowServeHelper((v) => !v)}>Serve helper</div>
              <div style={tennisChip(false)} onClick={tennisRandomServer}>Random server</div>
              <button style={st.btn} onClick={() => router.push("/")}>Home</button>
            </div>
          </div>

          {/* Star point banner */}
          {isStarPointMoment && (
            <div style={st.starPointBanner}>★ Star Point — next point wins the game</div>
          )}

          {/* Score board */}
          <div style={st.tennisBoard}>
            <div style={st.tennisBoardGrid}>
              {(["A", "B"] as TTeam[]).map((team) => {
                const players = team === "A" ? teamAPlayers : teamBPlayers;
                const serving = showServeHelper && servingTeamForHighlight === team;
                const setsVal = team === "A" ? tennisState.setsA : tennisState.setsB;
                const gamesVal = team === "A" ? tennisState.gamesA : tennisState.gamesB;
                const scoreVal = team === "A" ? scoreDisplay.a : scoreDisplay.b;
                return (
                  <div key={team} style={tennisTeamCard(serving)}>
                    <div style={{ fontWeight: 1000, fontSize: 16, marginBottom: 4 }}>Team {team}</div>
                    <div style={{ fontSize: 13, color: WARM_WHITE, opacity: 0.75, lineHeight: 1.4, fontWeight: 800 }}>
                      {players[0]}{showServeHelper && currentServerTeam === team && currentServerSlot === 0 ? " ●" : ""}
                      <br />
                      {players[1]}{showServeHelper && currentServerTeam === team && currentServerSlot === 1 ? " ●" : ""}
                    </div>
                    <div style={st.tennisScoreRow}>
                      <div style={st.tennisScoreBox}>
                        <div style={st.tennisScoreLabel}>Sets</div>
                        <div style={st.tennisScoreMid}>{setsVal}</div>
                      </div>
                      <div style={st.tennisScoreBox}>
                        <div style={st.tennisScoreLabel}>{tennisState.isTiebreak ? "TB" : "Points"}</div>
                        <div style={st.tennisScoreBig}>{scoreVal}</div>
                      </div>
                      <div style={st.tennisScoreBox}>
                        <div style={st.tennisScoreLabel}>Games</div>
                        <div style={st.tennisScoreMid}>{gamesVal}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Winner banner */}
          {tennisState.matchOver && tennisState.winner && (
            <div style={{ ...st.tennisWinnerBanner, marginTop: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 1100, color: ORANGE }}>
                🏆 {tennisState.winner === "A" ? teamAPlayers.join(" & ") : teamBPlayers.join(" & ")} win!
              </div>
              <div style={{ fontSize: 14, color: WARM_WHITE, opacity: 0.7, marginTop: 6 }}>
                {tennisState.setsA} – {tennisState.setsB} sets · Score saved automatically
              </div>
            </div>
          )}

          {/* Point buttons */}
          {!tennisState.matchOver && (
            <div style={st.tennisControls}>
              <button style={st.tennisBtnA} onClick={() => tennisAddPoint("A")}>Point A</button>
              <button style={st.tennisBtnB} onClick={() => tennisAddPoint("B")}>Point B</button>
            </div>
          )}

          {/* Action row */}
          <div style={st.tennisActionRow}>
            <button style={{ ...st.tennisSmallBtn, opacity: tennisHistory.length === 0 ? 0.4 : 1 }} onClick={tennisUndo} disabled={tennisHistory.length === 0}>Undo</button>
            <button style={st.tennisSmallBtn} onClick={tennisReset}>Reset</button>
            <button style={st.btn} onClick={() => router.push("/")}>Home</button>
          </div>

          {/* Footer */}
          <div style={{ fontSize: 12, color: WARM_WHITE, opacity: 0.45, textAlign: "center" as const, paddingTop: 10, lineHeight: 1.5 }}>
            First to {targetSets} set{targetSets > 1 ? "s" : ""} wins · {deuceLabel}
            {tp.rules.tiebreak ? " · Tiebreak at 6-6" : ""}
            {tp.rules.superTiebreak && tp.sets > 1 ? " · Super tiebreak final set" : ""}
          </div>

        </div>
      </div>
    );
  }

  // ── MIXED / TEAM ACTIVE ────────────────────────────────────────────────────
  const leaderboard: LeaderRow[] = (() => {
    const base = new Map<string, LeaderRow>();
    for (const p of session.players) base.set(p.id, { playerId: p.id, name: p.name, played: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 });
    for (const m of complete) {
      const pA = m.pointsA ?? 0; const pB = m.pointsB ?? 0;
      for (const pid of [m.teamAPlayer1, m.teamAPlayer2]) { const r = base.get(pid); if (r) { r.played++; r.pointsFor += pA; r.pointsAgainst += pB; if (pA > pB) r.wins++; else if (pA === pB) r.draws++; else r.losses++; } }
      for (const pid of [m.teamBPlayer1, m.teamBPlayer2]) { const r = base.get(pid); if (r) { r.played++; r.pointsFor += pB; r.pointsAgainst += pA; if (pB > pA) r.wins++; else if (pB === pA) r.draws++; else r.losses++; } }
    }
    return Array.from(base.values()).map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst })).sort((a, b) => b.diff !== a.diff ? b.diff - a.diff : b.pointsFor !== a.pointsFor ? b.pointsFor - a.pointsFor : a.name.localeCompare(b.name));
  })();

  // Serve rotation reminder for Mixed/Team
  const spr = session.servesPerRotation;
  const serveReminderText = spr
    ? `Serve rotation: A1 → B1 → A2 → B2 · ${spr} point${spr > 1 ? "s" : ""} each`
    : null;

  return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={st.row}>
          <div>
            <div style={st.title}>Organiser · {code}</div>
            <div style={st.sub}>{subtitleParts.join(" · ")}</div>
          </div>
          <button style={st.btn} onClick={() => router.push("/")}>Home</button>
        </div>

        <div style={st.pillsRow}>
          {pill(`${inProgress.length} playing`, "rgba(255,107,0,0.18)", "rgba(255,107,0,0.45)")}
          {pill(`${pending.length} queued`, "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)")}
          {pill(`${complete.length} done`, "rgba(0,200,80,0.12)", "rgba(0,200,80,0.35)", complete.length > 0 ? () => router.push(`/session/${code}/organiser/results`) : undefined)}
          {conflicts.length > 0 && pill(`⚠ ${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""}`, "rgba(255,64,64,0.15)", "rgba(255,64,64,0.4)")}
        </div>
        {complete.length > 0 && <div style={{ ...st.hint, marginTop: 6 }}>Tap <strong style={{ color: GREEN }}>{complete.length} done</strong> to view and edit confirmed match scores.</div>}

        {/* Serve rotation reminder */}
        {serveReminderText && (
          <div style={st.serveReminder}>
            🎾 {serveReminderText}
          </div>
        )}

        <div style={st.divider} />

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <>
            <div style={st.sectionLabel}>⚠ Conflicts — enter correct score</div>
            {conflicts.map((m) => {
              const { a1, a2, b1, b2 } = names(m);
              const rv = resolving[m.id] ?? { pA: m.pointsA ?? 0, pB: m.pointsB ?? 0 };
              const updateRv = (patch: Partial<{ pA: number; pB: number }>) => setResolving((prev) => ({ ...prev, [m.id]: { ...rv, ...patch } }));
              return (
                <div key={m.id} style={st.conflictCard}>
                  <div style={st.names}>Court {m.courtNumber} · {a1} & {a2} <span style={{ opacity: 0.5 }}>vs</span> {b1} & {b2}</div>
                  <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>Submitted: {m.scoreSubmissions.map((s) => `${s.pointsA}–${s.pointsB}`).join(" · ")}</div>
                  <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 13, opacity: 0.7, minWidth: 60 }}>Team A:</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pA: Math.max(0, rv.pA - 1) })}>−</button>
                    <span style={st.val}>{rv.pA}</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pA: rv.pA + 1 })}>+</button>
                    <span style={{ fontSize: 13, opacity: 0.7, minWidth: 60, marginLeft: 8 }}>Team B:</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pB: Math.max(0, rv.pB - 1) })}>−</button>
                    <span style={st.val}>{rv.pB}</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pB: rv.pB + 1 })}>+</button>
                    <button style={{ ...st.btnOrange, opacity: resolveLoading === m.id ? 0.5 : 1 }} onClick={() => resolveConflict(m.id)} disabled={resolveLoading === m.id}>
                      {resolveLoading === m.id ? "Saving…" : "Confirm score"}
                    </button>
                  </div>
                </div>
              );
            })}
            <div style={st.divider} />
          </>
        )}

        {/* Courts */}
        <div style={st.sectionLabel}>Courts</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: session.courts >= 2 ? "repeat(2, minmax(0,1fr))" : "1fr" }}>
          {courtNumbers.map((cn) => {
            const m = inProgress.find((x) => x.courtNumber === cn);
            if (!m) return (
              <div key={cn} style={{ ...st.courtCard, opacity: 0.45 }}>
                <div style={{ fontWeight: 1000, fontSize: 15, color: ORANGE }}>Court {cn}</div>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Open — no active match</div>
              </div>
            );
            const { a1, a2, b1, b2 } = names(m);
            const isPending = m.scoreStatus === "PENDING"; const isConfirmed = m.scoreStatus === "CONFIRMED"; const isConflict = m.scoreStatus === "CONFLICT";
            const sColor = isConflict ? RED : isConfirmed ? GREEN : isPending ? ORANGE : WARM_WHITE;
            const sLabel = isConflict ? "⚠ Conflict" : isConfirmed ? "✓ Confirmed" : isPending ? "⏳ Awaiting confirmation" : "In play";
            const cs = courtScores[m.id] ?? { pA: null };
            const entryA = cs.pA; const entryB = entryA !== null ? ppm - entryA : null;
            const canSubmit = entryA !== null && !isPending && !isConfirmed && !isConflict;
            const showEntry = !isPending && !isConfirmed && !isConflict;
            const displayA = m.pointsA; const displayB = m.pointsB;
            const hasSubmittedScore = displayA !== null && displayB !== null;
            return (
              <div key={cn} style={{ ...st.courtCard, borderColor: isPending ? "rgba(255,107,0,0.35)" : isConflict ? "rgba(255,64,64,0.35)" : "rgba(255,107,0,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 1000, fontSize: 15, color: ORANGE }}>Court {cn}</div>
                  <span style={{ fontSize: 11, fontWeight: 1000, color: sColor }}>{sLabel}</span>
                </div>
                {hasSubmittedScore ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <div><div style={{ fontWeight: 1000, fontSize: 13, opacity: 0.7, marginBottom: 2 }}>Team A</div><div style={{ fontWeight: 950, fontSize: 13 }}>{a1} & {a2}</div></div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ fontSize: 30, fontWeight: 1150, letterSpacing: 1 }}>
                        <span style={{ color: displayA! > displayB! ? GREEN : displayA! < displayB! ? RED : WHITE }}>{displayA}</span>
                        <span style={{ opacity: 0.3, margin: "0 6px" }}>–</span>
                        <span style={{ color: displayB! > displayA! ? GREEN : displayB! < displayA! ? RED : WHITE }}>{displayB}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" as const }}><div style={{ fontWeight: 1000, fontSize: 13, opacity: 0.7, marginBottom: 2 }}>Team B</div><div style={{ fontWeight: 950, fontSize: 13 }}>{b1} & {b2}</div></div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 4 }}>{a1} & {a2}</div>
                    <div style={{ fontWeight: 950, fontSize: 13 }}>{b1} & {b2}</div>
                  </div>
                )}
                {showEntry && (
                  <div style={{ borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 1000, flex: 1 }}>{a1} & {a2}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button style={{ ...st.stepBtn, opacity: entryA === null || entryA === 0 ? 0.35 : 1 }} onClick={() => adjustCourtScore(m.id, -1, ppm)} disabled={entryA === null || entryA === 0}>−</button>
                        <span style={{ fontSize: 28, fontWeight: 1150, minWidth: 36, textAlign: "center" as const, color: entryA === null ? "rgba(255,255,255,0.25)" : WHITE }}>{entryA === null ? "—" : entryA}</span>
                        <button style={{ ...st.stepBtn, opacity: entryA !== null && entryA >= ppm ? 0.35 : 1 }} onClick={() => adjustCourtScore(m.id, +1, ppm)} disabled={entryA !== null && entryA >= ppm}>+</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ fontSize: 13, fontWeight: 1000, flex: 1, opacity: 0.7 }}>{b1} & {b2}</div>
                      <div style={{ fontSize: 28, fontWeight: 1150, minWidth: 36, textAlign: "center" as const, color: entryB === null ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", paddingRight: 4 }}>{entryB === null ? "—" : entryB}</div>
                    </div>
                    {entryA === null && <div style={{ fontSize: 12, opacity: 0.45, marginTop: 8, textAlign: "center" as const }}>Tap + to enter {a1} & {a2}'s score</div>}
                    <button style={{ marginTop: 12, width: "100%", borderRadius: 12, padding: "13px 16px", fontSize: 14, fontWeight: 1000, cursor: canSubmit ? "pointer" : "default", border: "none", background: canSubmit ? ORANGE : "rgba(255,255,255,0.1)", color: canSubmit ? WHITE : "rgba(255,255,255,0.3)" }}
                      onClick={() => submitCourtScore(m.id, ppm)} disabled={!canSubmit || submitLoading === m.id}>
                      {submitLoading === m.id ? "Submitting…" : canSubmit ? `Submit  ${entryA} – ${entryB}` : "Enter score above"}
                    </button>
                  </div>
                )}
                {isPending && (
                  <button style={{ ...st.btnConfirm, opacity: confirmLoading === m.id ? 0.5 : 1 }} onClick={() => confirmScore(m.id)} disabled={confirmLoading === m.id}>
                    {confirmLoading === m.id ? "Confirming…" : `✓ Confirm ${displayA}–${displayB}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Queue */}
        {pending.length > 0 && (
          <>
            <div style={st.sectionLabel}>Queue — {pending.length} match{pending.length !== 1 ? "es" : ""} waiting</div>
            {pending.map((m) => {
              const { a1, a2, b1, b2 } = names(m);
              return (
                <div key={m.id} style={st.queueCard}>
                  <div style={st.names}>{a1} & {a2} <span style={{ opacity: 0.4 }}>vs</span> {b1} & {b2}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" as const }}>
                    {courtNumbers.map((cn) => {
                      const busy = inProgress.some((x) => x.courtNumber === cn);
                      return <button key={cn} style={{ ...st.btn, opacity: busy ? 0.3 : 1 }} onClick={() => { if (!busy) startMatch(m.id, cn); }} disabled={busy}>Start on Court {cn}</button>;
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {pending.length === 0 && inProgress.length === 0 && complete.length > 0 && (
          <div style={{ opacity: 0.55, fontWeight: 900, padding: "16px 0", textAlign: "center" as const }}>
            All {complete.length} matches complete 🏆
          </div>
        )}

        <div style={st.divider} />

        {/* Leaderboard */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const }}>Leaderboard</div>
          {complete.length > 0 && (
            <button style={{ borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(0,200,80,0.35)", background: "rgba(0,200,80,0.08)", color: GREEN, whiteSpace: "nowrap" as const }}
              onClick={() => router.push(`/session/${code}/organiser/results`)}>
              View all results →
            </button>
          )}
        </div>
        <div style={st.lbWrap}>
          <div style={st.lbHead}>
            <div style={st.lbCenter}>Rank</div><div>Player</div>
            <div style={st.lbCenter}>W / D / L</div>
            <div style={st.lbRight}>Points</div>
            <div style={st.lbRight}>Diff</div>
          </div>
          {leaderboard.map((r, idx) => {
            const isTop3 = idx < 3 && r.played > 0;
            return (
              <div key={r.playerId} style={{ ...st.lbRow, background: isTop3 ? "rgba(255,107,0,0.10)" : "rgba(255,255,255,0.04)", border: `1px solid ${isTop3 ? "rgba(255,107,0,0.30)" : "rgba(255,255,255,0.07)"}` }}>
                <div style={{ fontSize: 15, fontWeight: 1100, textAlign: "center" as const, color: idx === 0 && r.played > 0 ? ORANGE : WHITE }}>{idx + 1}</div>
                <div style={{ fontWeight: 950, fontSize: 14 }}>{r.name}</div>
                <div style={{ ...st.lbCenter, fontSize: 13, fontWeight: 1000 }}>
                  <span style={{ color: GREEN }}>{r.wins}</span><span style={{ opacity: 0.35, margin: "0 3px" }}>/</span>
                  <span style={{ color: WHITE }}>{r.draws}</span><span style={{ opacity: 0.35, margin: "0 3px" }}>/</span>
                  <span style={{ color: RED }}>{r.losses}</span>
                </div>
                <div style={{ ...st.lbRight, fontSize: 13, fontWeight: 1000 }}>{r.pointsFor} – {r.pointsAgainst}</div>
                <div style={{ ...st.lbRight, fontSize: 13, fontWeight: 1100, color: r.diff > 0 ? GREEN : r.diff < 0 ? RED : WHITE }}>{r.diff > 0 ? `+${r.diff}` : r.diff}</div>
              </div>
            );
          })}
          {complete.length === 0 && <div style={st.hint}>No completed matches yet.</div>}
        </div>
      </div>
    </div>
  );
}