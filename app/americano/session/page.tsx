"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

const STORAGE_SESSION_KEY = "eps_session_active";

type Team = "A" | "B";

type SessionPlayer = { id: string; name: string };

type CourtMatch = {
  courtNumber: number;
  teamA: [string, string];
  teamB: [string, string];
  score: {
    // Legacy fields kept for compatibility, not used for leaderboard in points mode
    setsA: number;
    setsB: number;
    gamesA: number;
    gamesB: number;

    // Points mode
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

  // New, organiser controlled
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
    setsA: s.setsA,
    setsB: s.setsB,
    gamesA: s.gamesA,
    gamesB: s.gamesB,
    pointsA: s.pointsA,
    pointsB: s.pointsB,
    firstServeTeam: s.firstServeTeam,
    isComplete: s.isComplete,
  };
}

function otherTeam(t: Team): Team {
  return t === "A" ? "B" : "A";
}

function computeServingTeam(first: Team, totalPlayed: number, pointsPerMatch: number): Team {
  // Serve turns:
  // Base 4 points per turn
  // If total is not divisible by 4, first server gets the extra points upfront
  const remainder = pointsPerMatch % 4;
  const firstTurn = remainder === 0 ? 4 : 4 + remainder;

  if (totalPlayed < firstTurn) return first;

  const remaining = totalPlayed - firstTurn;
  const turnIndexAfterFirst = Math.floor(remaining / 4) + 1; // 1 means second turn overall
  return turnIndexAfterFirst % 2 === 0 ? first : otherTeam(first);
}

export default function AmericanoSessionPage() {
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<AmericanoSession | null>(null);

  const [showServeHelper, setShowServeHelper] = useState(true);

  // Per match history, keyed by "roundNumber:courtNumber"
  const [historyByKey, setHistoryByKey] = useState<Record<string, MatchSnapshot[]>>({});

  useEffect(() => {
    const s = safeParseJSON<AmericanoSession | null>(localStorage.getItem(STORAGE_SESSION_KEY), null);

    // Soft migration so older sessions do not explode
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

  const roundNumbers = useMemo(() => {
    return (session?.rounds ?? []).map((r) => r.roundNumber).sort((a, b) => a - b);
  }, [session]);

  const currentRound = useMemo(() => {
    if (!session) return null;
    return session.rounds.find((r) => r.roundNumber === session.currentRound) ?? session.rounds[0] ?? null;
  }, [session]);

  const currentRoundIndex = useMemo(() => {
    if (!session) return 0;
    const idx = roundNumbers.indexOf(session.currentRound);
    return idx >= 0 ? idx : 0;
  }, [roundNumbers, session]);

  const pointsPerMatch = useMemo(() => {
    return session?.pointsPerMatch ?? 21;
  }, [session]);

  const allMatchesComplete = useMemo(() => {
    if (!currentRound) return false;
    return currentRound.matches.every((m) => m.score.isComplete);
  }, [currentRound]);

  function persist(next: AmericanoSession) {
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }

  function matchKey(roundNumber: number, courtNumber: number) {
    return `${roundNumber}:${courtNumber}`;
  }

  function pushHistory(key: string, snap: MatchSnapshot) {
    setHistoryByKey((prev) => {
      const existing = prev[key] ?? [];
      return { ...prev, [key]: [...existing, snap] };
    });
  }

  function updateMatchScore(roundNumber: number, courtNumber: number, updater: (score: Score) => Score) {
    if (!session) return;

    const round = session.rounds.find((r) => r.roundNumber === roundNumber);
    const match = round?.matches.find((m) => m.courtNumber === courtNumber);
    if (!round || !match) return;

    const key = matchKey(roundNumber, courtNumber);
    pushHistory(key, shallowSnapshot(match.score));

    const next: AmericanoSession = {
      ...session,
      rounds: session.rounds.map((r) => {
        if (r.roundNumber !== roundNumber) return r;
        return {
          ...r,
          matches: r.matches.map((m) => {
            if (m.courtNumber !== courtNumber) return m;
            return {
              ...m,
              score: updater(m.score),
            };
          }),
        };
      }),
    };

    persist(next);
  }

  function undoMatch(roundNumber: number, courtNumber: number) {
    if (!session) return;

    const key = matchKey(roundNumber, courtNumber);
    const stack = historyByKey[key] ?? [];
    if (stack.length === 0) return;

    const prevSnap = stack[stack.length - 1];
    setHistoryByKey((prev) => ({ ...prev, [key]: stack.slice(0, -1) }));

    const next: AmericanoSession = {
      ...session,
      rounds: session.rounds.map((r) => {
        if (r.roundNumber !== roundNumber) return r;
        return {
          ...r,
          matches: r.matches.map((m) => {
            if (m.courtNumber !== courtNumber) return m;
            return {
              ...m,
              score: { ...m.score, ...prevSnap },
            };
          }),
        };
      }),
    };

    persist(next);
  }

  function resetMatch(roundNumber: number, courtNumber: number) {
    updateMatchScore(roundNumber, courtNumber, (s) => ({
      ...s,
      pointsA: 0,
      pointsB: 0,
      isComplete: false,
    }));

    const key = matchKey(roundNumber, courtNumber);
    setHistoryByKey((prev) => ({ ...prev, [key]: [] }));
  }

  function toggleComplete(roundNumber: number, courtNumber: number) {
    updateMatchScore(roundNumber, courtNumber, (s) => ({ ...s, isComplete: !s.isComplete }));
  }

  function addPoint(roundNumber: number, courtNumber: number, team: Team) {
    updateMatchScore(roundNumber, courtNumber, (s) => {
      if (s.isComplete) return s;

      const a = typeof s.pointsA === "number" ? s.pointsA : 0;
      const b = typeof s.pointsB === "number" ? s.pointsB : 0;

      let nextA = a;
      let nextB = b;

      if (team === "A") nextA += 1;
      else nextB += 1;

      const total = nextA + nextB;
      const done = total >= pointsPerMatch;

      return {
        ...s,
        pointsA: nextA,
        pointsB: nextB,
        isComplete: done ? true : s.isComplete,
      };
    });
  }

  function removePoint(roundNumber: number, courtNumber: number, team: Team) {
    updateMatchScore(roundNumber, courtNumber, (s) => {
      const a = typeof s.pointsA === "number" ? s.pointsA : 0;
      const b = typeof s.pointsB === "number" ? s.pointsB : 0;

      let nextA = a;
      let nextB = b;

      if (team === "A") nextA = clamp(nextA - 1, 0, pointsPerMatch);
      else nextB = clamp(nextB - 1, 0, pointsPerMatch);

      const total = nextA + nextB;

      return {
        ...s,
        pointsA: nextA,
        pointsB: nextB,
        isComplete: total >= pointsPerMatch ? s.isComplete : false,
      };
    });
  }

  function setFirstServe(roundNumber: number, courtNumber: number, team: Team) {
    updateMatchScore(roundNumber, courtNumber, (s) => ({ ...s, firstServeTeam: team }));
  }

  function randomFirstServeForMatch(roundNumber: number, courtNumber: number) {
    const team: Team = Math.random() < 0.5 ? "A" : "B";
    setFirstServe(roundNumber, courtNumber, team);
  }

  function randomFirstServeForRound() {
    if (!session || !currentRound) return;

    const next: AmericanoSession = {
      ...session,
      rounds: session.rounds.map((r) => {
        if (r.roundNumber !== currentRound.roundNumber) return r;
        return {
          ...r,
          matches: r.matches.map((m) => ({
            ...m,
            score: { ...m.score, firstServeTeam: Math.random() < 0.5 ? "A" : "B" },
          })),
        };
      }),
    };

    persist(next);
  }

  function setPointsPerMatch(nextPoints: number) {
    if (!session) return;

    const clean = clamp(Math.round(nextPoints), 8, 99);

    const next: AmericanoSession = {
      ...session,
      pointsPerMatch: clean,
    };

    persist(next);
  }

  function setRound(nextRoundNumber: number) {
    if (!session) return;
    persist({ ...session, currentRound: nextRoundNumber });
  }

  function goPrevRound() {
    if (!session) return;
    const idx = currentRoundIndex;
    if (idx <= 0) return;
    setRound(roundNumbers[idx - 1]);
  }

  function goNextRound() {
    if (!session) return;
    const idx = currentRoundIndex;
    if (idx >= roundNumbers.length - 1) return;
    if (!allMatchesComplete) return;
    setRound(roundNumbers[idx + 1]);
  }

  const leaderboard = useMemo((): LeaderRow[] => {
    if (!session) return [];

    const base = new Map<string, LeaderRow>();
    for (const p of session.players) {
      base.set(p.id, {
        playerId: p.id,
        name: p.name,
        played: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
      });
    }

    const allMatches: CourtMatch[] = [];
    for (const r of session.rounds) {
      for (const m of r.matches) allMatches.push(m);
    }

    for (const m of allMatches) {
      if (!m.score.isComplete) continue;

      const aPts = typeof m.score.pointsA === "number" ? m.score.pointsA : 0;
      const bPts = typeof m.score.pointsB === "number" ? m.score.pointsB : 0;

      const aPlayers = [m.teamA[0], m.teamA[1]];
      const bPlayers = [m.teamB[0], m.teamB[1]];

      for (const pid of aPlayers) {
        const row = base.get(pid);
        if (!row) continue;
        row.played += 1;
        row.pointsFor += aPts;
        row.pointsAgainst += bPts;
      }

      for (const pid of bPlayers) {
        const row = base.get(pid);
        if (!row) continue;
        row.played += 1;
        row.pointsFor += bPts;
        row.pointsAgainst += aPts;
      }
    }

    const rows = Array.from(base.values()).map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst }));

    rows.sort((x, y) => {
      if (y.diff !== x.diff) return y.diff - x.diff;
      if (y.pointsFor !== x.pointsFor) return y.pointsFor - x.pointsFor;
      return x.name.localeCompare(y.name);
    });

    return rows;
  }, [session]);

  const completedMatchCount = useMemo(() => {
    if (!session) return 0;
    let c = 0;
    for (const r of session.rounds) {
      for (const m of r.matches) if (m.score.isComplete) c += 1;
    }
    return c;
  }, [session]);

  const totalMatchCount = useMemo(() => {
    if (!session) return 0;
    let c = 0;
    for (const r of session.rounds) c += r.matches.length;
    return c;
  }, [session]);

  const rowStyle = (isTop3: boolean): React.CSSProperties => ({
    borderRadius: 14,
    padding: 12,
    background: isTop3 ? "rgba(0,168,168,0.14)" : "rgba(0,0,0,0.20)",
    border: isTop3 ? "1px solid rgba(0,168,168,0.40)" : "1px solid rgba(255,255,255,0.10)",
    display: "grid",
    gridTemplateColumns: "44px 1fr 90px 110px 90px",
    gap: 10,
    alignItems: "center",
  });

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: NAVY,
      color: WHITE,
      padding: 16,
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
    },
    card: {
      width: "100%",
      maxWidth: 980,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 18,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      marginTop: 12,
    },
    titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    title: { fontSize: 22, fontWeight: 950 },
    subtitle: { opacity: 0.88, fontSize: 13, marginTop: 6, lineHeight: 1.3, fontWeight: 800 },
    btn: {
      borderRadius: 14,
      padding: "14px 12px",
      fontSize: 16,
      fontWeight: 950,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.10)",
      color: WHITE,
      whiteSpace: "nowrap",
    },
    btnPrimary: {
      borderRadius: 14,
      padding: "14px 12px",
      fontSize: 16,
      fontWeight: 1100,
      cursor: "pointer",
      border: "none",
      background: TEAL,
      color: NAVY,
      whiteSpace: "nowrap",
    },
    sectionTitle: { marginTop: 14, marginBottom: 10, fontWeight: 950, fontSize: 14 },
    topControls: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" },
    grid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    tile: {
      borderRadius: 18,
      padding: 14,
      background: "rgba(0,0,0,0.22)",
      border: "1px solid rgba(255,255,255,0.12)",
      display: "grid",
      gap: 10,
    },
    tileHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    courtTitle: { fontWeight: 1000, color: TEAL, letterSpacing: 0.2 },
    statusPill: {
      borderRadius: 999,
      padding: "8px 10px",
      fontSize: 12,
      fontWeight: 1000,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.08)",
      opacity: 0.95,
      whiteSpace: "nowrap",
    },
    teamLine: { fontWeight: 900, opacity: 0.92, lineHeight: 1.35 },
    pointsRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
    pointsBox: {
      borderRadius: 16,
      padding: 12,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      display: "grid",
      gap: 8,
    },
    boxTitle: { fontWeight: 1000, fontSize: 13, opacity: 0.92 },
    bigNums: { fontSize: 34, fontWeight: 1150, letterSpacing: 0.4, lineHeight: 1.05 },
    smallMeta: { fontSize: 12, opacity: 0.88, fontWeight: 850 },
    controlsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    ctrlBtn: {
      borderRadius: 14,
      padding: "14px 10px",
      fontSize: 16,
      fontWeight: 1100,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.10)",
      color: WHITE,
    },
    ctrlBtnPrimary: {
      borderRadius: 14,
      padding: "14px 10px",
      fontSize: 16,
      fontWeight: 1100,
      cursor: "pointer",
      border: "none",
      background: TEAL,
      color: NAVY,
    },
    tinyRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
    tinyBtn: {
      borderRadius: 14,
      padding: "12px 10px",
      fontSize: 13,
      fontWeight: 1000,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
    },
    hint: { fontSize: 12, opacity: 0.85, lineHeight: 1.35 },
    warning: {
      marginTop: 10,
      borderRadius: 14,
      padding: 12,
      background: "rgba(255,180,0,0.10)",
      border: "1px solid rgba(255,180,0,0.26)",
      fontSize: 12,
      fontWeight: 900,
      opacity: 0.95,
      lineHeight: 1.35,
    },
    leaderboardWrap: {
      marginTop: 14,
      borderRadius: 18,
      padding: 14,
      background: "rgba(0,0,0,0.18)",
      border: "1px solid rgba(255,255,255,0.12)",
      display: "grid",
      gap: 10,
    },
    lbHeaderRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 10,
      flexWrap: "wrap",
    },
    lbTitle: { fontWeight: 1000, fontSize: 14, color: TEAL },
    lbMeta: { fontSize: 12, opacity: 0.88, fontWeight: 850 },
    lbGrid: { display: "grid", gap: 10 },
    lbHead: {
      display: "grid",
      gridTemplateColumns: "44px 1fr 90px 110px 90px",
      gap: 10,
      fontSize: 12,
      opacity: 0.85,
      fontWeight: 950,
      padding: "0 12px",
    },
    lbCellRight: { textAlign: "right" },
    lbRank: { fontSize: 16, fontWeight: 1100, color: WHITE, textAlign: "center" },
    lbName: { fontSize: 15, fontWeight: 1050 },
    lbNum: { fontSize: 14, fontWeight: 1050, textAlign: "right" },
    settingsRow: {
      marginTop: 10,
      borderRadius: 16,
      padding: 12,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
    },
    input: {
      width: 110,
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: 12,
      padding: "12px 12px",
      fontSize: 16,
      outline: "none",
      fontWeight: 900,
      textAlign: "center",
    },
    chip: {
      borderRadius: 999,
      padding: "10px 12px",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
      fontWeight: 950,
      cursor: "pointer",
      userSelect: "none",
      whiteSpace: "nowrap",
    },
  };

  if (!loaded) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ opacity: 0.9, fontWeight: 950 }}>Loading…</div>
        </div>
      </div>
    );
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
            <button style={styles.btn} onClick={() => router.push("/americano")}>
              Back
            </button>
          </div>

          <div style={styles.sectionTitle}>Next</div>
          <div style={styles.hint}>Create a session from the Americano screen.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <div>
            <div style={styles.title}>Session {session.code}</div>
            <div style={styles.subtitle}>
              Round {session.currentRound} , Courts {session.courts} , Points per match {pointsPerMatch}
            </div>
          </div>

          <div style={styles.topControls}>
            <button style={styles.btn} onClick={() => router.push("/americano")}>
              Settings
            </button>

            <button
              style={{ ...styles.btn, opacity: currentRoundIndex <= 0 ? 0.45 : 1 }}
              onClick={goPrevRound}
              disabled={currentRoundIndex <= 0}
            >
              Prev round
            </button>

            <button
              style={{
                ...styles.btnPrimary,
                opacity: currentRoundIndex >= roundNumbers.length - 1 || !allMatchesComplete ? 0.45 : 1,
              }}
              onClick={goNextRound}
              disabled={currentRoundIndex >= roundNumbers.length - 1 || !allMatchesComplete}
            >
              Next round
            </button>
          </div>
        </div>

        <div style={styles.settingsRow}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 1000 }}>Points per match</div>
            <div style={styles.hint}>Total points shared by both teams. Example 16, 21, 32.</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              style={styles.input}
              value={String(pointsPerMatch)}
              inputMode="numeric"
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                const n = raw ? Number(raw) : 0;
                if (Number.isFinite(n)) setPointsPerMatch(n);
              }}
              aria-label="Points per match"
            />

            <div
              style={{ ...styles.chip, borderColor: showServeHelper ? "rgba(0,168,168,0.55)" : "rgba(255,255,255,0.16)" }}
              onClick={() => setShowServeHelper((v) => !v)}
            >
              Serve helper
            </div>

            <div style={styles.chip} onClick={randomFirstServeForRound}>
              Random first serve
            </div>
          </div>
        </div>

        {!allMatchesComplete ? (
          <div style={styles.warning}>
            Finish all courts in this round before moving to the next round. Mark a court complete once its score is final.
          </div>
        ) : null}

        <div style={styles.sectionTitle}>Current round</div>

        {currentRound ? (
          <div style={styles.grid}>
            {currentRound.matches.map((m) => {
              const a1 = nameById.get(m.teamA[0]) ?? "A1";
              const a2 = nameById.get(m.teamA[1]) ?? "A2";
              const b1 = nameById.get(m.teamB[0]) ?? "B1";
              const b2 = nameById.get(m.teamB[1]) ?? "B2";

              const key = matchKey(currentRound.roundNumber, m.courtNumber);
              const canUndo = (historyByKey[key]?.length ?? 0) > 0;

              const statusText = m.score.isComplete ? "Complete" : "In play";

              const pA = typeof m.score.pointsA === "number" ? m.score.pointsA : 0;
              const pB = typeof m.score.pointsB === "number" ? m.score.pointsB : 0;
              const totalPlayed = pA + pB;

              const firstServe = m.score.firstServeTeam ?? "A";
              const servingTeam = computeServingTeam(firstServe, totalPlayed, pointsPerMatch);

              return (
                <div key={m.courtNumber} style={styles.tile}>
                  <div style={styles.tileHeader}>
                    <div style={styles.courtTitle}>Court {m.courtNumber}</div>
                    <div
                      style={{
                        ...styles.statusPill,
                        borderColor: m.score.isComplete ? "rgba(0,168,168,0.55)" : "rgba(255,255,255,0.14)",
                      }}
                    >
                      {statusText}
                    </div>
                  </div>

                  <div style={styles.teamLine}>
                    Team A: {a1}, {a2}
                  </div>
                  <div style={styles.teamLine}>
                    Team B: {b1}, {b2}
                  </div>

                  {showServeHelper ? (
                    <div style={{ ...styles.smallMeta, color: TEAL, fontWeight: 1000 }}>
                      Serving now: Team {servingTeam} , First serve: Team {firstServe}
                    </div>
                  ) : null}

                  <div style={styles.pointsRow}>
                    <div style={styles.pointsBox}>
                      <div style={styles.boxTitle}>Team A points</div>
                      <div style={styles.bigNums}>{pA}</div>
                      <div style={styles.controlsRow}>
                        <button
                          style={{ ...styles.ctrlBtnPrimary, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => addPoint(currentRound.roundNumber, m.courtNumber, "A")}
                          disabled={m.score.isComplete}
                        >
                          Point A
                        </button>
                        <button
                          style={{ ...styles.ctrlBtn, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => removePoint(currentRound.roundNumber, m.courtNumber, "A")}
                          disabled={m.score.isComplete}
                        >
                          Minus
                        </button>
                      </div>
                    </div>

                    <div style={styles.pointsBox}>
                      <div style={styles.boxTitle}>Team B points</div>
                      <div style={styles.bigNums}>{pB}</div>
                      <div style={styles.controlsRow}>
                        <button
                          style={{ ...styles.ctrlBtnPrimary, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => addPoint(currentRound.roundNumber, m.courtNumber, "B")}
                          disabled={m.score.isComplete}
                        >
                          Point B
                        </button>
                        <button
                          style={{ ...styles.ctrlBtn, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => removePoint(currentRound.roundNumber, m.courtNumber, "B")}
                          disabled={m.score.isComplete}
                        >
                          Minus
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={styles.smallMeta}>
                    Played {totalPlayed} of {pointsPerMatch}
                  </div>

                  <div style={styles.tinyRow}>
                    <button style={styles.tinyBtn} onClick={() => toggleComplete(currentRound.roundNumber, m.courtNumber)}>
                      {m.score.isComplete ? "Reopen" : "Mark complete"}
                    </button>

                    <button
                      style={{ ...styles.tinyBtn, opacity: canUndo ? 1 : 0.45 }}
                      onClick={() => undoMatch(currentRound.roundNumber, m.courtNumber)}
                      disabled={!canUndo}
                    >
                      Undo
                    </button>

                    <button style={styles.tinyBtn} onClick={() => resetMatch(currentRound.roundNumber, m.courtNumber)}>
                      Reset
                    </button>
                  </div>

                  <div style={styles.tinyRow}>
                    <button style={styles.tinyBtn} onClick={() => setFirstServe(currentRound.roundNumber, m.courtNumber, "A")}>
                      First serve A
                    </button>
                    <button style={styles.tinyBtn} onClick={() => setFirstServe(currentRound.roundNumber, m.courtNumber, "B")}>
                      First serve B
                    </button>
                    <button style={styles.tinyBtn} onClick={() => randomFirstServeForMatch(currentRound.roundNumber, m.courtNumber)}>
                      Random
                    </button>
                  </div>

                  <div style={styles.hint}>
                    Leaderboard counts only completed matches. Serve helper rotates by 4 points, extra points go to the first server upfront.
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.hint}>No round data.</div>
        )}

        <div style={styles.leaderboardWrap}>
          <div style={styles.lbHeaderRow}>
            <div style={styles.lbTitle}>Leaderboard</div>
            <div style={styles.lbMeta}>
              Completed matches {completedMatchCount} of {totalMatchCount}
            </div>
          </div>

          <div style={styles.lbHead}>
            <div style={{ textAlign: "center" }}>Rank</div>
            <div>Player</div>
            <div style={styles.lbCellRight}>Played</div>
            <div style={styles.lbCellRight}>Points</div>
            <div style={styles.lbCellRight}>Diff</div>
          </div>

          <div style={styles.lbGrid}>
            {leaderboard.map((r, idx) => {
              const isTop3 = idx < 3;
              const pointsText = `${r.pointsFor} to ${r.pointsAgainst}`;
              const diffText = r.diff > 0 ? `+${r.diff}` : `${r.diff}`;

              return (
                <div key={r.playerId} style={rowStyle(isTop3)}>
                  <div style={styles.lbRank}>{idx + 1}</div>
                  <div style={styles.lbName}>{r.name}</div>
                  <div style={styles.lbNum}>{r.played}</div>
                  <div style={styles.lbNum}>{pointsText}</div>
                  <div style={styles.lbNum}>{diffText}</div>
                </div>
              );
            })}
          </div>

          <div style={styles.hint}>Ranking uses point difference, then points for. Only completed matches count.</div>
        </div>
      </div>
    </div>
  );
}