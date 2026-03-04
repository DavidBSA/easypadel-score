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

type Team = "A" | "B";

type Snapshot = {
  gamesA: number;
  gamesB: number;
  setsA: number;
  setsB: number;
  setIndex: number;
  isTiebreak: boolean;
  tiebreakTarget: number;
  tbA: number;
  tbB: number;
  pA: number;
  pB: number;
  adTeam: Team | null;
  serverIndex: number;
  tbPointNumber: number;
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

function determineTiebreakServeTeam(startingServerIndex: number, tbPointNumber: number): Team {
  // Tiebreak pattern:
  // Point 1: starting server
  // Points 2 and 3: other team
  // Points 4 and 5: starting team
  // then pairs repeat
  if (tbPointNumber <= 0) return startingServerIndex % 2 === 0 ? "A" : "B";
  if (tbPointNumber === 1) return startingServerIndex % 2 === 0 ? "A" : "B";

  const block = tbPointNumber - 2; // starts at 0 for point 2
  const pairIndex = Math.floor(block / 2); // 0,0,1,1,2,2...
  const flips = 1 + pairIndex; // after point 1, flips every 2 points
  const serverIdx = startingServerIndex + flips;
  return serverIdx % 2 === 0 ? "A" : "B";
}

export default function MatchPage() {
  const router = useRouter();
  const payload = useMemo(() => {
    const p = safeParseJSON<MatchPayload | null>(localStorage.getItem(STORAGE_MATCH_KEY), null);
    return p;
  }, []);

  const [history, setHistory] = useState<Snapshot[]>([]);

  const [state, setState] = useState<Snapshot>({
    gamesA: 0,
    gamesB: 0,
    setsA: 0,
    setsB: 0,
    setIndex: 0,
    isTiebreak: false,
    tiebreakTarget: 7,
    tbA: 0,
    tbB: 0,
    pA: 0,
    pB: 0,
    adTeam: null,
    serverIndex: 0, // 0 -> Team A, 1 -> Team B
    tbPointNumber: 0, // counts points within current tiebreak starting at 1
    matchOver: false,
    winner: null,
  });

  useEffect(() => {
    if (!payload) router.push("/match/setup");
  }, [payload, router]);

  function pushHistory(prev: Snapshot) {
    setHistory((h) => [...h, prev]);
  }

  function resetAll() {
    setHistory([]);
    setState((s) => ({
      ...s,
      gamesA: 0,
      gamesB: 0,
      setsA: 0,
      setsB: 0,
      setIndex: 0,
      isTiebreak: false,
      tiebreakTarget: 7,
      tbA: 0,
      tbB: 0,
      pA: 0,
      pB: 0,
      adTeam: null,
      serverIndex: 0,
      tbPointNumber: 0,
      matchOver: false,
      winner: null,
    }));
  }

  function newMatch() {
    router.push("/match/setup");
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setState(prev);
      return h.slice(0, -1);
    });
  }

  function randomFirstServer() {
    setState((prev) => {
      pushHistory(prev);
      return { ...prev, serverIndex: Math.random() < 0.5 ? 0 : 1 };
    });
  }

  function toggleServeHelper() {
    setShowServeHelper((v) => !v);
  }

  const [showServeHelper, setShowServeHelper] = useState<boolean>(true);

  const teamAPlayers = useMemo(() => {
    if (!payload) return ["Team A", ""];
    return [payload.players[0] ?? "A1", payload.players[1] ?? "A2"];
  }, [payload]);

  const teamBPlayers = useMemo(() => {
    if (!payload) return ["Team B", ""];
    return [payload.players[2] ?? "B1", payload.players[3] ?? "B2"];
  }, [payload]);

  const targetSetsToWin = useMemo(() => (payload ? setsToWin(payload.sets) : 1), [payload]);

  const inSuperFinalSet = useMemo(() => {
    if (!payload) return false;
    return shouldUseSuperTiebreakFinalSet(payload, state.setIndex);
  }, [payload, state.setIndex]);

  const scoreDisplay = useMemo(() => {
    // If tiebreak, show numeric
    if (state.isTiebreak) return { a: String(state.tbA), b: String(state.tbB) };

    // Normal point display
    const map = ["0", "15", "30", "40"];
    const baseA = map[clamp(state.pA, 0, 3)];
    const baseB = map[clamp(state.pB, 0, 3)];

    // Deuce and advantage logic
    if (state.pA >= 3 && state.pB >= 3) {
      if (payload?.rules.goldenPoint) {
        return { a: "40", b: "40" };
      }
      if (state.adTeam === "A") return { a: "AD", b: "40" };
      if (state.adTeam === "B") return { a: "40", b: "AD" };
      return { a: "40", b: "40" };
    }

    return { a: baseA, b: baseB };
  }, [payload, state.adTeam, state.isTiebreak, state.pA, state.pB, state.tbA, state.tbB]);

  const currentServerTeam: Team = useMemo(() => {
    if (!state.isTiebreak) return state.serverIndex % 2 === 0 ? "A" : "B";

    // During tiebreak use the special serve pattern.
    // startingServerIndex is the serverIndex at the moment tiebreak started.
    // We keep using state.serverIndex as that starting index, and tbPointNumber as point count.
    return determineTiebreakServeTeam(state.serverIndex, state.tbPointNumber);
  }, [state.isTiebreak, state.serverIndex, state.tbPointNumber]);

  function checkMatchWinner(next: Snapshot): Snapshot {
    if (!payload) return next;
    const needed = setsToWin(payload.sets);
    if (next.setsA >= needed) return { ...next, matchOver: true, winner: "A" };
    if (next.setsB >= needed) return { ...next, matchOver: true, winner: "B" };
    return next;
  }

  function startTiebreak(prev: Snapshot, target: number): Snapshot {
    // Keep serverIndex as the starting server index for the tiebreak pattern.
    return {
      ...prev,
      isTiebreak: true,
      tiebreakTarget: target,
      tbA: 0,
      tbB: 0,
      tbPointNumber: 0,
      pA: 0,
      pB: 0,
      adTeam: null,
    };
  }

  function winGame(prev: Snapshot, winner: Team): Snapshot {
    let next: Snapshot = { ...prev };

    // increment games
    if (winner === "A") next.gamesA += 1;
    else next.gamesB += 1;

    // reset points
    next.pA = 0;
    next.pB = 0;
    next.adTeam = null;

    // rotate server for next game (normal games only)
    next.serverIndex += 1;

    // If we are in a normal set, check set win or tiebreak trigger
    const setWin = normalSetWinner(next.gamesA, next.gamesB);
    if (setWin) {
      if (setWin === "A") next.setsA += 1;
      else next.setsB += 1;

      next.gamesA = 0;
      next.gamesB = 0;
      next.isTiebreak = false;
      next.tbA = 0;
      next.tbB = 0;
      next.tbPointNumber = 0;

      // advance set index
      next.setIndex += 1;

      // If match ends, do not go into a new set
      next = checkMatchWinner(next);

      // If next set is super tiebreak final set, start it immediately
      if (!next.matchOver && payload && shouldUseSuperTiebreakFinalSet(payload, next.setIndex)) {
        // For super tiebreak, we do not play games at all, just a 10 point tiebreak as the set
        next.gamesA = 0;
        next.gamesB = 0;
        next = startTiebreak(next, 10);
      }

      return next;
    }

    // Trigger normal tiebreak at 6 6 (only when not super final set)
    if (payload && !inSuperFinalSet && next.gamesA === 6 && next.gamesB === 6) {
      next = startTiebreak(next, 7);
    }

    return next;
  }

  function winTiebreakAsSet(prev: Snapshot, winner: Team): Snapshot {
    let next: Snapshot = { ...prev };

    // award the set
    if (winner === "A") next.setsA += 1;
    else next.setsB += 1;

    // reset set state
    next.gamesA = 0;
    next.gamesB = 0;
    next.isTiebreak = false;
    next.tbA = 0;
    next.tbB = 0;
    next.tbPointNumber = 0;
    next.pA = 0;
    next.pB = 0;
    next.adTeam = null;

    // move to next set
    next.setIndex += 1;

    // match winner check
    next = checkMatchWinner(next);

    // if next set exists and is super final set, start it
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

      // Super tiebreak final set is handled as a tiebreak with target 10.
      // Normal tiebreak at 6 6 uses target 7.
      if (prev.isTiebreak) {
        let next: Snapshot = { ...prev };
        if (team === "A") next.tbA += 1;
        else next.tbB += 1;

        next.tbPointNumber = prev.tbPointNumber + 1;

        const tbWin = tiebreakWinner(next.tbA, next.tbB, next.tiebreakTarget);
        if (tbWin) {
          next = winTiebreakAsSet(next, tbWin);
        }
        return next;
      }

      // Normal game scoring
      const golden = payload.rules.goldenPoint;

      // If both at least 40
      if (prev.pA >= 3 && prev.pB >= 3) {
        if (golden) {
          // At 40 40, next point wins game.
          return winGame(prev, team);
        }

        // Advantage mode
        if (prev.adTeam === null) {
          return { ...prev, adTeam: team };
        }
        if (prev.adTeam === team) {
          return winGame(prev, team);
        }
        // Opponent cancels advantage back to deuce
        return { ...prev, adTeam: null };
      }

      // Standard points under deuce threshold
      let next: Snapshot = { ...prev };
      if (team === "A") next.pA += 1;
      else next.pB += 1;

      // Check game win: 4 points with 2 lead
      const lead = next.pA - next.pB;
      if (next.pA >= 4 || next.pB >= 4) {
        if (Math.abs(lead) >= 2) {
          return winGame(prev, lead > 0 ? "A" : "B");
        }
      }

      // If one reaches 4 while other < 3, game ends
      if (next.pA >= 4 && next.pB <= 2) return winGame(prev, "A");
      if (next.pB >= 4 && next.pA <= 2) return winGame(prev, "B");

      return next;
    });
  }

  function resetMatch() {
    setState((prev) => {
      pushHistory(prev);
      // Keep serverIndex as is, because on court you might want to keep it.
      return {
        ...prev,
        gamesA: 0,
        gamesB: 0,
        setsA: 0,
        setsB: 0,
        setIndex: 0,
        isTiebreak: false,
        tiebreakTarget: 7,
        tbA: 0,
        tbB: 0,
        pA: 0,
        pB: 0,
        adTeam: null,
        tbPointNumber: 0,
        matchOver: false,
        winner: null,
      };
    });
    setHistory([]);
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

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: NAVY,
      color: WHITE,
      padding: 12,
      display: "flex",
      justifyContent: "center",
    },
    shell: {
      width: "100%",
      maxWidth: 760,
      display: "grid",
      gap: 12,
    },
    topBar: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 16,
      padding: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    title: { fontWeight: 950, fontSize: 18, letterSpacing: 0.2 },
    mini: { fontSize: 12, opacity: 0.85, marginTop: 2 },
    chip: (active: boolean): React.CSSProperties => ({
      padding: "10px 12px",
      borderRadius: 999,
      border: active ? `1px solid ${TEAL}` : "1px solid rgba(255,255,255,0.16)",
      background: active ? "rgba(0,168,168,0.16)" : "rgba(255,255,255,0.08)",
      color: WHITE,
      fontWeight: 900,
      cursor: "pointer",
      userSelect: "none",
      fontSize: 13,
      whiteSpace: "nowrap",
    }),
    board: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 18,
      padding: 12,
    },
    boardGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
    teamCard: (serving: boolean): React.CSSProperties => ({
      borderRadius: 16,
      padding: 12,
      background: serving ? "rgba(0,168,168,0.16)" : "rgba(255,255,255,0.06)",
      border: serving ? `1px solid ${TEAL}` : "1px solid rgba(255,255,255,0.12)",
    }),
    teamName: { fontWeight: 950, fontSize: 16, marginBottom: 4 },
    players: { opacity: 0.85, fontSize: 12, lineHeight: 1.3 },
    scoreRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8,
      marginTop: 10,
      alignItems: "end",
    },
    scoreBox: {
      borderRadius: 14,
      padding: 10,
      background: "rgba(0,0,0,0.22)",
      border: "1px solid rgba(255,255,255,0.10)",
      textAlign: "center",
    },
    label: { fontSize: 11, opacity: 0.85, fontWeight: 800 },
    big: { fontSize: 34, fontWeight: 1000, letterSpacing: 0.5, marginTop: 2 },
    mid: { fontSize: 20, fontWeight: 950, marginTop: 2 },
    controls: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
    btn: {
      borderRadius: 16,
      border: "none",
      padding: "16px 14px",
      fontSize: 18,
      fontWeight: 1000,
      cursor: "pointer",
    },
    btnA: { background: TEAL, color: NAVY },
    btnB: { background: "rgba(255,255,255,0.10)", color: WHITE, border: "1px solid rgba(255,255,255,0.18)" },
    actionRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
    smallBtn: {
      borderRadius: 14,
      padding: "12px 10px",
      fontSize: 14,
      fontWeight: 900,
      cursor: "pointer",
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.14)",
    },
  };

  if (!payload) return null;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topBar}>
          <div>
            <div style={styles.title}>{headerTitle}</div>
            <div style={styles.mini}>
              Sets {state.setsA} {state.setsB} , Games {state.gamesA} {state.gamesB}
              {inSuperFinalSet && !state.matchOver ? " , Super tiebreak final set" : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={styles.chip(showServeHelper)} onClick={toggleServeHelper}>
              Serve helper
            </div>
            <div style={styles.chip(false)} onClick={randomFirstServer}>
              Random server
            </div>
          </div>
        </div>

        <div style={styles.board}>
          <div style={styles.boardGrid}>
            <div style={styles.teamCard(showServeHelper && currentServerTeam === "A")}>
              <div style={styles.teamName}>Team A</div>
              <div style={styles.players}>
                {teamAPlayers[0]}
                <br />
                {teamAPlayers[1]}
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

            <div style={styles.teamCard(showServeHelper && currentServerTeam === "B")}>
              <div style={styles.teamName}>Team B</div>
              <div style={styles.players}>
                {teamBPlayers[0]}
                <br />
                {teamBPlayers[1]}
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

        <div style={{ opacity: 0.85, fontSize: 12, textAlign: "center", paddingBottom: 8 }}>
          First to {targetSetsToWin} sets wins. {payload.rules.goldenPoint ? "Golden point enabled." : "Advantage enabled."}{" "}
          {payload.rules.superTiebreakFinalSet ? "Final set may be a super tiebreak." : ""}
        </div>
      </div>
    </div>
  );
}