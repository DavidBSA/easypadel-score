"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const STORAGE_MATCH_KEY = "eps_match_payload";

type Team = "A" | "B";
type DeuceMode = "star" | "golden" | "traditional";

type MatchRules = {
  deuceMode: DeuceMode;
  tiebreak: boolean;
  superTiebreak: boolean;
};

type MatchPayload = {
  sessionCode: string;
  players: { slot: string; name: string }[];
  sets: number;
  rules: MatchRules;
};

type Snapshot = {
  gamesA: number;
  gamesB: number;
  setsA: number;
  setsB: number;
  setIndex: number;

  pA: number;
  pB: number;
  adTeam: Team | null;
  deuceCount: number; // how many times deuce has been reached this game

  isTiebreak: boolean;
  tiebreakTarget: number;
  tbA: number;
  tbB: number;
  tbPointNumber: number;
  tbServingTeam: Team;
  tbPointsLeftInTurn: number;

  servingTeam: Team;
  nextServerA: 0 | 1;
  nextServerB: 0 | 1;

  matchOver: boolean;
  winner: Team | null;
};

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

function setsToWin(totalSets: number) {
  return Math.ceil(totalSets / 2);
}

function isFinalSet(setIndex: number, totalSets: number) {
  return setIndex === totalSets - 1;
}

function shouldUseSuperTiebreak(payload: MatchPayload, setIndex: number) {
  return payload.rules.superTiebreak && isFinalSet(setIndex, payload.sets) && payload.sets > 1;
}

function tiebreakWinner(tbA: number, tbB: number, target: number): Team | null {
  if ((tbA >= target || tbB >= target) && Math.abs(tbA - tbB) >= 2) {
    return tbA > tbB ? "A" : "B";
  }
  return null;
}

function normalSetWinner(gA: number, gB: number): Team | null {
  if ((gA >= 6 || gB >= 6) && Math.abs(gA - gB) >= 2) return gA > gB ? "A" : "B";
  return null;
}

function toggle01(v: 0 | 1): 0 | 1 {
  return v === 0 ? 1 : 0;
}

const INITIAL_STATE: Snapshot = {
  gamesA: 0, gamesB: 0,
  setsA: 0, setsB: 0,
  setIndex: 0,
  pA: 0, pB: 0,
  adTeam: null,
  deuceCount: 0,
  isTiebreak: false,
  tiebreakTarget: 7,
  tbA: 0, tbB: 0,
  tbPointNumber: 0,
  tbServingTeam: "A",
  tbPointsLeftInTurn: 1,
  servingTeam: "A",
  nextServerA: 0,
  nextServerB: 0,
  matchOver: false,
  winner: null,
};

export default function MatchPage() {
  const router = useRouter();

  const [payload, setPayload] = useState<MatchPayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [showServeHelper, setShowServeHelper] = useState(true);
  const [state, setState] = useState<Snapshot>(INITIAL_STATE);

  useEffect(() => {
    const p = safeParseJSON<MatchPayload | null>(localStorage.getItem(STORAGE_MATCH_KEY), null);
    setPayload(p);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !payload) router.push("/match/setup");
  }, [loaded, payload, router]);

  function pushHistory(prev: Snapshot) {
    setHistory((h) => [...h, prev]);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      setState(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  function randomFirstServer() {
    const firstTeam: Team = Math.random() < 0.5 ? "A" : "B";
    const a: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    const b: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    setHistory((h) => [...h, state]);
    setState((prev) => ({
      ...prev,
      servingTeam: firstTeam,
      nextServerA: a,
      nextServerB: b,
      tbServingTeam: prev.isTiebreak ? firstTeam : prev.tbServingTeam,
      tbPointsLeftInTurn: prev.isTiebreak ? 1 : prev.tbPointsLeftInTurn,
    }));
  }

  const teamAPlayers = useMemo(() => {
    if (!payload) return ["A1", "A2"];
    return [
      payload.players.find((p) => p.slot === "teamA1")?.name ?? "A1",
      payload.players.find((p) => p.slot === "teamA2")?.name ?? "A2",
    ];
  }, [payload]);

  const teamBPlayers = useMemo(() => {
    if (!payload) return ["B1", "B2"];
    return [
      payload.players.find((p) => p.slot === "teamB1")?.name ?? "B1",
      payload.players.find((p) => p.slot === "teamB2")?.name ?? "B2",
    ];
  }, [payload]);

  const targetSetsToWin = useMemo(() => (payload ? setsToWin(payload.sets) : 1), [payload]);

  const inSuperFinalSet = useMemo(() => {
    if (!payload) return false;
    return shouldUseSuperTiebreak(payload, state.setIndex);
  }, [payload, state.setIndex]);

  const currentServerInfo = useMemo(() => {
    const servingTeam: Team = state.isTiebreak ? state.tbServingTeam : state.servingTeam;
    if (servingTeam === "A") {
      return { team: "A" as Team, playerIndex: state.nextServerA, name: teamAPlayers[state.nextServerA] };
    }
    return { team: "B" as Team, playerIndex: state.nextServerB, name: teamBPlayers[state.nextServerB] };
  }, [state, teamAPlayers, teamBPlayers]);

  const scoreDisplay = useMemo(() => {
    if (state.isTiebreak) return { a: String(state.tbA), b: String(state.tbB) };
    const map = ["0", "15", "30", "40"];
    if (state.pA >= 3 && state.pB >= 3) {
      if (state.adTeam === "A") return { a: "AD", b: "40" };
      if (state.adTeam === "B") return { a: "40", b: "AD" };
      return { a: "40", b: "40" };
    }
    return { a: map[clamp(state.pA, 0, 3)], b: map[clamp(state.pB, 0, 3)] };
  }, [state]);

  // ─── Scoring logic ────────────────────────────────────────────────────────

  function checkMatchWinner(next: Snapshot): Snapshot {
    if (!payload) return next;
    const needed = setsToWin(payload.sets);
    if (next.setsA >= needed) return { ...next, matchOver: true, winner: "A" };
    if (next.setsB >= needed) return { ...next, matchOver: true, winner: "B" };
    return next;
  }

  function startTiebreak(prev: Snapshot, target: number): Snapshot {
    return {
      ...prev,
      isTiebreak: true,
      tiebreakTarget: target,
      tbA: 0, tbB: 0,
      tbPointNumber: 0,
      tbServingTeam: prev.servingTeam,
      tbPointsLeftInTurn: 1,
      pA: 0, pB: 0,
      adTeam: null,
      deuceCount: 0,
    };
  }

  function rotateServeAfterGame(prev: Snapshot): Snapshot {
    if (prev.servingTeam === "A") {
      return { ...prev, nextServerA: toggle01(prev.nextServerA), servingTeam: "B" };
    }
    return { ...prev, nextServerB: toggle01(prev.nextServerB), servingTeam: "A" };
  }

  function rotateServeAfterTiebreakPoint(prev: Snapshot): Snapshot {
    const remaining = prev.tbPointsLeftInTurn - 1;
    if (remaining > 0) return { ...prev, tbPointsLeftInTurn: remaining };
    const newTeam: Team = prev.tbServingTeam === "A" ? "B" : "A";
    const next = { ...prev, tbServingTeam: newTeam, tbPointsLeftInTurn: 2 };
    if (newTeam === "A") next.nextServerA = toggle01(next.nextServerA);
    else next.nextServerB = toggle01(next.nextServerB);
    return next;
  }

  function winGame(prev: Snapshot, winnerTeam: Team): Snapshot {
    let next: Snapshot = { ...prev };
    if (winnerTeam === "A") next.gamesA += 1;
    else next.gamesB += 1;
    next.pA = 0; next.pB = 0; next.adTeam = null; next.deuceCount = 0;
    next = rotateServeAfterGame(next);

    const setWin = normalSetWinner(next.gamesA, next.gamesB);
    if (setWin) {
      if (setWin === "A") next.setsA += 1;
      else next.setsB += 1;
      next.gamesA = 0; next.gamesB = 0;
      next.isTiebreak = false; next.tiebreakTarget = 7;
      next.tbA = 0; next.tbB = 0; next.tbPointNumber = 0;
      next.tbServingTeam = next.servingTeam; next.tbPointsLeftInTurn = 1;
      next.setIndex += 1;
      next = checkMatchWinner(next);
      if (!next.matchOver && payload && shouldUseSuperTiebreak(payload, next.setIndex)) {
        next = startTiebreak(next, 10);
      }
      return next;
    }

    // Tiebreak at 6-6 (if enabled and not the super final set)
    if (
      payload?.rules.tiebreak &&
      !shouldUseSuperTiebreak(payload, prev.setIndex) &&
      next.gamesA === 6 && next.gamesB === 6
    ) {
      next = startTiebreak(next, 7);
    }

    return next;
  }

  function winTiebreakAsSet(prev: Snapshot, winnerTeam: Team): Snapshot {
    let next: Snapshot = { ...prev };
    if (winnerTeam === "A") next.setsA += 1;
    else next.setsB += 1;
    next.isTiebreak = false; next.tiebreakTarget = 7;
    next.tbA = 0; next.tbB = 0; next.tbPointNumber = 0; next.tbPointsLeftInTurn = 1;
    next.gamesA = 0; next.gamesB = 0;
    next.pA = 0; next.pB = 0; next.adTeam = null; next.deuceCount = 0;
    next.setIndex += 1;
    next = checkMatchWinner(next);
    if (!next.matchOver && payload && shouldUseSuperTiebreak(payload, next.setIndex)) {
      next = startTiebreak(next, 10);
    }
    return next;
  }

  function addPoint(team: Team) {
    if (!payload) return;
    setState((prev) => {
      if (prev.matchOver) return prev;
      pushHistory(prev);

      // ── Tiebreak ──
      if (prev.isTiebreak) {
        let next: Snapshot = { ...prev };
        if (team === "A") next.tbA += 1;
        else next.tbB += 1;
        next.tbPointNumber += 1;
        next = rotateServeAfterTiebreakPoint(next);
        const tbWin = tiebreakWinner(next.tbA, next.tbB, next.tiebreakTarget);
        if (tbWin) next = winTiebreakAsSet(next, tbWin);
        return next;
      }

      const mode = payload.rules.deuceMode;

      // ── Deuce zone ──
      if (prev.pA >= 3 && prev.pB >= 3) {
        // Golden point — next point wins immediately
        if (mode === "golden") return winGame(prev, team);

        // Star Point — two advantages allowed, then deciding point
        if (mode === "star") {
          if (prev.adTeam === null) {
            // First deuce — grant advantage
            return { ...prev, adTeam: team, deuceCount: prev.deuceCount };
          }
          if (prev.adTeam === team) {
            // Won from advantage
            return winGame(prev, team);
          }
          // Lost advantage — back to deuce
          const newDeuceCount = prev.deuceCount + 1;
          if (newDeuceCount >= 2) {
            // Second deuce reached — next point is Star Point (deciding)
            // We represent this as golden point from here: adTeam null, deuceCount >= 2
            return { ...prev, adTeam: null, deuceCount: newDeuceCount };
          }
          return { ...prev, adTeam: null, deuceCount: newDeuceCount };
        }

        // Traditional — unlimited advantage
        if (prev.adTeam === null) return { ...prev, adTeam: team };
        if (prev.adTeam === team) return winGame(prev, team);
        return { ...prev, adTeam: null };
      }

      // ── Normal scoring ──
      let next: Snapshot = { ...prev };
      if (team === "A") next.pA += 1;
      else next.pB += 1;

      if (next.pA >= 4 && next.pB <= 2) return winGame(prev, "A");
      if (next.pB >= 4 && next.pA <= 2) return winGame(prev, "B");

      // Entering deuce zone
      if (next.pA >= 3 && next.pB >= 3) {
        // Star point with deuceCount >= 2 means deciding point immediately
        if (mode === "star" && next.deuceCount >= 2) return winGame({ ...next }, team);
        if (mode === "golden") return winGame({ ...next }, team);
      }

      return next;
    });
  }

  function resetMatch() {
    setHistory([]);
    setState(INITIAL_STATE);
  }

  // ─── Derived UI values ────────────────────────────────────────────────────

  const headerTitle = useMemo(() => {
    if (!payload) return "Match";
    if (state.matchOver && state.winner) {
      const winnerName = state.winner === "A" ? "Team A" : "Team B";
      return `${winnerName} wins!`;
    }
    if (state.isTiebreak) {
      return state.tiebreakTarget === 10 ? "Super Tiebreak" : "Tiebreak";
    }
    return `Set ${state.setIndex + 1}`;
  }, [payload, state]);

  const deuceLabel = useMemo(() => {
    if (!payload) return "";
    const mode = payload.rules.deuceMode;
    if (mode === "golden") return "Golden point";
    if (mode === "star") return "Star point (FIP 2026)";
    return "Traditional advantage";
  }, [payload]);

  const servingTeamForHighlight: Team = state.isTiebreak ? state.tbServingTeam : state.servingTeam;

  // ─── Styles ───────────────────────────────────────────────────────────────

  const teamCardStyle = (serving: boolean): React.CSSProperties => ({
    borderRadius: 18,
    padding: 14,
    background: serving ? "rgba(255,107,0,0.10)" : "rgba(255,255,255,0.04)",
    border: serving ? `1px solid rgba(255,107,0,0.45)` : "1px solid rgba(255,255,255,0.08)",
    transition: "background 0.15s",
  });

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "11px 14px",
    borderRadius: 999,
    border: active ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,107,0,0.14)" : "rgba(255,255,255,0.06)",
    color: WHITE,
    fontWeight: 1000,
    cursor: "pointer",
    userSelect: "none",
    fontSize: 13,
    whiteSpace: "nowrap",
  });

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 14, display: "flex", justifyContent: "center" },
    shell: { width: "100%", maxWidth: 760, display: "grid", gap: 12, alignContent: "start" },
    topBar: { background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
    headerTitle: { fontWeight: 1000, fontSize: 22, letterSpacing: 0.2 },
    headerMeta: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4, fontWeight: 800 },
    serveLine: { fontSize: 13, marginTop: 6, fontWeight: 1000, color: ORANGE },
    chipRow: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
    board: { background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 14 },
    boardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    teamName: { fontWeight: 1000, fontSize: 17, marginBottom: 5 },
    players: { fontSize: 13, color: WARM_WHITE, opacity: 0.75, lineHeight: 1.4, fontWeight: 800 },
    scoreRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12, alignItems: "end" },
    scoreBox: { borderRadius: 14, padding: "10px 8px", background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" },
    scoreLabel: { fontSize: 11, opacity: 0.5, fontWeight: 950, textTransform: "uppercase", letterSpacing: 0.5 },
    scoreBig: { fontSize: 42, fontWeight: 1150, letterSpacing: 0.4, lineHeight: 1.05, color: WHITE },
    scoreMid: { fontSize: 24, fontWeight: 1000, lineHeight: 1.1, marginTop: 2, color: WHITE },
    controls: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    btnA: { borderRadius: 18, border: "none", padding: "20px 14px", fontSize: 20, fontWeight: 1100, cursor: "pointer", background: ORANGE, color: WHITE },
    btnB: { borderRadius: 18, padding: "20px 14px", fontSize: 20, fontWeight: 1100, cursor: "pointer", background: "rgba(255,255,255,0.08)", color: WHITE, border: "1px solid rgba(255,255,255,0.16)" },
    actionRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
    smallBtn: { borderRadius: 14, padding: "14px 10px", fontSize: 14, fontWeight: 1000, cursor: "pointer", background: "rgba(255,255,255,0.06)", color: WHITE, border: "1px solid rgba(255,255,255,0.12)" },
    winnerBanner: { borderRadius: 18, padding: 20, background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.35)", textAlign: "center", display: "grid", gap: 8 },
    winnerTitle: { fontSize: 26, fontWeight: 1100, color: ORANGE },
    winnerSub: { fontSize: 14, color: WARM_WHITE, opacity: 0.7 },
    footer: { fontSize: 12, color: WARM_WHITE, opacity: 0.45, textAlign: "center", paddingBottom: 12, lineHeight: 1.5 },
    starPointBanner: { borderRadius: 14, padding: "10px 14px", background: "rgba(255,107,0,0.10)", border: "1px solid rgba(255,107,0,0.30)", fontSize: 13, fontWeight: 1000, color: ORANGE, textAlign: "center" },
  };

  if (!loaded) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.shell, paddingTop: 40 }}>
          <div style={{ opacity: 0.7, fontWeight: 900 }}>Loading match…</div>
        </div>
      </div>
    );
  }

  if (!payload) return null;

  // Is Star Point active right now? (deuceCount >= 2 and at deuce in star mode)
  const isStarPointMoment =
    !state.isTiebreak &&
    payload.rules.deuceMode === "star" &&
    state.pA >= 3 && state.pB >= 3 &&
    state.adTeam === null &&
    state.deuceCount >= 2;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>

        {/* ── Top bar ── */}
        <div style={styles.topBar}>
          <div>
            <div style={styles.headerTitle}>{headerTitle}</div>
            <div style={styles.headerMeta}>
              Sets {state.setsA} – {state.setsB} · Games {state.gamesA} – {state.gamesB}
              {inSuperFinalSet && !state.matchOver ? " · Super tiebreak" : ""}
            </div>
            {showServeHelper && !state.matchOver && (
              <div style={styles.serveLine}>Serving: {currentServerInfo.name}</div>
            )}
          </div>
          <div style={styles.chipRow}>
            <div style={chipStyle(showServeHelper)} onClick={() => setShowServeHelper((v) => !v)}>Serve helper</div>
            <div style={chipStyle(false)} onClick={randomFirstServer}>Random server</div>
            <div style={chipStyle(false)} onClick={() => router.push("/")}>Home</div>
          </div>
        </div>

        {/* ── Star point banner ── */}
        {isStarPointMoment && (
          <div style={styles.starPointBanner}>
            ★ Star Point — next point wins the game
          </div>
        )}

        {/* ── Score board ── */}
        <div style={styles.board}>
          <div style={styles.boardGrid}>
            {(["A", "B"] as Team[]).map((team) => {
              const players = team === "A" ? teamAPlayers : teamBPlayers;
              const serving = showServeHelper && servingTeamForHighlight === team;
              const setsVal = team === "A" ? state.setsA : state.setsB;
              const gamesVal = team === "A" ? state.gamesA : state.gamesB;
              const scoreVal = team === "A" ? scoreDisplay.a : scoreDisplay.b;

              return (
                <div key={team} style={teamCardStyle(serving)}>
                  <div style={styles.teamName}>Team {team}</div>
                  <div style={styles.players}>
                    {players[0]}
                    {showServeHelper && currentServerInfo.team === team && currentServerInfo.playerIndex === 0 ? " ●" : ""}
                    <br />
                    {players[1]}
                    {showServeHelper && currentServerInfo.team === team && currentServerInfo.playerIndex === 1 ? " ●" : ""}
                  </div>
                  <div style={styles.scoreRow}>
                    <div style={styles.scoreBox}>
                      <div style={styles.scoreLabel}>Sets</div>
                      <div style={styles.scoreMid}>{setsVal}</div>
                    </div>
                    <div style={styles.scoreBox}>
                      <div style={styles.scoreLabel}>{state.isTiebreak ? "TB" : "Points"}</div>
                      <div style={styles.scoreBig}>{scoreVal}</div>
                    </div>
                    <div style={styles.scoreBox}>
                      <div style={styles.scoreLabel}>Games</div>
                      <div style={styles.scoreMid}>{gamesVal}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Winner banner ── */}
        {state.matchOver && state.winner && (
          <div style={styles.winnerBanner}>
            <div style={styles.winnerTitle}>
              {state.winner === "A" ? teamAPlayers.join(" & ") : teamBPlayers.join(" & ")} win!
            </div>
            <div style={styles.winnerSub}>
              {state.setsA} – {state.setsB} sets
            </div>
          </div>
        )}

        {/* ── Point buttons ── */}
        {!state.matchOver && (
          <div style={styles.controls}>
            <button style={styles.btnA} onClick={() => addPoint("A")}>Point A</button>
            <button style={styles.btnB} onClick={() => addPoint("B")}>Point B</button>
          </div>
        )}

        {/* ── Action row ── */}
        <div style={styles.actionRow}>
          <button style={{ ...styles.smallBtn, opacity: history.length === 0 ? 0.4 : 1 }} onClick={undo} disabled={history.length === 0}>Undo</button>
          <button style={styles.smallBtn} onClick={resetMatch}>Reset</button>
          <button style={styles.smallBtn} onClick={() => { localStorage.removeItem(STORAGE_MATCH_KEY); router.push("/match/setup"); }}>New match</button>
        </div>

        {/* ── Footer ── */}
        <div style={styles.footer}>
          First to {targetSetsToWin} set{targetSetsToWin > 1 ? "s" : ""} wins · {deuceLabel}
          {payload.rules.tiebreak ? " · Tiebreak at 6-6" : ""}
          {payload.rules.superTiebreak && payload.sets > 1 ? " · Super tiebreak final set" : ""}
        </div>

      </div>
    </div>
  );
}