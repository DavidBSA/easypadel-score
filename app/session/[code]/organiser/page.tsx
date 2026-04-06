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

const CONTACTS_KEY = "eps_contacts";
function loadContacts(): string[] { try { const r = localStorage.getItem(CONTACTS_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveContacts(list: string[]) { try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(list)); } catch { } }
function addToContacts(name: string, current: string[]): string[] { if (!name.trim()) return current; if (current.some((c) => c.toLowerCase() === name.toLowerCase())) return current; const updated = [...current, name.trim()]; saveContacts(updated); return updated; }

type DeuceMode = "star" | "golden" | "traditional";
type MatchRules = { deuceMode: DeuceMode; tiebreak: boolean; superTiebreak: boolean };
type TennisPayload = { sets: number; rules: MatchRules };
type TTeam = "A" | "B";
type TSnap = {
  gamesA: number; gamesB: number; setsA: number; setsB: number; setIndex: number;
  pA: number; pB: number; adTeam: TTeam | null; deuceCount: number;
  isTiebreak: boolean; tiebreakTarget: number; tbA: number; tbB: number; tbPointNumber: number;
  tbServingTeam: TTeam; tbPointsLeftInTurn: number;
  servingTeam: TTeam; nextServerA: 0 | 1; nextServerB: 0 | 1;
  matchOver: boolean; winner: TTeam | null;
};
const T0: TSnap = { gamesA: 0, gamesB: 0, setsA: 0, setsB: 0, setIndex: 0, pA: 0, pB: 0, adTeam: null, deuceCount: 0, isTiebreak: false, tiebreakTarget: 7, tbA: 0, tbB: 0, tbPointNumber: 0, tbServingTeam: "A", tbPointsLeftInTurn: 1, servingTeam: "A", nextServerA: 0, nextServerB: 0, matchOver: false, winner: null };

const DEUCE_OPTIONS: { value: DeuceMode; label: string; desc: string }[] = [
  { value: "star", label: "Star Point", desc: "Two advantages, then deciding point (FIP 2026)" },
  { value: "golden", label: "Golden Point", desc: "Deciding point immediately at deuce" },
  { value: "traditional", label: "Traditional", desc: "Unlimited advantage until 2-point lead" },
];

// ── Tennis scoring helpers ─────────────────────────────────────────────────
function setsToWin(n: number) { return Math.ceil(n / 2); }
function isFinalSet(idx: number, total: number) { return idx === total - 1; }
function shouldUseSuperTB(tp: TennisPayload, idx: number) { return tp.rules.superTiebreak && isFinalSet(idx, tp.sets) && tp.sets > 1; }

// ── Final score game/set helpers ───────────────────────────────────────────
function isFinalSetSuperTBForScore(setIdx: number, tp: TennisPayload): boolean {
  return tp.rules.superTiebreak && tp.sets > 1 && setIdx === tp.sets - 1;
}

function detectSetWinner(gA: number, gB: number, tp: TennisPayload, setIdx: number): TTeam | null {
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

function tbWinner(a: number, b: number, target: number): TTeam | null { if ((a >= target || b >= target) && Math.abs(a - b) >= 2) return a > b ? "A" : "B"; return null; }
function normalSetWinner(a: number, b: number): TTeam | null { if ((a >= 6 || b >= 6) && Math.abs(a - b) >= 2) return a > b ? "A" : "B"; return null; }
function tog(v: 0 | 1): 0 | 1 { return v === 0 ? 1 : 0; }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function checkMatchWinner(s: TSnap, tp: TennisPayload): TSnap { const needed = setsToWin(tp.sets); if (s.setsA >= needed) return { ...s, matchOver: true, winner: "A" }; if (s.setsB >= needed) return { ...s, matchOver: true, winner: "B" }; return s; }
function startTiebreak(s: TSnap, target: number): TSnap { return { ...s, isTiebreak: true, tiebreakTarget: target, tbA: 0, tbB: 0, tbPointNumber: 0, tbServingTeam: s.servingTeam, tbPointsLeftInTurn: 1, pA: 0, pB: 0, adTeam: null, deuceCount: 0 }; }
function rotateServeAfterGame(s: TSnap): TSnap { if (s.servingTeam === "A") return { ...s, nextServerA: tog(s.nextServerA), servingTeam: "B" }; return { ...s, nextServerB: tog(s.nextServerB), servingTeam: "A" }; }
function rotateServeAfterTBPoint(s: TSnap): TSnap { const rem = s.tbPointsLeftInTurn - 1; if (rem > 0) return { ...s, tbPointsLeftInTurn: rem }; const newTeam: TTeam = s.tbServingTeam === "A" ? "B" : "A"; const n = { ...s, tbServingTeam: newTeam, tbPointsLeftInTurn: 2 }; if (newTeam === "A") n.nextServerA = tog(n.nextServerA); else n.nextServerB = tog(n.nextServerB); return n; }
function winGame(s: TSnap, w: TTeam, tp: TennisPayload): TSnap { let n: TSnap = { ...s }; if (w === "A") n.gamesA += 1; else n.gamesB += 1; n.pA = 0; n.pB = 0; n.adTeam = null; n.deuceCount = 0; n = rotateServeAfterGame(n); const sw = normalSetWinner(n.gamesA, n.gamesB); if (sw) { if (sw === "A") n.setsA += 1; else n.setsB += 1; n.gamesA = 0; n.gamesB = 0; n.isTiebreak = false; n.tiebreakTarget = 7; n.tbA = 0; n.tbB = 0; n.tbPointNumber = 0; n.tbServingTeam = n.servingTeam; n.tbPointsLeftInTurn = 1; n.setIndex += 1; n = checkMatchWinner(n, tp); if (!n.matchOver && shouldUseSuperTB(tp, n.setIndex)) n = startTiebreak(n, 10); return n; } if (tp.rules.tiebreak && !shouldUseSuperTB(tp, s.setIndex) && n.gamesA === 6 && n.gamesB === 6) n = startTiebreak(n, 7); return n; }
function winTBAsSet(s: TSnap, w: TTeam, tp: TennisPayload): TSnap { let n: TSnap = { ...s }; if (w === "A") n.setsA += 1; else n.setsB += 1; n.isTiebreak = false; n.tiebreakTarget = 7; n.tbA = 0; n.tbB = 0; n.tbPointNumber = 0; n.tbPointsLeftInTurn = 1; n.gamesA = 0; n.gamesB = 0; n.pA = 0; n.pB = 0; n.adTeam = null; n.deuceCount = 0; n.setIndex += 1; n = checkMatchWinner(n, tp); if (!n.matchOver && shouldUseSuperTB(tp, n.setIndex)) n = startTiebreak(n, 10); return n; }
function addTennisPoint(prev: TSnap, team: TTeam, tp: TennisPayload): TSnap {
  if (prev.matchOver) return prev;
  if (prev.isTiebreak) { let n: TSnap = { ...prev }; if (team === "A") n.tbA += 1; else n.tbB += 1; n.tbPointNumber += 1; n = rotateServeAfterTBPoint(n); const w = tbWinner(n.tbA, n.tbB, n.tiebreakTarget); if (w) n = winTBAsSet(n, w, tp); return n; }
  const mode = tp.rules.deuceMode;
  if (prev.pA >= 3 && prev.pB >= 3) { if (mode === "golden") return winGame(prev, team, tp); if (mode === "star") { if (prev.adTeam === null) { if (prev.deuceCount >= 1) return winGame(prev, team, tp); return { ...prev, adTeam: team }; } if (prev.adTeam === team) return winGame(prev, team, tp); return { ...prev, adTeam: null, deuceCount: prev.deuceCount + 1 }; } if (prev.adTeam === null) return { ...prev, adTeam: team }; if (prev.adTeam === team) return winGame(prev, team, tp); return { ...prev, adTeam: null }; }
  let n: TSnap = { ...prev }; if (team === "A") n.pA += 1; else n.pB += 1;
  if (n.pA >= 4 && n.pB <= 2) return winGame(prev, "A", tp); if (n.pB >= 4 && n.pA <= 2) return winGame(prev, "B", tp);
  if (n.pA >= 3 && n.pB >= 3) { if (mode === "golden") return winGame({ ...n }, team, tp); } return n;
}
function getScoreDisplay(s: TSnap): { a: string; b: string } { if (s.isTiebreak) return { a: String(s.tbA), b: String(s.tbB) }; const map = ["0", "15", "30", "40"]; if (s.pA >= 3 && s.pB >= 3) { if (s.adTeam === "A") return { a: "AD", b: "40" }; if (s.adTeam === "B") return { a: "40", b: "AD" }; return { a: "40", b: "40" }; } return { a: map[clamp(s.pA, 0, 3)], b: map[clamp(s.pB, 0, 3)] }; }

type Player = { id: string; name: string; isActive: boolean };
type ScoreSubmission = { id: string; deviceId: string; pointsA: number; pointsB: number; submittedAt: string };
type Match = { id: string; queuePosition: number; courtNumber: number | null; status: "PENDING" | "IN_PROGRESS" | "COMPLETE"; teamAPlayer1: string; teamAPlayer2: string; teamBPlayer1: string; teamBPlayer2: string; pointsA: number | null; pointsB: number | null; scoreStatus: "PENDING" | "CONFIRMED" | "CONFLICT" | null; scoreSubmissions: ScoreSubmission[]; startedAt: string | null; completedAt: string | null; };
type Session = { id: string; code: string; name?: string | null; format: "SINGLE" | "MIXED" | "TEAM"; status: "LOBBY" | "ACTIVE" | "COMPLETE"; courts: number; pointsPerMatch: number; servesPerRotation: number | null; maxPlayers: number | null; players: Player[]; matches: Match[]; createdAt: string; scheduledAt: string | null; };
type LeaderRow = { playerId: string; name: string; played: number; wins: number; draws: number; losses: number; pointsFor: number; pointsAgainst: number; diff: number; };
type CourtScore = { rawA: string };
type OrgScoringMode = "final" | "live";

function formatLabel(f: "SINGLE" | "MIXED" | "TEAM"): string { if (f === "SINGLE") return "Single Match"; if (f === "MIXED") return "Mixed Americano"; return "Team Americano"; }
function formatSessionDateTime(iso: string): string { try { const d = new Date(iso); return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } }
function formatScheduled(iso: string): string { try { const d = new Date(iso); return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch { return ""; } }

function pill(label: string, bg: string, border: string, onClick?: () => void): React.ReactNode {
  return <span onClick={onClick} style={{ display: "inline-block", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 1000, background: bg, border: "1px solid " + border, color: WHITE, cursor: onClick ? "pointer" : "default" }}>{label}</span>;
}

function AutocompleteDropdown({ value, contacts, sessionNames, onSelect }: { value: string; contacts: string[]; sessionNames: Set<string>; onSelect: (name: string) => void; }) {
  const q = value.trim().toLowerCase(); if (!q) return null;
  const matches = contacts.filter((c) => c.toLowerCase().includes(q)); if (matches.length === 0) return null;
  return (
    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, marginTop: 4, borderRadius: 12, background: "#0D1B2A", border: "1px solid rgba(255,255,255,0.18)", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
      {matches.map((name) => { const inSession = sessionNames.has(name.toLowerCase()); return <div key={name} onMouseDown={(e) => { e.preventDefault(); if (!inSession) onSelect(name); }} style={{ padding: "10px 14px", fontSize: 14, fontWeight: 900, cursor: inSession ? "default" : "pointer", opacity: inSession ? 0.35 : 1, color: WHITE, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{name}</span>{inSession && <span style={{ fontSize: 11, color: ORANGE }}>already added</span>}</div>; })}
    </div>
  );
}

function NameInput({ value, onChange, placeholder, fieldKey, acFocus, setAcFocus, contacts, sessionNameSet, onSubmit }: { value: string; onChange: (v: string) => void; placeholder: string; fieldKey: "name1" | "name2"; acFocus: "name1" | "name2" | null; setAcFocus: (v: "name1" | "name2" | null) => void; contacts: string[]; sessionNameSet: Set<string>; onSubmit?: () => void; }) {
  return (
    <div style={{ position: "relative" as const, flex: 1, minWidth: 0 }}>
      <input style={{ width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 900, outline: "none", boxSizing: "border-box" as const }} value={value} placeholder={placeholder} maxLength={30} onChange={(e) => { onChange(e.target.value); setAcFocus(fieldKey); }} onFocus={() => setAcFocus(fieldKey)} onBlur={() => setTimeout(() => setAcFocus(null), 150)} onKeyDown={(e) => { if (e.key === "Enter" && onSubmit) onSubmit(); if (e.key === "Escape") setAcFocus(null); }} />
      {acFocus === fieldKey && <AutocompleteDropdown value={value} contacts={contacts} sessionNames={sessionNameSet} onSelect={(name) => { onChange(name); setAcFocus(null); }} />}
    </div>
  );
}

export default function OrganiserPage() {
  const params = useParams();
  const code = (Array.isArray(params?.code) ? params.code[0] : params?.code ?? "") as string;
  const router = useRouter();

  const [isMobile, setIsMobile] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">("idle");
  const [shareQRStatus, setShareQRStatus] = useState<"idle" | "loading" | "shared" | "copied">("idle");
  const [showQR, setShowQR] = useState(false);
  const [contacts, setContacts] = useState<string[]>([]);
  const [acFocus, setAcFocus] = useState<"name1" | "name2" | null>(null);
  const [addName, setAddName] = useState("");
  const [addName2, setAddName2] = useState("");
  const [addTeamName, setAddTeamName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState("");
  const [singleAssignment, setSingleAssignment] = useState<{ teamA: string[]; teamB: string[] }>({ teamA: [], teamB: [] });
  const [courtScores, setCourtScores] = useState<Record<string, CourtScore>>({});
  const [submitLoading, setSubmitLoading] = useState<string | null>(null);

  // ── PIN recovery ───────────────────────────────────────────────────────────
  const [pinInput, setPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");

  // ── SINGLE scoring mode ────────────────────────────────────────────────────
  const [orgScoringMode, setOrgScoringMode] = useState<OrgScoringMode>("final");
  const [orgFinalGamesA, setOrgFinalGamesA] = useState(0);
  const [orgFinalGamesB, setOrgFinalGamesB] = useState(0);
  const [orgFinalSetsA, setOrgFinalSetsA] = useState(0);
  const [orgFinalSetsB, setOrgFinalSetsB] = useState(0);
  const [orgSetLog, setOrgSetLog] = useState<{ gamesA: number; gamesB: number }[]>([]);
  const [orgSubmitting, setOrgSubmitting] = useState(false);

  // ── Tennis live scoring ────────────────────────────────────────────────────
  const [tennisState, setTennisState] = useState<TSnap>(T0);
  const [tennisHistory, setTennisHistory] = useState<TSnap[]>([]);
  const [showServeHelper, setShowServeHelper] = useState(true);
  const [tennisPayload, setTennisPayload] = useState<TennisPayload | null>(null);
  const scoreSubmittedRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editSets, setEditSets] = useState(1);
  const [editDeuceMode, setEditDeuceMode] = useState<DeuceMode>("star");
  const [editTiebreak, setEditTiebreak] = useState(true);
  const [editSuperTiebreak, setEditSuperTiebreak] = useState(true);
  const [endConfirm, setEndConfirm] = useState(false);
  const [endLoading, setEndLoading] = useState(false);
  const [endError, setEndError] = useState("");
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 600); check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check); }, []);

  useEffect(() => {
    if (!code) return;
    try { const s = localStorage.getItem("eps_join_" + code); if (s) { const p = JSON.parse(s); if (p.isOrganiser && p.deviceId) setDeviceId(p.deviceId); } } catch { }
    try { const rules = localStorage.getItem("eps_match_rules_" + code); if (rules) { const p = JSON.parse(rules) as TennisPayload; setTennisPayload(p); setEditSets(p.sets); setEditDeuceMode(p.rules.deuceMode); setEditTiebreak(p.rules.tiebreak); setEditSuperTiebreak(p.rules.superTiebreak); } } catch { }
    try { const ts = localStorage.getItem("eps_tennis_" + code); if (ts) setTennisState(JSON.parse(ts)); } catch { }
    setContacts(loadContacts()); setBootstrapped(true);
  }, [code]);

  useEffect(() => { if (!code) return; localStorage.setItem("eps_tennis_" + code, JSON.stringify(tennisState)); }, [tennisState, code]);

  useEffect(() => {
    if (!tennisState.matchOver || scoreSubmittedRef.current || !deviceId || !session) return;
    const match = session.matches.find((m) => m.status === "IN_PROGRESS" || m.status === "PENDING");
    if (!match) return;
    scoreSubmittedRef.current = true;
    fetch("/api/matches/" + match.id + "/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, pointsA: tennisState.setsA, pointsB: tennisState.setsB, isOrganiserOverride: true }) }).catch(() => { scoreSubmittedRef.current = false; });
  }, [tennisState.matchOver, deviceId, session]);

  const applySession = useCallback((data: Session) => {
    setSession(data);
    setCourtScores((prev) => { const next = { ...prev }; for (const m of data.matches) { if (m.status === "IN_PROGRESS" && !(m.id in next)) next[m.id] = { rawA: "" }; } return next; });
    if (data.format === "SINGLE") { const validIds = new Set(data.players.map((p) => p.id)); setSingleAssignment((prev) => ({ teamA: prev.teamA.filter((id) => validIds.has(id)), teamB: prev.teamB.filter((id) => validIds.has(id)) })); }
  }, []);

  useEffect(() => {
    if (!deviceId || !code) return;
    fetch("/api/sessions/" + code).then((r) => r.json()).then((data) => startTransition(() => applySession(data))).catch(() => setSessionError("Failed to load session."));
    const es = new EventSource("/api/sessions/" + code + "/stream"); esRef.current = es;
    es.onmessage = (e) => { try { const data = JSON.parse(e.data); startTransition(() => applySession(data)); } catch { } };
    es.onerror = () => { es.close(); if (!pollRef.current) { pollRef.current = setInterval(() => { fetch("/api/sessions/" + code).then((r) => r.json()).then((data) => startTransition(() => applySession(data))).catch(() => { }); }, 3000); } };
    return () => { es.close(); if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [deviceId, code, applySession]);

  // ── PIN recovery submit ────────────────────────────────────────────────────
  async function submitPin() {
    const pin = pinInput.trim(); if (!pin) return;
    setPinLoading(true); setPinError("");
    try {
      const r = await fetch("/api/sessions/" + code + "/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organiserPin: pin }) });
      const data = await r.json();
      if (!r.ok) { setPinError(data.error ?? data.message ?? "Incorrect PIN — please try again."); setPinLoading(false); return; }
      const newDeviceId: string = data.deviceId;
      localStorage.setItem("eps_join_" + code, JSON.stringify({ deviceId: newDeviceId, isOrganiser: true }));
      localStorage.setItem("eps_pin_" + code, pin);
      setDeviceId(newDeviceId);
    } catch { setPinError("Network error — please try again."); }
    setPinLoading(false);
  }

  function openSettings() { const tp = tennisPayload ?? { sets: 1, rules: { deuceMode: "traditional" as DeuceMode, tiebreak: true, superTiebreak: false } }; setEditSets(tp.sets); setEditDeuceMode(tp.rules.deuceMode); setEditTiebreak(tp.rules.tiebreak); setEditSuperTiebreak(tp.rules.superTiebreak); setShowSettings(true); }
  function saveSettings() { const next: TennisPayload = { sets: editSets, rules: { deuceMode: editDeuceMode, tiebreak: editTiebreak, superTiebreak: editSets === 1 ? false : editSuperTiebreak } }; setTennisPayload(next); localStorage.setItem("eps_match_rules_" + code, JSON.stringify(next)); setShowSettings(false); }

  function toggleSingleAssign(playerId: string) {
    setSingleAssignment((prev) => {
      const inA = prev.teamA.includes(playerId); const inB = prev.teamB.includes(playerId);
      if (inA) return { ...prev, teamA: prev.teamA.filter((id) => id !== playerId) };
      if (inB) return { ...prev, teamB: prev.teamB.filter((id) => id !== playerId) };
      if (prev.teamA.length < 2) return { ...prev, teamA: [...prev.teamA, playerId] };
      if (prev.teamB.length < 2) return { ...prev, teamB: [...prev.teamB, playerId] };
      return prev;
    });
  }

  function orgConfirmSet(winner: TTeam) {
    setOrgSetLog((prev) => [...prev, { gamesA: orgFinalGamesA, gamesB: orgFinalGamesB }]);
    if (winner === "A") setOrgFinalSetsA((v) => v + 1);
    else setOrgFinalSetsB((v) => v + 1);
    setOrgFinalGamesA(0);
    setOrgFinalGamesB(0);
  }

  async function submitOrgFinalScore() {
    if (!deviceId || !session) return;
    const match = session.matches.find((m) => m.status === "IN_PROGRESS"); if (!match) return;
    setOrgSubmitting(true);
    try { await fetch("/api/matches/" + match.id + "/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, pointsA: orgFinalSetsA, pointsB: orgFinalSetsB, isOrganiserOverride: true }) }); }
    finally { setOrgSubmitting(false); }
  }

  async function addPlayerManually() {
    const name = addName.trim(); if (!name || !deviceId) return; setAddLoading(true); setAddError(""); setAcFocus(null);
    try { const r = await fetch("/api/sessions/" + code + "/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, playerName: name }) }); const data = await r.json(); if (!r.ok) { setAddError(data.message ?? data.error ?? "Could not add player."); setAddLoading(false); return; } setAddName(""); setContacts((prev) => addToContacts(name, prev)); } catch { setAddError("Network error."); } setAddLoading(false);
  }

  async function addTeamPair() {
    const n1 = addName.trim(); const n2 = addName2.trim(); if (!n1 || !n2 || !deviceId) return; setAddLoading(true); setAddError(""); setAcFocus(null);
    try { const r1 = await fetch("/api/sessions/" + code + "/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, playerName: n1 }) }); if (!r1.ok) { const d = await r1.json(); setAddError(d.message ?? "Could not add player 1."); setAddLoading(false); return; } const r2 = await fetch("/api/sessions/" + code + "/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, playerName: n2 }) }); if (!r2.ok) { const d = await r2.json(); setAddError(d.message ?? "Could not add player 2."); setAddLoading(false); return; } setAddName(""); setAddName2(""); setAddTeamName(""); setContacts((prev) => addToContacts(n2, addToContacts(n1, prev))); } catch { setAddError("Network error."); } setAddLoading(false);
  }

  async function lockAndStart() {
    if (!deviceId) return; setStartLoading(true); setStartError("");
    try { const isSingleFormat = session?.format === "SINGLE"; const body: Record<string, unknown> = { deviceId }; if (isSingleFormat) { body.teamA = singleAssignment.teamA; body.teamB = singleAssignment.teamB; } const r = await fetch("/api/sessions/" + code + "/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await r.json(); if (!r.ok) { setStartError(data.error ?? "Could not start session."); setStartLoading(false); return; } } catch { setStartError("Network error."); } setStartLoading(false);
  }

  async function startMatch(matchId: string, courtNumber: number) { if (!deviceId) return; await fetch("/api/matches/" + matchId + "/start", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courtNumber, deviceId }) }); }

  async function submitCourtScore(matchId: string, ppm: number) {
    if (!deviceId) return; const cs = courtScores[matchId]; const pA = parseInt(cs?.rawA ?? "", 10); if (isNaN(pA) || pA < 0 || pA > ppm) return; setSubmitLoading(matchId);
    try { await fetch("/api/matches/" + matchId + "/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, pointsA: pA, pointsB: ppm - pA, isOrganiserOverride: true }) }); setCourtScores((prev) => ({ ...prev, [matchId]: { rawA: "" } })); } finally { setSubmitLoading(null); }
  }

  async function endSession() {
    if (!deviceId) return; setEndLoading(true); setEndError("");
    try { const r = await fetch("/api/sessions/" + code + "/end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId }) }); const data = await r.json(); if (!r.ok) { setEndError(data.error ?? "Could not end session."); setEndLoading(false); setEndConfirm(false); return; } } catch { setEndError("Network error."); } setEndLoading(false); setEndConfirm(false);
  }

  function tennisAddPoint(team: TTeam) { if (!tennisPayload) return; setTennisHistory((h) => [...h, tennisState]); setTennisState((prev) => addTennisPoint(prev, team, tennisPayload)); }
  function tennisUndo() { setTennisHistory((h) => { if (h.length === 0) return h; setTennisState(h[h.length - 1]); scoreSubmittedRef.current = false; return h.slice(0, -1); }); }
  function tennisReset() { setTennisHistory([]); setTennisState(T0); scoreSubmittedRef.current = false; localStorage.removeItem("eps_tennis_" + code); }
  function tennisRandomServer() { const t: TTeam = Math.random() < 0.5 ? "A" : "B"; const a: 0 | 1 = Math.random() < 0.5 ? 0 : 1; const b: 0 | 1 = Math.random() < 0.5 ? 0 : 1; setTennisHistory((h) => [...h, tennisState]); setTennisState((prev) => ({ ...prev, servingTeam: t, nextServerA: a, nextServerB: b })); }

  function getJoinUrl() { return typeof window !== "undefined" ? window.location.origin + "/join?code=" + code : "/join?code=" + code; }
  async function shareLink() { const url = getJoinUrl(); const fLabel = session?.format === "SINGLE" ? "Single Match" : session?.format === "MIXED" ? "Mixed Americano" : "Team Americano"; const dateText = session?.scheduledAt ? " — " + formatScheduled(session.scheduledAt) : ""; const shareText = "You're invited to a " + fLabel + dateText + ". Join with code: " + code; if (typeof navigator !== "undefined" && navigator.share) { try { await navigator.share({ title: "Join my padel session", text: shareText, url }); setShareStatus("shared"); setTimeout(() => setShareStatus("idle"), 2500); return; } catch (err: unknown) { if (err instanceof Error && err.name === "AbortError") return; } } try { await navigator.clipboard.writeText(url); setShareStatus("copied"); setTimeout(() => setShareStatus("idle"), 2500); } catch { } }
  async function shareQR() {
    const url = getJoinUrl(); const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" + encodeURIComponent(url) + "&bgcolor=0D1B2A&color=FFFFFF&margin=16";
    if (typeof navigator !== "undefined" && navigator.share) {
      try { setShareQRStatus("loading"); const resp = await fetch(qrUrl); const blob = await resp.blob(); const file = new File([blob], "EasyPadelScore-" + code + ".png", { type: "image/png" }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ title: "Join my padel session", text: "Scan to join session " + code, files: [file] }); setShareQRStatus("shared"); setTimeout(() => setShareQRStatus("idle"), 2500); return; } } catch (err: unknown) { if (err instanceof Error && err.name === "AbortError") { setShareQRStatus("idle"); return; } }
      try { await navigator.share({ title: "Join my padel session", text: "Scan to join session " + code, url: qrUrl }); setShareQRStatus("shared"); setTimeout(() => setShareQRStatus("idle"), 2500); return; } catch (err: unknown) { if (err instanceof Error && err.name === "AbortError") { setShareQRStatus("idle"); return; } }
    }
    try { await navigator.clipboard.writeText(url); setShareQRStatus("copied"); setTimeout(() => setShareQRStatus("idle"), 2500); } catch { setShareQRStatus("idle"); }
  }

  const lbCols = isMobile ? "32px 1fr 56px" : "40px 1fr 90px 110px 64px";

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
    btnRed: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,64,64,0.45)", background: "rgba(255,64,64,0.12)", color: WHITE, whiteSpace: "nowrap" as const },
    courtCard: { borderRadius: 16, padding: 12, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 },
    queueCard: { borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 10 },
    names: { fontWeight: 900, fontSize: 14, lineHeight: 1.4 },
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
    playerPill: { borderRadius: 12, padding: "8px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 14, fontWeight: 900, color: WHITE },
    lobbyCard: { borderRadius: 18, padding: 18, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" },
    startSection: { marginTop: 16, borderRadius: 16, padding: 16, background: "rgba(0,200,80,0.06)", border: "1px solid rgba(0,200,80,0.20)", display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const },
    lbWrap: { marginTop: 4, borderRadius: 18, padding: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8 },
    lbHead: { display: "grid", gridTemplateColumns: lbCols, gap: 8, fontSize: 11, opacity: 0.5, fontWeight: 950, padding: "0 10px", textTransform: "uppercase" as const, letterSpacing: 0.5 },
    lbRow: { display: "grid", gridTemplateColumns: lbCols, gap: 8, alignItems: "center", borderRadius: 12, padding: "10px 10px" },
    lbRight: { textAlign: "right" as const },
    lbCenter: { textAlign: "center" as const },
    hint: { fontSize: 12, opacity: 0.55, color: WARM_WHITE, lineHeight: 1.4 },
    teamPairCard: { borderRadius: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 10, alignItems: "center" },
    tennisBoard: { background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 14 },
    tennisBoardGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 },
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
    serveReminder: { marginTop: 12, borderRadius: 14, padding: "10px 14px", background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.22)", fontSize: 12, fontWeight: 900, color: WHITE, lineHeight: 1.5 },
    starPointBanner: { borderRadius: 14, padding: "10px 14px", background: "rgba(255,107,0,0.10)", border: "1px solid rgba(255,107,0,0.30)", fontSize: 13, fontWeight: 1000, color: ORANGE, textAlign: "center" as const, marginBottom: 10 },
    endConfirmBox: { marginTop: 12, borderRadius: 16, padding: 16, background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.30)", display: "flex", flexDirection: "column" as const, gap: 10 },
    settingsPanel: { marginTop: 12, borderRadius: 16, padding: 16, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.12)", display: "grid", gap: 14 },
    settingsPillRow: { display: "flex", gap: 8 },
    settingsDeuceGrid: { display: "grid", gap: 8 },
    settingsToggle: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "10px 14px" },
    modeToggle: { display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 4, marginBottom: 16 },
    grid2: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0,1fr))" },
    bigNum: { fontSize: 56, fontWeight: 1200, letterSpacing: 0, lineHeight: 1 },
    stepBtn: { width: 52, height: 52, borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 26, fontWeight: 1000, cursor: "pointer" },
    scoreRow: { display: "flex", alignItems: "center", gap: 14, justifyContent: "center", margin: "8px 0" },
    teamLabel: { fontWeight: 1000, fontSize: 13, opacity: 0.75, marginBottom: 8, textAlign: "center" as const },
    setScoreDisplay: { display: "flex", justifyContent: "center", alignItems: "baseline", gap: 14, padding: "10px 0 4px" },
    setLogItem: { fontSize: 12, fontWeight: 900, opacity: 0.55, textAlign: "center" as const, padding: "3px 0" },
    primaryBtn: { width: "100%", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, marginTop: 14 },
    confirmSetBtn: { width: "100%", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: GREEN, color: WHITE, marginTop: 10 },
    gameWinnerBanner: { marginTop: 10, borderRadius: 14, padding: "12px 16px", background: "rgba(0,200,80,0.10)", border: "1px solid rgba(0,200,80,0.35)", textAlign: "center" as const },
    gameWarnBanner: { marginTop: 10, borderRadius: 14, padding: "10px 14px", background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.30)", textAlign: "center" as const, fontSize: 12, fontWeight: 900, color: WHITE },
    sectionDivider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "18px 0" },
  };

  const modeTabStyle = (active: boolean): React.CSSProperties => ({ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", borderRadius: 10, background: active ? ORANGE : "transparent", color: active ? WHITE : WARM_WHITE, opacity: active ? 1 : 0.55 });
  const tennisTeamCard = (serving: boolean): React.CSSProperties => ({ borderRadius: 16, padding: 14, background: serving ? "rgba(255,107,0,0.10)" : "rgba(255,255,255,0.04)", border: serving ? "1px solid rgba(255,107,0,0.45)" : "1px solid rgba(255,255,255,0.08)" });
  const tennisChip = (active: boolean): React.CSSProperties => ({ padding: "9px 14px", borderRadius: 999, border: active ? "1px solid " + ORANGE : "1px solid rgba(255,255,255,0.14)", background: active ? "rgba(255,107,0,0.14)" : "rgba(255,255,255,0.06)", color: WHITE, fontWeight: 1000, cursor: "pointer", fontSize: 13 });
  const setPillStyle = (active: boolean): React.CSSProperties => ({ padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: active ? 1000 : 900, flex: 1, border: active ? "1px solid " + ORANGE : "1px solid rgba(255,255,255,0.12)", background: active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)", color: active ? WHITE : WARM_WHITE, textAlign: "center" as const, fontSize: 13 });
  const deuceCardStyle = (active: boolean): React.CSSProperties => ({ borderRadius: 12, padding: "10px 14px", cursor: "pointer", display: "grid", gap: 2, border: active ? "1px solid " + ORANGE : "1px solid rgba(255,255,255,0.10)", background: active ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)" });

  if (!bootstrapped) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading...</div></div></div>;

  // ── PIN recovery screen ────────────────────────────────────────────────────
  if (!deviceId) {
    return (
      <div style={st.page}>
        <div style={{ ...st.card, maxWidth: 420 }}>
          <div style={st.row}>
            <div>
              <div style={st.title}>Organiser · {code}</div>
              <div style={st.sub}>Enter your organiser PIN to rejoin</div>
            </div>
            <button style={st.btn} onClick={() => router.push("/")}>Home</button>
          </div>
          <div style={st.divider} />
          <div style={{ fontSize: 13, color: WARM_WHITE, opacity: 0.7, lineHeight: 1.6, marginBottom: 16 }}>
            Your organiser session was not found on this device. Enter the 4-digit PIN you received when you created session <strong style={{ color: ORANGE }}>{code}</strong>.
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              style={{ flex: 1, background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: "14px 16px", fontSize: 28, fontWeight: 1100, outline: "none", textAlign: "center" as const, letterSpacing: 8, boxSizing: "border-box" as const }}
              value={pinInput}
              placeholder="0000"
              inputMode="numeric"
              maxLength={4}
              onChange={(e) => { setPinError(""); setPinInput(e.target.value.replace(/[^\d]/g, "").slice(0, 4)); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitPin(); }}
              autoFocus
            />
            <button
              style={{ ...st.btnOrange, padding: "14px 20px", fontSize: 15, opacity: pinInput.length === 4 && !pinLoading ? 1 : 0.4 }}
              onClick={submitPin}
              disabled={pinInput.length !== 4 || pinLoading}
            >
              {pinLoading ? "Checking..." : "Enter"}
            </button>
          </div>
          {pinError && <div style={st.errorBox}>{pinError}</div>}
        </div>
      </div>
    );
  }

  if (!session) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading session...{sessionError && " — " + sessionError}</div></div></div>;

  const nameById = session.players.reduce<Record<string, string>>((m, p) => { m[p.id] = p.name; return m; }, {});
  const sessionNameSet = new Set(session.players.map((p) => p.name.toLowerCase()));
  function names(m: Match) { return { a1: nameById[m.teamAPlayer1] ?? "?", a2: nameById[m.teamAPlayer2] ?? "?", b1: nameById[m.teamBPlayer1] ?? "?", b2: nameById[m.teamBPlayer2] ?? "?" }; }

  const isSingle = session.format === "SINGLE";
  const isTeam = session.format === "TEAM";
  const minPlayers = isSingle ? 4 : session.courts * 4;
  const canStart = isSingle ? singleAssignment.teamA.length === 2 && singleAssignment.teamB.length === 2 : session.players.length >= minPlayers;
  const canWebShare = typeof navigator !== "undefined" && !!navigator.share;
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(getJoinUrl()) + "&bgcolor=0D1B2A&color=FFFFFF&margin=10";
  const fLabel = formatLabel(session.format);
  const nameInputProps = { acFocus, setAcFocus, contacts, sessionNameSet };

  const shareCard = session.status === "LOBBY" ? (
    <div style={st.shareCard}>
      <div style={st.shareTop}>
        <div style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, fontWeight: 1000, opacity: 0.5, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 6 }}>Session code</div><div style={st.codeBlock}>{code}</div><div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>Players join at <strong>/join</strong></div>{session.scheduledAt ? <div style={{ fontSize: 13, fontWeight: 1000, color: ORANGE, marginTop: 6 }}>{formatScheduled(session.scheduledAt)}</div> : <div style={{ fontSize: 12, opacity: 0.45, marginTop: 4 }}>{formatSessionDateTime(session.createdAt)}</div>}</div>
        <div style={st.shareButtons}>
          <button style={{ ...st.btnShare, background: shareStatus !== "idle" ? "rgba(0,200,80,0.85)" : ORANGE }} onClick={shareLink}>{canWebShare ? "Share link" : "Copy link"}</button>
          <button style={{ ...st.btnShareSecondary, borderColor: showQR ? "rgba(255,107,0,0.45)" : "rgba(255,255,255,0.20)", background: showQR ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.07)" }} onClick={() => setShowQR((v) => !v)}>QR {showQR ? "▲" : "▼"}</button>
        </div>
      </div>
      {showQR && <div style={st.qrWrap}><img src={qrUrl} alt={"Join " + code} width={160} height={160} style={{ borderRadius: 14, display: "block" }} /><button style={{ ...st.btnShareSecondary, background: shareQRStatus !== "idle" ? "rgba(0,200,80,0.15)" : "rgba(255,255,255,0.07)", borderColor: shareQRStatus !== "idle" ? "rgba(0,200,80,0.45)" : "rgba(255,255,255,0.20)", opacity: shareQRStatus === "loading" ? 0.6 : 1 }} onClick={shareQR} disabled={shareQRStatus === "loading"}>{shareQRStatus === "loading" ? "Loading..." : shareQRStatus === "shared" ? "Shared!" : shareQRStatus === "copied" ? "Link copied" : "Share QR"}</button><div style={st.hint}>Scan to join on any phone</div></div>}
    </div>
  ) : null;

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (session.status === "LOBBY") {
    const teamPairs: { p1: string; p2: string }[] = [];
    if (isTeam) { for (let i = 0; i + 1 < session.players.length; i += 2) teamPairs.push({ p1: session.players[i].name, p2: session.players[i + 1].name }); }
    const bothTeamsFull = singleAssignment.teamA.length === 2 && singleAssignment.teamB.length === 2;
    const startHint = isSingle ? "Assign 2 players to each team, then lock to start." : isTeam ? "Players are paired in join order. Locking entries generates the full match queue." : "Locking entries generates the full match queue.";
    const startLabel = canStart && !startLoading ? "Lock & Start" : startLoading ? "Starting..." : isSingle ? "Assign all 4 players to teams" : "Need " + (minPlayers - session.players.length) + " more player" + (minPlayers - session.players.length !== 1 ? "s" : "");
    const slotStyle = (filled: boolean): React.CSSProperties => ({ borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 900, background: filled ? "rgba(255,107,0,0.14)" : "rgba(255,255,255,0.03)", border: filled ? "1px solid rgba(255,107,0,0.40)" : "1px dashed rgba(255,255,255,0.18)", color: filled ? WHITE : "rgba(255,255,255,0.25)", cursor: filled ? "pointer" : "default", minHeight: 42, display: "flex", alignItems: "center" });
    function singlePlayerChipStyle(inA: boolean, inB: boolean, disabled: boolean): React.CSSProperties { return { borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 900, background: inA ? "rgba(255,107,0,0.18)" : inB ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)", border: inA ? "1px solid rgba(255,107,0,0.55)" : inB ? "1px solid rgba(255,255,255,0.30)" : "1px solid rgba(255,255,255,0.14)", color: disabled ? "rgba(255,255,255,0.30)" : WHITE, cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8 }; }

    return (
      <div style={st.page}><div style={st.card}>
        <div style={st.row}><div><div style={st.title}>Organiser · {code}</div>{session.name && <div style={{ fontSize: 15, fontWeight: 900, color: WHITE, opacity: 0.85, marginTop: 2 }}>{session.name}</div>}<div style={st.sub}>{fLabel} · {isSingle ? "1 court" : session.courts + " court" + (session.courts > 1 ? "s" : "")} · Waiting for players</div><div style={{ fontSize: 12, color: WARM_WHITE, opacity: 0.45, marginTop: 2 }}>{formatSessionDateTime(session.createdAt)}</div></div><button style={st.btn} onClick={() => router.push("/")}>Home</button></div>
        <div style={st.pillsRow}>{pill(session.players.length + " joined", "rgba(255,107,0,0.18)", "rgba(255,107,0,0.45)")}{isSingle ? pill("4 players needed", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)") : pill(minPlayers + " needed to start", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)")}</div>
        {shareCard}
        {isSingle && <div style={{ marginTop: 12, borderRadius: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", fontSize: 13, color: WARM_WHITE, opacity: 0.75, lineHeight: 1.5 }}>Players can join using the session code above, or you can add them manually below.</div>}
        <div style={st.divider} />
        {isSingle ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, color: ORANGE, marginBottom: 6 }}>STEP 1 — ADD PLAYERS</div>
            <div style={{ ...st.hint, marginBottom: 10 }}>Type a name and tap Add{contacts.length > 0 ? " — or start typing to pick from your library" : ""}. Names are saved for future sessions.</div>
            <div style={st.addRow}><NameInput value={addName} onChange={setAddName} placeholder="Player name" fieldKey="name1" onSubmit={addPlayerManually} {...nameInputProps} /><button style={{ ...st.btnOrange, opacity: addLoading || !addName.trim() ? 0.5 : 1 }} onClick={addPlayerManually} disabled={addLoading || !addName.trim()}>{addLoading ? "Adding…" : "Add"}</button></div>
            {addError && <div style={st.errorBox}>{addError}</div>}
            {session.players.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 10 }}>
                {session.players.map((p) => { const inA = singleAssignment.teamA.includes(p.id); const inB = singleAssignment.teamB.includes(p.id); const full = bothTeamsFull && !inA && !inB; return <div key={p.id} style={singlePlayerChipStyle(inA, inB, full)} onClick={() => !full && toggleSingleAssign(p.id)}><span>{p.name}</span>{inA && <span style={{ fontSize: 11, fontWeight: 1000, color: ORANGE, opacity: 0.9 }}>Team A</span>}{inB && <span style={{ fontSize: 11, fontWeight: 1000, color: WARM_WHITE, opacity: 0.7 }}>Team B</span>}</div>; })}
              </div>
            ) : <div style={{ ...st.hint, marginTop: 8 }}>No players yet — add names above or share the code.</div>}
            <div style={st.divider} />
            <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, color: ORANGE, marginBottom: 6 }}>STEP 2 — ASSIGN TEAMS</div>
            <div style={{ ...st.hint, marginBottom: 10 }}>Tap a player name above to assign them to a team slot. Tap a filled slot to remove.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ borderRadius: 14, padding: 14, background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.22)" }}><div style={{ fontSize: 12, fontWeight: 1000, color: ORANGE, marginBottom: 10, letterSpacing: 0.5 }}>TEAM A</div><div style={{ display: "grid", gap: 8 }}>{[0, 1].map((slot) => { const pid = singleAssignment.teamA[slot]; const name = pid ? nameById[pid] : null; return <div key={slot} style={slotStyle(!!name)} onClick={() => pid && toggleSingleAssign(pid)}>{name ?? "Player " + (slot + 1)}{name && <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.5 }}>✕</span>}</div>; })}</div></div>
              <div style={{ borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}><div style={{ fontSize: 12, fontWeight: 1000, color: WARM_WHITE, marginBottom: 10, letterSpacing: 0.5 }}>TEAM B</div><div style={{ display: "grid", gap: 8 }}>{[0, 1].map((slot) => { const pid = singleAssignment.teamB[slot]; const name = pid ? nameById[pid] : null; return <div key={slot} style={slotStyle(!!name)} onClick={() => pid && toggleSingleAssign(pid)}>{name ?? "Player " + (slot + 1)}{name && <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.5 }}>✕</span>}</div>; })}</div></div>
            </div>
            {bothTeamsFull && <div style={{ ...st.hint, marginTop: 10, color: GREEN, opacity: 0.85 }}>✓ All players assigned — ready to start.</div>}
          </>
        ) : (
          <>
            <div style={st.sectionLabel}>{isTeam ? "Players — paired in join order" : "Players — " + session.players.length + (session.maxPlayers !== null ? " / " + session.maxPlayers : "")}</div>
            <div style={st.lobbyCard}>
              {session.players.length === 0 ? <div style={st.hint}>No players yet — share the code above.</div>
                : isTeam && teamPairs.length > 0 ? (
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                    {teamPairs.map((tp, i) => <div key={i} style={st.teamPairCard}><div style={{ fontSize: 12, fontWeight: 1000, color: ORANGE, minWidth: 24 }}>T{i + 1}</div><div style={{ fontSize: 13, fontWeight: 900 }}>{tp.p1} &amp; {tp.p2}</div></div>)}
                    {session.players.length % 2 !== 0 && <div style={{ ...st.teamPairCard, opacity: 0.5 }}><div style={{ fontSize: 12, fontWeight: 1000, color: ORANGE, minWidth: 24 }}>...</div><div style={{ fontSize: 13, fontWeight: 900 }}>{session.players[session.players.length - 1].name} — waiting for partner</div></div>}
                  </div>
                ) : <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>{session.players.map((p) => <div key={p.id} style={st.playerPill}>{p.name}</div>)}</div>}
            </div>
            <div style={st.sectionLabel}>Add {isTeam ? "team" : "player"} manually</div>
            {contacts.length > 0 && <div style={{ ...st.hint, marginBottom: 10 }}>Start typing to pick from your player library.</div>}
            {isTeam ? (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 1000, opacity: 0.5 }}>Team name (optional)</div>
                <input style={{ width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 900, outline: "none", boxSizing: "border-box" as const }} value={addTeamName} placeholder="e.g. Team Alpha" maxLength={30} onChange={(e) => setAddTeamName(e.target.value)} />
                <NameInput value={addName} onChange={setAddName} placeholder="Player 1 *" fieldKey="name1" {...nameInputProps} />
                <NameInput value={addName2} onChange={setAddName2} placeholder="Player 2 *" fieldKey="name2" onSubmit={addTeamPair} {...nameInputProps} />
                <button style={{ ...st.btnOrange, opacity: addLoading || !addName.trim() || !addName2.trim() ? 0.5 : 1 }} onClick={addTeamPair} disabled={addLoading || !addName.trim() || !addName2.trim()}>{addLoading ? "Adding..." : "Add team"}</button>
                <div style={st.hint}>Both player names required. Team name is optional.</div>
              </div>
            ) : (
              <div style={st.addRow}><NameInput value={addName} onChange={setAddName} placeholder="Player name" fieldKey="name1" onSubmit={addPlayerManually} {...nameInputProps} /><button style={{ ...st.btnOrange, opacity: addLoading ? 0.5 : 1 }} onClick={addPlayerManually} disabled={addLoading}>{addLoading ? "Adding..." : "Add"}</button></div>
            )}
            {addError && <div style={st.errorBox}>{addError}</div>}
          </>
        )}
        <div style={st.startSection}>
          <div><div style={{ fontWeight: 1000, fontSize: 15 }}>{canStart ? "Ready to start!" : startLabel}</div><div style={st.hint}>{startHint}</div></div>
          <button style={{ ...st.btnGreen, opacity: canStart && !startLoading ? 1 : 0.4 }} onClick={lockAndStart} disabled={!canStart || startLoading}>{startLoading ? "Starting..." : "Lock & Start"}</button>
        </div>
        {startError && <div style={st.errorBox}>{startError}</div>}
      </div></div>
    );
  }

  // ── ACTIVE / COMPLETE ──────────────────────────────────────────────────────
  const ppm = session.pointsPerMatch;
  const inProgress = session.matches.filter((m) => m.status === "IN_PROGRESS");
  const pending = session.matches.filter((m) => m.status === "PENDING");
  const complete = session.matches.filter((m) => m.status === "COMPLETE");
  const courtNumbers = Array.from({ length: session.courts }, (_, i) => i + 1);
  const subtitleParts = [fLabel, session.players.length + " players", session.courts + " court" + (session.courts > 1 ? "s" : ""), ppm + " pts"];

  // ── SINGLE ACTIVE ──────────────────────────────────────────────────────────
  if (isSingle) {
    const singleMatch = session.matches[0];
    const a1n = singleMatch ? (nameById[singleMatch.teamAPlayer1] ?? "A1") : "A1";
    const a2n = singleMatch ? (nameById[singleMatch.teamAPlayer2] ?? "A2") : "A2";
    const b1n = singleMatch ? (nameById[singleMatch.teamBPlayer1] ?? "B1") : "B1";
    const b2n = singleMatch ? (nameById[singleMatch.teamBPlayer2] ?? "B2") : "B2";
    const teamAPlayers = [a1n, a2n]; const teamBPlayers = [b1n, b2n];
    const tp = tennisPayload ?? { sets: 1, rules: { deuceMode: "traditional" as DeuceMode, tiebreak: true, superTiebreak: false } };
    const inSuperFinalSet = shouldUseSuperTB(tp, tennisState.setIndex);
    const servingTeamForHighlight: TTeam = tennisState.isTiebreak ? tennisState.tbServingTeam : tennisState.servingTeam;
    const currentServerTeam = tennisState.isTiebreak ? tennisState.tbServingTeam : tennisState.servingTeam;
    const currentServerSlot = currentServerTeam === "A" ? tennisState.nextServerA : tennisState.nextServerB;
    const currentServerName = currentServerTeam === "A" ? teamAPlayers[currentServerSlot] : teamBPlayers[currentServerSlot];
    const scoreDisplay = getScoreDisplay(tennisState);
    const deuceLabel = tp.rules.deuceMode === "golden" ? "Golden point" : tp.rules.deuceMode === "star" ? "Star point (FIP 2026)" : "Traditional advantage";
    const isStarPointMoment = !tennisState.isTiebreak && tp.rules.deuceMode === "star" && tennisState.pA >= 3 && tennisState.pB >= 3 && tennisState.adTeam === null && tennisState.deuceCount >= 2;
    const settingsSummary = tp.sets === 1 ? "1 set" : "Best of " + tp.sets;
    const liveHeaderTitle = tennisState.matchOver && tennisState.winner ? (tennisState.winner === "A" ? teamAPlayers.join(" & ") : teamBPlayers.join(" & ")) + " win!" : tennisState.isTiebreak ? (tennisState.tiebreakTarget === 10 ? "Super Tiebreak" : "Tiebreak") : "Set " + (tennisState.setIndex + 1);

    const currentSetIdx = orgSetLog.length;
    const maxGames = getMaxGames(tp, currentSetIdx);
    const detectedSetWinner = detectSetWinner(orgFinalGamesA, orgFinalGamesB, tp, currentSetIdx);
    const gameScoreValid = isGameScoreValid(orgFinalGamesA, orgFinalGamesB, tp, currentSetIdx);
    const gameScoreNonZero = orgFinalGamesA > 0 || orgFinalGamesB > 0;
    const isSuperTBSet = isFinalSetSuperTBForScore(currentSetIdx, tp);
    const maxSetsPerTeam = setsToWin(tp.sets);
    const totalSetsPlayed = orgFinalSetsA + orgFinalSetsB;
    const canIncrSetsA = orgFinalSetsA < maxSetsPerTeam && totalSetsPlayed < tp.sets;
    const canIncrSetsB = orgFinalSetsB < maxSetsPerTeam && totalSetsPlayed < tp.sets;
    const setLabel = currentSetIdx === tp.sets - 1 && isSuperTBSet ? "Super Tiebreak" : `Set ${currentSetIdx + 1}`;
    const gameUnit = isSuperTBSet ? "points" : "games";
    const matchIsOver = orgFinalSetsA >= maxSetsPerTeam || orgFinalSetsB >= maxSetsPerTeam;
    const matchWinnerTeam: TTeam | null = orgFinalSetsA >= maxSetsPerTeam ? "A" : orgFinalSetsB >= maxSetsPerTeam ? "B" : null;

    return (
      <div style={st.page}><div style={{ ...st.card, maxWidth: 760 }}>

        <div style={{ background: NAVY, borderRadius: 16, padding: 14, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" as const }}>
            <div>
              <div style={{ fontWeight: 1000, fontSize: 22 }}>
                {orgScoringMode === "live" ? liveHeaderTitle : a1n + " & " + a2n + " vs " + b1n + " & " + b2n}
              </div>
              {orgScoringMode === "live" && <div style={{ fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4 }}>Sets {tennisState.setsA} - {tennisState.setsB} · Games {tennisState.gamesA} - {tennisState.gamesB}{inSuperFinalSet && !tennisState.matchOver ? " · Super tiebreak" : ""}</div>}
              {orgScoringMode === "live" && showServeHelper && !tennisState.matchOver && <div style={{ fontSize: 13, marginTop: 6, fontWeight: 1000, color: ORANGE }}>Serving: {currentServerName}</div>}
              {orgScoringMode === "final" && <div style={{ fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4 }}>{settingsSummary} · {deuceLabel}</div>}
              <div style={{ fontSize: 12, color: WARM_WHITE, opacity: 0.45, marginTop: 2 }}>{formatSessionDateTime(session.createdAt)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, justifyContent: "flex-end" }}>
                {orgScoringMode === "live" && <div style={tennisChip(showServeHelper)} onClick={() => setShowServeHelper((v) => !v)}>Serve helper</div>}
                {orgScoringMode === "live" && <div style={tennisChip(false)} onClick={tennisRandomServer}>Random server</div>}
                <div style={tennisChip(showSettings)} onClick={() => showSettings ? setShowSettings(false) : openSettings()}>⚙ Settings {showSettings ? "▲" : "▼"}</div>
              </div>
              <button style={st.btn} onClick={() => router.push("/")}>Home</button>
            </div>
          </div>
        </div>

        {showSettings && (
          <div style={st.settingsPanel}>
            <div style={{ fontWeight: 1000, fontSize: 14, color: ORANGE }}>Match rules — changes take effect immediately</div>
            <div><div style={{ fontSize: 11, fontWeight: 1000, opacity: 0.45, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 8 }}>Number of sets</div><div style={st.settingsPillRow}>{[1, 3, 5].map((n) => <div key={n} style={setPillStyle(editSets === n)} onClick={() => setEditSets(n)}>{n === 1 ? "1 set" : "Best of " + n}</div>)}</div></div>
            <div><div style={{ fontSize: 11, fontWeight: 1000, opacity: 0.45, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 8 }}>Deuce rule</div><div style={st.settingsDeuceGrid}>{DEUCE_OPTIONS.map((opt) => <div key={opt.value} style={deuceCardStyle(editDeuceMode === opt.value)} onClick={() => setEditDeuceMode(opt.value)}><div style={{ fontSize: 13, fontWeight: 1000 }}>{opt.label}</div><div style={{ fontSize: 11, opacity: 0.5, color: WARM_WHITE }}>{opt.desc}</div></div>)}</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={st.settingsToggle}><div><div style={{ fontWeight: 900, fontSize: 13 }}>Tiebreak at 6-6</div><div style={{ fontSize: 11, opacity: 0.5, color: WARM_WHITE, marginTop: 2 }}>First to 7 points, win by 2</div></div><input type="checkbox" checked={editTiebreak} onChange={(e) => setEditTiebreak(e.target.checked)} style={{ transform: "scale(1.4)", accentColor: ORANGE }} /></div>
              <div style={{ ...st.settingsToggle, opacity: editSets === 1 ? 0.4 : 1 }}><div><div style={{ fontWeight: 900, fontSize: 13 }}>Super tiebreak — final set</div><div style={{ fontSize: 11, opacity: 0.5, color: WARM_WHITE, marginTop: 2 }}>{editSets === 1 ? "Not applicable for 1 set" : "Final set replaced by first to 10, win by 2"}</div></div><input type="checkbox" checked={editSets === 1 ? false : editSuperTiebreak} onChange={(e) => setEditSuperTiebreak(e.target.checked)} disabled={editSets === 1} style={{ transform: "scale(1.4)", accentColor: ORANGE }} /></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}><button style={{ ...st.btnOrange, flex: 1, textAlign: "center" as const }} onClick={saveSettings}>Save & close</button><button style={st.btn} onClick={() => setShowSettings(false)}>Cancel</button></div>
          </div>
        )}

        <div style={st.modeToggle}>
          <button style={modeTabStyle(orgScoringMode === "final")} onClick={() => setOrgScoringMode("final")}>Final score</button>
          <button style={modeTabStyle(orgScoringMode === "live")} onClick={() => setOrgScoringMode("live")}>Live scoring</button>
        </div>

        {orgScoringMode === "final" && (
          <>
            {/* ── Match winner banner ── */}
            {matchIsOver && matchWinnerTeam && (
              <div style={{ marginBottom: 16, borderRadius: 16, padding: "16px 20px", background: "rgba(0,200,80,0.10)", border: "1px solid rgba(0,200,80,0.35)", textAlign: "center" as const }}>
                <div style={{ fontSize: 20, fontWeight: 1100, color: GREEN }}>
                  🏆 Team {matchWinnerTeam} wins! ({orgFinalSetsA}–{orgFinalSetsB} sets)
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6, color: WARM_WHITE }}>Submit the result below.</div>
              </div>
            )}

            {/* ── Games entry — hidden once match is decided ── */}
            {!matchIsOver && (
              <>
                <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginBottom: 10 }}>
                  {setLabel} — {gameUnit}
                  {isSuperTBSet && <span style={{ color: ORANGE, marginLeft: 8, opacity: 1 }}>Super Tiebreak</span>}
                </div>

                <div style={st.grid2}>
                  <div>
                    <div style={st.teamLabel}>Team A · {a1n} &amp; {a2n}</div>
                    <div style={st.scoreRow}>
                      <button style={{ ...st.stepBtn, opacity: orgFinalGamesA === 0 ? 0.35 : 1 }} onClick={() => setOrgFinalGamesA((v) => Math.max(0, v - 1))} disabled={orgFinalGamesA === 0}>−</button>
                      <div style={{ ...st.bigNum, color: detectedSetWinner === "A" ? GREEN : WHITE }}>{orgFinalGamesA}</div>
                      <button style={{ ...st.stepBtn, opacity: orgFinalGamesA >= maxGames ? 0.35 : 1 }} onClick={() => setOrgFinalGamesA((v) => Math.min(maxGames, v + 1))} disabled={orgFinalGamesA >= maxGames}>+</button>
                    </div>
                  </div>
                  <div>
                    <div style={st.teamLabel}>Team B · {b1n} &amp; {b2n}</div>
                    <div style={st.scoreRow}>
                      <button style={{ ...st.stepBtn, opacity: orgFinalGamesB === 0 ? 0.35 : 1 }} onClick={() => setOrgFinalGamesB((v) => Math.max(0, v - 1))} disabled={orgFinalGamesB === 0}>−</button>
                      <div style={{ ...st.bigNum, color: detectedSetWinner === "B" ? GREEN : WHITE }}>{orgFinalGamesB}</div>
                      <button style={{ ...st.stepBtn, opacity: orgFinalGamesB >= maxGames ? 0.35 : 1 }} onClick={() => setOrgFinalGamesB((v) => Math.min(maxGames, v + 1))} disabled={orgFinalGamesB >= maxGames}>+</button>
                    </div>
                  </div>
                </div>

                {detectedSetWinner && (
                  <div style={st.gameWinnerBanner}>
                    <div style={{ fontSize: 14, fontWeight: 1000, color: GREEN }}>
                      ✓ Team {detectedSetWinner} wins {setLabel} ({orgFinalGamesA}–{orgFinalGamesB})
                    </div>
                    <button style={st.confirmSetBtn} onClick={() => orgConfirmSet(detectedSetWinner)}>
                      Confirm {setLabel}
                    </button>
                  </div>
                )}

                {gameScoreNonZero && !detectedSetWinner && !gameScoreValid && (
                  <div style={st.gameWarnBanner}>
                    ⚠ {orgFinalGamesA}–{orgFinalGamesB} is not a valid {isSuperTBSet ? "super tiebreak score (first to 10, win by 2)" : "game score (max 7-6 or 7-5)"}
                  </div>
                )}

                {gameScoreNonZero && !detectedSetWinner && gameScoreValid && (orgFinalGamesA !== orgFinalGamesB) && (
                  <div style={{ marginTop: 10, textAlign: "center" as const }}>
                    <button style={{ borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", color: WHITE }}
                      onClick={() => { const w = orgFinalGamesA > orgFinalGamesB ? "A" : "B"; orgConfirmSet(w); }}>
                      Manually complete {setLabel}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Sets ── */}
            <div style={st.sectionDivider} />

            <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginBottom: 6 }}>
              Sets won <span style={{ opacity: 0.5, fontWeight: 900 }}>· {tp.sets === 1 ? "1 set" : "Best of " + tp.sets} · adjust manually if needed</span>
            </div>

            <div style={st.setScoreDisplay}>
              <div style={{ textAlign: "center" as const }}>
                <div style={{ fontSize: 44, fontWeight: 1200, lineHeight: 1, display: "flex", alignItems: "baseline", gap: 12, justifyContent: "center" }}>
                  <span style={{ color: orgFinalSetsA > orgFinalSetsB ? ORANGE : WHITE }}>{orgFinalSetsA}</span>
                  <span style={{ opacity: 0.25, fontSize: 28 }}>–</span>
                  <span style={{ color: orgFinalSetsB > orgFinalSetsA ? ORANGE : WHITE }}>{orgFinalSetsB}</span>
                </div>
              </div>
            </div>

            <div style={st.grid2}>
              <div>
                <div style={st.teamLabel}>Team A sets</div>
                <div style={st.scoreRow}>
                  <button style={{ ...st.stepBtn, opacity: orgFinalSetsA === 0 ? 0.35 : 1 }} onClick={() => setOrgFinalSetsA((v) => Math.max(0, v - 1))} disabled={orgFinalSetsA === 0}>−</button>
                  <div style={st.bigNum}>{orgFinalSetsA}</div>
                  <button style={{ ...st.stepBtn, opacity: !canIncrSetsA ? 0.35 : 1 }} onClick={() => { if (canIncrSetsA) setOrgFinalSetsA((v) => v + 1); }} disabled={!canIncrSetsA}>+</button>
                </div>
              </div>
              <div>
                <div style={st.teamLabel}>Team B sets</div>
                <div style={st.scoreRow}>
                  <button style={{ ...st.stepBtn, opacity: orgFinalSetsB === 0 ? 0.35 : 1 }} onClick={() => setOrgFinalSetsB((v) => Math.max(0, v - 1))} disabled={orgFinalSetsB === 0}>−</button>
                  <div style={st.bigNum}>{orgFinalSetsB}</div>
                  <button style={{ ...st.stepBtn, opacity: !canIncrSetsB ? 0.35 : 1 }} onClick={() => { if (canIncrSetsB) setOrgFinalSetsB((v) => v + 1); }} disabled={!canIncrSetsB}>+</button>
                </div>
              </div>
            </div>

            {orgSetLog.length > 0 && (
              <div style={{ marginTop: 8, display: "grid", gap: 2 }}>
                {orgSetLog.map((s, i) => <div key={i} style={st.setLogItem}>Set {i + 1}: {s.gamesA}–{s.gamesB} · {s.gamesA > s.gamesB ? "Team A won" : "Team B won"}</div>)}
              </div>
            )}

            <div style={{ ...st.hint, marginTop: 8, textAlign: "center" as const }}>
              Max {maxSetsPerTeam} sets per team · {tp.sets} total sets in match
            </div>

            <button style={{ ...st.primaryBtn, opacity: orgSubmitting ? 0.5 : 1 }} onClick={submitOrgFinalScore} disabled={orgSubmitting}>
              {orgSubmitting ? "Submitting..." : "Submit match result"}
            </button>
          </>
        )}

        {orgScoringMode === "live" && (
          <>
            {isStarPointMoment && <div style={st.starPointBanner}>Star Point — next point wins the game</div>}
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
                        {players[0]}{showServeHelper && currentServerTeam === team && currentServerSlot === 0 ? " *" : ""}<br />
                        {players[1]}{showServeHelper && currentServerTeam === team && currentServerSlot === 1 ? " *" : ""}
                      </div>
                      <div style={st.tennisScoreRow}>
                        <div style={st.tennisScoreBox}><div style={st.tennisScoreLabel}>Sets</div><div style={st.tennisScoreMid}>{setsVal}</div></div>
                        <div style={st.tennisScoreBox}><div style={st.tennisScoreLabel}>{tennisState.isTiebreak ? "TB" : "Points"}</div><div style={st.tennisScoreBig}>{scoreVal}</div></div>
                        <div style={st.tennisScoreBox}><div style={st.tennisScoreLabel}>Games</div><div style={st.tennisScoreMid}>{gamesVal}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {tennisState.matchOver && tennisState.winner && (
              <div style={{ ...st.tennisWinnerBanner, marginTop: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 1100, color: ORANGE }}>{tennisState.winner === "A" ? teamAPlayers.join(" & ") : teamBPlayers.join(" & ")} win!</div>
                <div style={{ fontSize: 14, color: WARM_WHITE, opacity: 0.7, marginTop: 6 }}>{tennisState.setsA} - {tennisState.setsB} sets · Score saved automatically</div>
              </div>
            )}
            {!tennisState.matchOver && (
              <div style={st.tennisControls}>
                <button style={st.tennisBtnA} onClick={() => tennisAddPoint("A")}>Point A</button>
                <button style={st.tennisBtnB} onClick={() => tennisAddPoint("B")}>Point B</button>
              </div>
            )}
            <div style={st.tennisActionRow}>
              <button style={{ ...st.tennisSmallBtn, opacity: tennisHistory.length === 0 ? 0.4 : 1 }} onClick={tennisUndo} disabled={tennisHistory.length === 0}>Undo</button>
              <button style={st.tennisSmallBtn} onClick={tennisReset}>Reset</button>
              <button style={st.btn} onClick={() => router.push("/")}>Home</button>
            </div>
            <div style={{ fontSize: 12, color: WARM_WHITE, opacity: 0.45, textAlign: "center" as const, paddingTop: 10, lineHeight: 1.5 }}>
              {settingsSummary} · {deuceLabel}{tp.rules.tiebreak ? " · Tiebreak at 6-6" : ""}{tp.rules.superTiebreak && tp.sets > 1 ? " · Super tiebreak final set" : ""}
            </div>
          </>
        )}
      </div></div>
    );
  }

  // ── MIXED / TEAM ACTIVE ────────────────────────────────────────────────────
  const leaderboard: LeaderRow[] = (() => {
    const base = new Map<string, LeaderRow>();
    for (const p of session.players) base.set(p.id, { playerId: p.id, name: p.name, played: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 });
    for (const m of complete) { const pA = m.pointsA ?? 0; const pB = m.pointsB ?? 0; for (const pid of [m.teamAPlayer1, m.teamAPlayer2]) { const r = base.get(pid); if (r) { r.played++; r.pointsFor += pA; r.pointsAgainst += pB; if (pA > pB) r.wins++; else if (pA === pB) r.draws++; else r.losses++; } } for (const pid of [m.teamBPlayer1, m.teamBPlayer2]) { const r = base.get(pid); if (r) { r.played++; r.pointsFor += pB; r.pointsAgainst += pA; if (pB > pA) r.wins++; else if (pB === pA) r.draws++; else r.losses++; } } }
    return Array.from(base.values()).map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst })).sort((a, b) => b.diff !== a.diff ? b.diff - a.diff : b.pointsFor !== a.pointsFor ? b.pointsFor - a.pointsFor : a.name.localeCompare(b.name));
  })();

  const spr = session.servesPerRotation;
  const serveReminderText = spr ? "Serve rotation: A1 - B1 - A2 - B2 · " + spr + " point" + (spr > 1 ? "s" : "") + " each" : null;
  const courtGridCols = (session.courts >= 2 && !isMobile) ? "repeat(2, minmax(0,1fr))" : "1fr";
  function getEntryA(matchId: string): string { return courtScores[matchId]?.rawA ?? ""; }
  function getEntryB(matchId: string): string { const raw = courtScores[matchId]?.rawA ?? ""; const n = parseInt(raw, 10); if (raw === "" || isNaN(n) || n < 0 || n > ppm) return ""; return String(ppm - n); }
  function isValidEntry(matchId: string): boolean { const raw = courtScores[matchId]?.rawA ?? ""; const n = parseInt(raw, 10); return raw !== "" && !isNaN(n) && n >= 0 && n <= ppm; }

  return (
    <div style={st.page}><div style={st.card}>
      <div style={st.row}>
        <div><div style={st.title}>Organiser · {code}</div>{session.name && <div style={{ fontSize: 15, fontWeight: 900, color: WHITE, opacity: 0.85, marginTop: 2 }}>{session.name}</div>}<div style={st.sub}>{subtitleParts.join(" · ")}</div><div style={{ fontSize: 12, color: WARM_WHITE, opacity: 0.45, marginTop: 2 }}>{formatSessionDateTime(session.createdAt)}</div></div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {session.status === "ACTIVE" && <button style={{ ...st.btnRed, opacity: inProgress.length > 0 ? 0.35 : 1 }} onClick={() => { if (inProgress.length === 0) { setEndConfirm(true); setEndError(""); } }} disabled={inProgress.length > 0}>End session</button>}
          <button style={st.btn} onClick={() => router.push("/")}>Home</button>
        </div>
      </div>
      <div style={st.pillsRow}>
        {pill(inProgress.length + " playing", "rgba(255,107,0,0.18)", "rgba(255,107,0,0.45)")}
        {pill(pending.length + " queued", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)")}
        {pill(complete.length + " done", "rgba(0,200,80,0.12)", "rgba(0,200,80,0.35)", complete.length > 0 ? () => router.push("/session/" + code + "/organiser/results") : undefined)}
      </div>
      {complete.length > 0 && <div style={{ ...st.hint, marginTop: 6 }}>Tap <strong style={{ color: GREEN }}>{complete.length} done</strong> to view and edit confirmed match scores.</div>}
      {serveReminderText && <div style={st.serveReminder}>{serveReminderText}</div>}
      <div style={st.divider} />
      <div style={st.sectionLabel}>Courts</div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: courtGridCols }}>
        {courtNumbers.map((cn) => {
          const m = inProgress.find((x) => x.courtNumber === cn);
          if (!m) return <div key={cn} style={{ ...st.courtCard, opacity: 0.45 }}><div style={{ fontWeight: 1000, fontSize: 14, color: ORANGE }}>Court {cn}</div><div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Open — no active match</div></div>;
          const { a1, a2, b1, b2 } = names(m); const hasScore = m.pointsA !== null && m.pointsB !== null;
          const rawA = getEntryA(m.id); const rawB = getEntryB(m.id); const valid = isValidEntry(m.id);
          const entryANum = parseInt(rawA, 10); const entryBNum = parseInt(rawB, 10);
          if (hasScore) { const dA = m.pointsA!; const dB = m.pointsB!; return <div key={cn} style={{ ...st.courtCard, borderColor: "rgba(0,200,80,0.3)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ fontWeight: 1000, fontSize: 14, color: ORANGE }}>Court {cn}</div><span style={{ fontSize: 11, fontWeight: 1000, color: GREEN }}>Done</span></div><div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6, alignItems: "center" }}><div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 10, opacity: 0.5, fontWeight: 900, marginBottom: 3 }}>Team A</div><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.85, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{a1} &amp; {a2}</div><div style={{ fontSize: 26, fontWeight: 1150, color: dA > dB ? GREEN : dA < dB ? RED : WHITE }}>{dA}</div></div><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.4, textAlign: "center" as const }}>vs</div><div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 10px", textAlign: "right" as const }}><div style={{ fontSize: 10, opacity: 0.5, fontWeight: 900, marginBottom: 3 }}>Team B</div><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.85, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b1} &amp; {b2}</div><div style={{ fontSize: 26, fontWeight: 1150, color: dB > dA ? GREEN : dB < dA ? RED : WHITE }}>{dB}</div></div></div></div>; }
          return <div key={cn} style={{ ...st.courtCard, borderColor: "rgba(255,107,0,0.2)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ fontWeight: 1000, fontSize: 14, color: ORANGE }}>Court {cn}</div><span style={{ fontSize: 11, fontWeight: 1000, color: WARM_WHITE, opacity: 0.6 }}>In play</span></div><div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6, alignItems: "center", marginBottom: 8 }}><div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 10, opacity: 0.5, fontWeight: 900, marginBottom: 2 }}>Team A</div><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.85, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{a1} &amp; {a2}</div><input inputMode="numeric" placeholder="—" value={rawA} onChange={(e) => { const val = e.target.value.replace(/[^\d]/g, ""); const n = parseInt(val, 10); if (val === "" || (!isNaN(n) && n <= ppm)) setCourtScores((prev) => ({ ...prev, [m.id]: { rawA: val } })); }} style={{ width: "100%", background: rawA !== "" ? "rgba(255,107,0,0.10)" : "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid " + (rawA !== "" ? "rgba(255,107,0,0.45)" : "rgba(255,255,255,0.14)"), borderRadius: 8, padding: "8px 6px", fontSize: 26, fontWeight: 1150, textAlign: "center" as const, outline: "none", boxSizing: "border-box" as const }} /></div><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.4, textAlign: "center" as const }}>vs</div><div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 10px", textAlign: "right" as const }}><div style={{ fontSize: 10, opacity: 0.5, fontWeight: 900, marginBottom: 2 }}>Team B</div><div style={{ fontSize: 11, fontWeight: 900, opacity: 0.85, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b1} &amp; {b2}</div><div style={{ width: "100%", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 6px", fontSize: 26, fontWeight: 1150, textAlign: "center" as const, border: "1px solid rgba(255,255,255,0.08)", color: rawB !== "" ? WHITE : "rgba(255,255,255,0.2)", boxSizing: "border-box" as const }}>{rawB !== "" ? rawB : "—"}</div></div></div><div style={{ fontSize: 11, opacity: 0.4, textAlign: "center" as const, marginBottom: 8 }}>{valid ? "Tap submit to confirm" : "Enter Team A score — Team B auto-calculates"}</div><button style={{ width: "100%", borderRadius: 10, padding: "12px 10px", fontSize: 13, fontWeight: 1000, cursor: valid ? "pointer" : "default", border: "none", background: valid ? ORANGE : "rgba(255,255,255,0.08)", color: valid ? WHITE : "rgba(255,255,255,0.3)" }} onClick={() => submitCourtScore(m.id, ppm)} disabled={!valid || submitLoading === m.id}>{submitLoading === m.id ? "Submitting..." : valid ? "Submit " + entryANum + " - " + entryBNum : "Enter score above"}</button></div>;
        })}
      </div>
      {pending.length > 0 && (<><div style={st.sectionLabel}>Queue — {pending.length} match{pending.length !== 1 ? "es" : ""} waiting</div>{pending.map((m) => { const { a1, a2, b1, b2 } = names(m); return <div key={m.id} style={st.queueCard}><div style={st.names}>{a1} &amp; {a2} <span style={{ opacity: 0.4 }}>vs</span> {b1} &amp; {b2}</div><div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" as const }}>{courtNumbers.map((cn) => { const busy = inProgress.some((x) => x.courtNumber === cn); return <button key={cn} style={{ ...st.btn, opacity: busy ? 0.3 : 1 }} onClick={() => { if (!busy) startMatch(m.id, cn); }} disabled={busy}>Court {cn}</button>; })}</div></div>; })}</>)}
      {endConfirm && <div style={st.endConfirmBox}><div style={{ fontWeight: 1000, fontSize: 14 }}>End session now?</div><div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>This will finalise the leaderboard based on completed matches and push results to all players. Remaining queued matches will be cancelled. This cannot be undone.</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}><button style={{ ...st.btnRed, opacity: endLoading ? 0.5 : 1 }} onClick={endSession} disabled={endLoading}>{endLoading ? "Ending..." : "Yes, end session"}</button><button style={st.btn} onClick={() => { setEndConfirm(false); setEndError(""); }}>Cancel</button></div>{endError && <div style={{ fontSize: 13, color: RED, fontWeight: 900 }}>{endError}</div>}</div>}
      {pending.length === 0 && inProgress.length === 0 && complete.length > 0 && !endConfirm && <div style={{ marginTop: 8, borderRadius: 18, padding: 24, background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.30)", textAlign: "center" as const }}><div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div><div style={{ fontSize: 22, fontWeight: 1100, color: ORANGE }}>Session Complete!</div><div style={{ fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 6 }}>All {complete.length} matches finished</div><button style={{ marginTop: 16, borderRadius: 14, padding: "13px 24px", fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE }} onClick={() => router.push("/session/" + code + "/organiser/results")}>View Full Results</button></div>}
      <div style={st.divider} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const }}>Leaderboard</div>
        {complete.length > 0 && <button style={{ borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(0,200,80,0.35)", background: "rgba(0,200,80,0.08)", color: GREEN, whiteSpace: "nowrap" as const }} onClick={() => router.push("/session/" + code + "/organiser/results")}>View all results</button>}
      </div>
      <div style={st.lbWrap}>
        <div style={st.lbHead}><div style={st.lbCenter}>Rank</div><div>Player</div>{!isMobile && <div style={st.lbCenter}>W / D / L</div>}{!isMobile && <div style={st.lbRight}>Points</div>}<div style={st.lbRight}>Diff</div></div>
        {leaderboard.map((r, idx) => { const isTop3 = idx < 3 && r.played > 0; return <div key={r.playerId} style={{ ...st.lbRow, background: isTop3 ? "rgba(255,107,0,0.10)" : "rgba(255,255,255,0.04)", border: "1px solid " + (isTop3 ? "rgba(255,107,0,0.30)" : "rgba(255,255,255,0.07)") }}><div style={{ fontSize: 15, fontWeight: 1100, textAlign: "center" as const, color: idx === 0 && r.played > 0 ? ORANGE : WHITE }}>{idx + 1}</div><div style={{ fontWeight: 950, fontSize: 14 }}>{r.name}</div>{!isMobile && <div style={{ ...st.lbCenter, fontSize: 13, fontWeight: 1000 }}><span style={{ color: GREEN }}>{r.wins}</span><span style={{ opacity: 0.35, margin: "0 3px" }}>/</span><span style={{ color: WHITE }}>{r.draws}</span><span style={{ opacity: 0.35, margin: "0 3px" }}>/</span><span style={{ color: RED }}>{r.losses}</span></div>}{!isMobile && <div style={{ ...st.lbRight, fontSize: 13, fontWeight: 1000 }}>{r.pointsFor} - {r.pointsAgainst}</div>}<div style={{ ...st.lbRight, fontSize: 13, fontWeight: 1100, color: r.diff > 0 ? GREEN : r.diff < 0 ? RED : WHITE }}>{r.diff > 0 ? "+" + r.diff : r.diff}</div></div>; })}
        {complete.length === 0 && <div style={st.hint}>No completed matches yet.</div>}
      </div>
    </div></div>
  );
}