"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

type MatchRules = {
  goldenPoint: boolean;
  superTiebreakFinalSet: boolean;
};

type MatchPayload = {
  players: string[];
  mode: "standard";
  sets: number;
  rules: MatchRules;
};

const STORAGE_MATCH_KEY = "eps_match_payload";
const STORAGE_UI_OUTDOOR_KEY = "eps_ui_outdoor_mode";

type Team = "A" | "B";

type Snapshot = {
  gamesA: number;
  gamesB: number;
  setsA: number;
  setsB: number;
  setIndex: number;

  // Points (normal game)
  pA: number;
  pB: number;
  adTeam: Team | null;

  // Tiebreak
  isTiebreak: boolean;
  tiebreakTarget: number;
  tbA: number;
  tbB: number;
  tbPointNumber: number; // number of points already played in tiebreak
  tbServingTeam: Team; // who serves the NEXT point in the tiebreak
  tbPointsLeftInTurn: number; // 1 for first turn, then 2 for subsequent turns

  // Serve rotation (doubles)
  servingTeam: Team; // who is serving the CURRENT game (or next point if tiebreak uses tbServingTeam)
  nextServerA: 0 | 1; // which Team A player serves next time Team A serves
  nextServerB: 0 | 1; // which Team B player serves next time Team B serves

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

function shouldUseSuperTiebreakFinalSet(payload: MatchPayload, setIndex: number) {
  return payload.rules.superTiebreakFinalSet && isFinalSet(setIndex, payload.sets);
}

function tiebreakWinner(tbA: number, tbB: number, target: number): Team | null {
  if (tbA >= target || tbB >= target) {
    if (Math.abs(tbA - tbB) >= 2) return tbA > tbB ? "A" : "B";
  }
  return null;
}

function normalSetWinner(gA: number, gB: number): Team | null {
  if (gA >= 6 || gB >= 6) {
    if (Math.abs(gA - gB) >= 2) return gA > gB ? "A" : "B";
  }
  return null;
}

function toggle01(v: 0 | 1): 0 | 1 {
  return v === 0 ? 1 : 0;
}

function stylesFor(outdoor: boolean): Record<string, React.CSSProperties> {
  const pad = outdoor ? 14 : 12;

  return {
    page: {
      minHeight: "100vh",
      background: NAVY,
      color: WHITE,
      padding: pad,
      display: "flex",
      justifyContent: "center",
    },
    shell: {
      width: "100%",
      maxWidth: 760,
      display: "grid",
      gap: outdoor ? 14 : 12,
    },
    topBar: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: 18,
      padding: outdoor ? 14 : 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    title: { fontWeight: 950, fontSize: outdoor ? 20 : 18, letterSpacing: 0.2 },
    mini: { fontSize: outdoor ? 13 : 12, opacity: 0.9, marginTop: 3, fontWeight: 800 },
    serveLine: { fontSize: outdoor ? 13 : 12, opacity: 0.95, marginTop: 6, fontWeight: 950, color: TEAL },

    board: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: 20,
      padding: outdoor ? 14 : 12,
    },
    boardGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: outdoor ? 12 : 10,
    },
    teamName: { fontWeight: 1000, fontSize: outdoor ? 18 : 16, marginBottom: 6, letterSpacing: 0.2 },
    players: { opacity: 0.9, fontSize: outdoor ? 13 : 12, lineHeight: 1.35, fontWeight: outdoor ? 800 : 700 },

    scoreRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: outdoor ? 10 : 8,
      marginTop: outdoor ? 12 : 10,
      alignItems: "end",
    },
    scoreBox: {
      borderRadius: 16,
      padding: outdoor ? 12 : 10,
      background: "rgba(0,0,0,0.26)",
      border: outdoor ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.12)",
      textAlign: "center",
    },
    label: { fontSize: outdoor ? 12 : 11, opacity: 0.9, fontWeight: 950 },
    big: { fontSize: outdoor ? 44 : 34, fontWeight: 1100, letterSpacing: 0.6, marginTop: 4, lineHeight: 1.05 },
    mid: { fontSize: outdoor ? 26 : 20, fontWeight: 1000, marginTop: 4, lineHeight: 1.1 },

    controls: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: outdoor ? 12 : 10,
    },
    btn: {
      borderRadius: 18,
      border: "none",
      padding: outdoor ? "18px 14px" : "16px 14px",
      fontSize: outdoor ? 20 : 18,
      fontWeight: 1100,
      cursor: "pointer",
    },
    btnA: { background: TEAL, color: NAVY },
    btnB: {
      background: "rgba(255,255,255,0.10)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.18)",
    },

    actionRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: outdoor ? 12 : 10 },
    smallBtn: {
      borderRadius: 16,
      padding: outdoor ? "14px 10px" : "12px 10px",
      fontSize: outdoor ? 15 : 14,
      fontWeight: 1000,
      cursor: "pointer",
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.14)",
    },

    footer: { opacity: 0.9, fontSize: outdoor ? 13 : 12, textAlign: "center", paddingBottom: 10, fontWeight: 800 },
  };
}

export default function MatchPage() {
  const router = useRouter();

  const [payload, setPayload] = useState<MatchPayload | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  const [history, setHistory] = useState<Snapshot[]>([]);
  const [showServeHelper, setShowServeHelper] = useState<boolean>(true);
  const [outdoorMode, setOutdoorMode] = useState<boolean>(false);

  const [state, setState] = useState<Snapshot>({
    gamesA: 0,
    gamesB: 0,
    setsA: 0,
    setsB: 0,
    setIndex: 0,

    pA: 0,
    pB: 0,
    adTeam: null,

    isTiebreak: false,
    tiebreakTarget: 7,
    tbA: 0,
    tbB: 0,
    tbPointNumber: 0,
    tbServingTeam: "A",
    tbPointsLeftInTurn: 1,

    servingTeam: "A",
    nextServerA: 0,
    nextServerB: 0,

    matchOver: false,
    winner: null,
  });

  useEffect(() => {
    const p = safeParseJSON<MatchPayload | null>(localStorage.getItem(STORAGE_MATCH_KEY), null);
    setPayload(p);

    const ui = safeParseJSON<{ outdoor: boolean } | null>(localStorage.getItem(STORAGE_UI_OUTDOOR_KEY), null);
    setOutdoorMode(Boolean(ui?.outdoor));

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !payload) router.push("/match/setup");
  }, [loaded, payload, router]);

  useEffect(() => {
    localStorage.setItem(STORAGE_UI_OUTDOOR_KEY, JSON.stringify({ outdoor: outdoorMode }));
  }, [outdoorMode]);

  function pushHistory(prev: Snapshot) {
    setHistory((h) => [...h, prev]);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setState(prev);
      return h.slice(0, -1);
    });
  }

  function toggleServeHelper() {
    setShowServeHelper((v) => !v);
  }

  function toggleOutdoorMode() {
    setOutdoorMode((v) => !v);
  }

  function randomFirstServer() {
    // Randomise:
    // - which team serves first
    // - which player in each team is "next server"
    // This avoids weird patterns when people reshuffle.
    setState((prev) => {
      pushHistory(prev);
      const firstTeam: Team = Math.random() < 0.5 ? "A" : "B";
      const a: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
      const b: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
      return {
        ...prev,
        servingTeam: firstTeam,
        nextServerA: a,
        nextServerB: b,
        // If currently in tiebreak, align the next point server too
        tbServingTeam: prev.isTiebreak ? firstTeam : prev.tbServingTeam,
        tbPointsLeftInTurn: prev.isTiebreak ? 1 : prev.tbPointsLeftInTurn,
      };
    });
  }

  const teamAPlayers = useMemo(() => {
    if (!payload) return ["A1", "A2"];
    return [payload.players[0] ?? "A1", payload.players[1] ?? "A2"];
  }, [payload]);

  const teamBPlayers = useMemo(() => {
    if (!payload) return ["B1", "B2"];
    return [payload.players[2] ?? "B1", payload.players[3] ?? "B2"];
  }, [payload]);

  const targetSetsToWin = useMemo(() => (payload ? setsToWin(payload.sets) : 1), [payload]);

  const inSuperFinalSet = useMemo(() => {
    if (!payload) return false;
    return shouldUseSuperTiebreakFinalSet(payload, state.setIndex);
  }, [payload, state.setIndex]);

  // Who is serving right now (player name), based on state and whether we are in tiebreak
  const currentServerInfo = useMemo(() => {
    const servingTeam: Team = state.isTiebreak ? state.tbServingTeam : state.servingTeam;

    if (servingTeam === "A") {
      const idx = state.nextServerA;
      return { team: "A" as Team, playerIndex: idx, name: teamAPlayers[idx] };
    } else {
      const idx = state.nextServerB;
      return { team: "B" as Team, playerIndex: idx, name: teamBPlayers[idx] };
    }
  }, [state.isTiebreak, state.servingTeam, state.tbServingTeam, state.nextServerA, state.nextServerB, teamAPlayers, teamBPlayers]);

  const scoreDisplay = useMemo(() => {
    if (state.isTiebreak) return { a: String(state.tbA), b: String(state.tbB) };

    const map = ["0", "15", "30", "40"];
    const baseA = map[clamp(state.pA, 0, 3)];
    const baseB = map[clamp(state.pB, 0, 3)];

    if (state.pA >= 3 && state.pB >= 3) {
      if (payload?.rules.goldenPoint) return { a: "40", b: "40" };
      if (state.adTeam === "A") return { a: "AD", b: "40" };
      if (state.adTeam === "B") return { a: "40", b: "AD" };
      return { a: "40", b: "40" };
    }

    return { a: baseA, b: baseB };
  }, [payload, state.isTiebreak, state.tbA, state.tbB, state.pA, state.pB, state.adTeam]);

  function checkMatchWinner(next: Snapshot): Snapshot {
    if (!payload) return next;
    const needed = setsToWin(payload.sets);
    if (next.setsA >= needed) return { ...next, matchOver: true, winner: "A" };
    if (next.setsB >= needed) return { ...next, matchOver: true, winner: "B" };
    return next;
  }

  function startTiebreak(prev: Snapshot, target: number): Snapshot {
    // Tiebreak starts with whoever would serve next in normal rotation (prev.servingTeam).
    // First turn is 1 point, then it becomes 2 points per turn.
    return {
      ...prev,
      isTiebreak: true,
      tiebreakTarget: target,
      tbA: 0,
      tbB: 0,
      tbPointNumber: 0,
      tbServingTeam: prev.servingTeam,
      tbPointsLeftInTurn: 1,

      // reset normal points
      pA: 0,
      pB: 0,
      adTeam: null,
    };
  }

  function rotateServeAfterGame(prev: Snapshot): Snapshot {
    // When a service game ends:
    // - Toggle the server within the team that just served
    // - Flip serving team to the other team for the next game
    if (prev.servingTeam === "A") {
      return {
        ...prev,
        nextServerA: toggle01(prev.nextServerA),
        servingTeam: "B",
      };
    }
    return {
      ...prev,
      nextServerB: toggle01(prev.nextServerB),
      servingTeam: "A",
    };
  }

  function rotateServeAfterTiebreakPoint(prev: Snapshot): Snapshot {
    // After each tiebreak point:
    // - Decrease points left in current serve turn
    // - When a turn ends, flip serving team, set next turn to 2 points,
    //   and toggle that team's next server (because a new server turn starts).
    let next: Snapshot = { ...prev };

    const remaining = next.tbPointsLeftInTurn - 1;

    if (remaining > 0) {
      next.tbPointsLeftInTurn = remaining;
      return next;
    }

    // Turn ends, flip team
    const newTeam: Team = next.tbServingTeam === "A" ? "B" : "A";
    next.tbServingTeam = newTeam;
    next.tbPointsLeftInTurn = 2;

    // New turn begins for newTeam, toggle that team's next server
    if (newTeam === "A") next.nextServerA = toggle01(next.nextServerA);
    else next.nextServerB = toggle01(next.nextServerB);

    return next;
  }

  function winGame(prev: Snapshot, winnerTeam: Team): Snapshot {
    let next: Snapshot = { ...prev };

    // increment games
    if (winnerTeam === "A") next.gamesA += 1;
    else next.gamesB += 1;

    // reset points for next game
    next.pA = 0;
    next.pB = 0;
    next.adTeam = null;

    // rotate serve for next game
    next = rotateServeAfterGame(next);

    // check set win
    const setWin = normalSetWinner(next.gamesA, next.gamesB);
    if (setWin) {
      if (setWin === "A") next.setsA += 1;
      else next.setsB += 1;

      // reset games for next set
      next.gamesA = 0;
      next.gamesB = 0;

      // clear any tiebreak flags
      next.isTiebreak = false;
      next.tiebreakTarget = 7;
      next.tbA = 0;
      next.tbB = 0;
      next.tbPointNumber = 0;
      next.tbServingTeam = next.servingTeam;
      next.tbPointsLeftInTurn = 1;

      next.setIndex += 1;
      next = checkMatchWinner(next);

      // If final set should be super tiebreak, start it immediately
      if (!next.matchOver && payload && shouldUseSuperTiebreakFinalSet(payload, next.setIndex)) {
        next = startTiebreak(next, 10);
      }

      return next;
    }

    // Trigger normal tiebreak at 6 6 only if this set is not the super final set
    if (payload && !shouldUseSuperTiebreakFinalSet(payload, prev.setIndex) && next.gamesA === 6 && next.gamesB === 6) {
      next = startTiebreak(next, 7);
    }

    return next;
  }

  function winTiebreakAsSet(prev: Snapshot, winnerTeam: Team): Snapshot {
    let next: Snapshot = { ...prev };

    // award set
    if (winnerTeam === "A") next.setsA += 1;
    else next.setsB += 1;

    // reset tiebreak state
    next.isTiebreak = false;
    next.tiebreakTarget = 7;
    next.tbA = 0;
    next.tbB = 0;
    next.tbPointNumber = 0;
    next.tbPointsLeftInTurn = 1;

    // reset games (super tiebreak set is represented only by tb points)
    next.gamesA = 0;
    next.gamesB = 0;

    // reset normal points
    next.pA = 0;
    next.pB = 0;
    next.adTeam = null;

    // advance set
    next.setIndex += 1;
    next = checkMatchWinner(next);

    // If next set is super final set, start it
    if (!next.matchOver && payload && shouldUseSuperTiebreakFinalSet(payload, next.setIndex)) {
      next = startTiebreak(next, 10);
    }

    return next;
  }

  function addPoint(team: Team) {
    if (!payload) return;

    setState((prev) => {
      if (prev.matchOver) return prev;

      pushHistory(prev);

      // Tiebreak scoring
      if (prev.isTiebreak) {
        let next: Snapshot = { ...prev };

        if (team === "A") next.tbA += 1;
        else next.tbB += 1;

        next.tbPointNumber = prev.tbPointNumber + 1;

        // rotate serve after the point (this affects NEXT point)
        next = rotateServeAfterTiebreakPoint(next);

        const tbWin = tiebreakWinner(next.tbA, next.tbB, next.tiebreakTarget);
        if (tbWin) {
          next = winTiebreakAsSet(next, tbWin);
        }

        return next;
      }

      // Normal game scoring
      const golden = payload.rules.goldenPoint;

      // Deuce zone (40 40 or beyond)
      if (prev.pA >= 3 && prev.pB >= 3) {
        if (golden) {
          // Next point wins game
          return winGame(prev, team);
        }

        // Advantage mode
        if (prev.adTeam === null) return { ...prev, adTeam: team };
        if (prev.adTeam === team) return winGame(prev, team);
        return { ...prev, adTeam: null };
      }

      let next: Snapshot = { ...prev };
      if (team === "A") next.pA += 1;
      else next.pB += 1;

      // win conditions
      const lead = next.pA - next.pB;
      if (next.pA >= 4 || next.pB >= 4) {
        if (Math.abs(lead) >= 2) return winGame(prev, lead > 0 ? "A" : "B");
      }

      if (next.pA >= 4 && next.pB <= 2) return winGame(prev, "A");
      if (next.pB >= 4 && next.pA <= 2) return winGame(prev, "B");

      return next;
    });
  }

  function resetMatch() {
    setHistory([]);
    setState((prev) => ({
      ...prev,
      gamesA: 0,
      gamesB: 0,
      setsA: 0,
      setsB: 0,
      setIndex: 0,

      pA: 0,
      pB: 0,
      adTeam: null,

      isTiebreak: false,
      tiebreakTarget: 7,
      tbA: 0,
      tbB: 0,
      tbPointNumber: 0,
      tbServingTeam: prev.servingTeam,
      tbPointsLeftInTurn: 1,

      matchOver: false,
      winner: null,
    }));
  }

  function newMatch() {
    router.push("/match/setup");
  }

  const headerTitle = useMemo(() => {
    if (!payload) return "Match";
    if (state.matchOver && state.winner) return state.winner === "A" ? "Team A wins" : "Team B wins";
    if (state.isTiebreak) {
      const label = state.tiebreakTarget === 10 ? "Super tiebreak" : "Tiebreak";
      return `${label} set ${state.setIndex + 1}`;
    }
    return `Set ${state.setIndex + 1}`;
  }, [payload, state.isTiebreak, state.matchOver, state.setIndex, state.tiebreakTarget, state.winner]);

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: outdoorMode ? "12px 14px" : "10px 12px",
    borderRadius: 999,
    border: active ? `1px solid ${TEAL}` : "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(0,168,168,0.18)" : "rgba(255,255,255,0.08)",
    color: WHITE,
    fontWeight: 1000,
    cursor: "pointer",
    userSelect: "none",
    fontSize: outdoorMode ? 14 : 13,
    whiteSpace: "nowrap",
  });

  const teamCardStyle = (serving: boolean): React.CSSProperties => ({
    borderRadius: 18,
    padding: outdoorMode ? 14 : 12,
    background: serving ? "rgba(0,168,168,0.18)" : "rgba(255,255,255,0.06)",
    border: serving ? `1px solid ${TEAL}` : "1px solid rgba(255,255,255,0.14)",
  });

  const styles = useMemo(() => stylesFor(outdoorMode), [outdoorMode]);

  if (!loaded) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.shell, alignItems: "center", paddingTop: 40 }}>
          <div style={{ opacity: 0.9, fontWeight: 950 }}>Loading match…</div>
        </div>
      </div>
    );
  }

  if (!payload) return null;

  const servingTeamForHighlight: Team = state.isTiebreak ? state.tbServingTeam : state.servingTeam;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topBar}>
          <div>
            <div style={styles.title}>
              {headerTitle}
              {outdoorMode ? " , Outdoor" : ""}
            </div>
            <div style={styles.mini}>
              Sets {state.setsA} {state.setsB} , Games {state.gamesA} {state.gamesB}
              {inSuperFinalSet && !state.matchOver ? " , Super tiebreak final set" : ""}
            </div>
            {showServeHelper ? <div style={styles.serveLine}>Serving: {currentServerInfo.name}</div> : null}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={chipStyle(outdoorMode)} onClick={toggleOutdoorMode}>
              Outdoor mode
            </div>
            <div style={chipStyle(showServeHelper)} onClick={toggleServeHelper}>
              Serve helper
            </div>
            <div style={chipStyle(false)} onClick={randomFirstServer}>
              Random server
            </div>
          </div>
        </div>

        <div style={styles.board}>
          <div style={styles.boardGrid}>
            <div style={teamCardStyle(showServeHelper && servingTeamForHighlight === "A")}>
              <div style={styles.teamName}>Team A</div>
              <div style={styles.players}>
                {teamAPlayers[0]}
                {showServeHelper && currentServerInfo.team === "A" && currentServerInfo.playerIndex === 0 ? "  • SERVE" : ""}
                <br />
                {teamAPlayers[1]}
                {showServeHelper && currentServerInfo.team === "A" && currentServerInfo.playerIndex === 1 ? "  • SERVE" : ""}
              </div>

              <div style={styles.scoreRow}>
                <div style={styles.scoreBox}>
                  <div style={styles.label}>Sets</div>
                  <div style={styles.mid}>{state.setsA}</div>
                </div>
                <div style={styles.scoreBox}>
                  <div style={styles.label}>{state.isTiebreak ? "TB" : "Points"}</div>
                  <div style={styles.big}>{scoreDisplay.a}</div>
                </div>
                <div style={styles.scoreBox}>
                  <div style={styles.label}>Games</div>
                  <div style={styles.mid}>{state.gamesA}</div>
                </div>
              </div>
            </div>

            <div style={teamCardStyle(showServeHelper && servingTeamForHighlight === "B")}>
              <div style={styles.teamName}>Team B</div>
              <div style={styles.players}>
                {teamBPlayers[0]}
                {showServeHelper && currentServerInfo.team === "B" && currentServerInfo.playerIndex === 0 ? "  • SERVE" : ""}
                <br />
                {teamBPlayers[1]}
                {showServeHelper && currentServerInfo.team === "B" && currentServerInfo.playerIndex === 1 ? "  • SERVE" : ""}
              </div>

              <div style={styles.scoreRow}>
                <div style={styles.scoreBox}>
                  <div style={styles.label}>Sets</div>
                  <div style={styles.mid}>{state.setsB}</div>
                </div>
                <div style={styles.scoreBox}>
                  <div style={styles.label}>{state.isTiebreak ? "TB" : "Points"}</div>
                  <div style={styles.big}>{scoreDisplay.b}</div>
                </div>
                <div style={styles.scoreBox}>
                  <div style={styles.label}>Games</div>
                  <div style={styles.mid}>{state.gamesB}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.controls}>
          <button style={{ ...styles.btn, ...styles.btnA }} onClick={() => addPoint("A")}>
            Point Team A
          </button>
          <button style={{ ...styles.btn, ...styles.btnB }} onClick={() => addPoint("B")}>
            Point Team B
          </button>
        </div>

        <div style={styles.actionRow}>
          <button style={styles.smallBtn} onClick={undo} disabled={history.length === 0}>
            Undo
          </button>
          <button style={styles.smallBtn} onClick={resetMatch}>
            Reset
          </button>
          <button style={styles.smallBtn} onClick={newMatch}>
            New match
          </button>
        </div>

        <div style={styles.footer}>
          First to {targetSetsToWin} sets wins. {payload.rules.goldenPoint ? "Golden point enabled." : "Advantage enabled."}{" "}
          {payload.rules.superTiebreakFinalSet ? "Final set may be a super tiebreak." : ""}
        </div>
      </div>
    </div>
  );
}