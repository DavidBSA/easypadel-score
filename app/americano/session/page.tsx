"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

const STORAGE_SESSION_KEY = "eps_session_active";

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
};

type Score = CourtMatch["score"];

type MatchSnapshot = {
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  isComplete: boolean;
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
    isComplete: s.isComplete,
  };
}

export default function AmericanoSessionPage() {
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<AmericanoSession | null>(null);

  // Per match history, keyed by "roundNumber:courtNumber"
  const [historyByKey, setHistoryByKey] = useState<Record<string, MatchSnapshot[]>>({});

  useEffect(() => {
    const s = safeParseJSON<AmericanoSession | null>(localStorage.getItem(STORAGE_SESSION_KEY), null);
    setSession(s);
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

  const allMatchesComplete = useMemo(() => {
    if (!currentRound) return false;
    return currentRound.matches.every((m) => m.score.isComplete);
  }, [currentRound]);

  const currentRoundIndex = useMemo(() => {
    if (!session) return 0;
    const idx = roundNumbers.indexOf(session.currentRound);
    return idx >= 0 ? idx : 0;
  }, [roundNumbers, session]);

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

    const key = matchKey(roundNumber, courtNumber);

    const round = session.rounds.find((r) => r.roundNumber === roundNumber);
    const match = round?.matches.find((m) => m.courtNumber === courtNumber);
    if (!round || !match) return;

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
    updateMatchScore(roundNumber, courtNumber, () => ({
      setsA: 0,
      setsB: 0,
      gamesA: 0,
      gamesB: 0,
      isComplete: false,
    }));
    // Clear local history stack as well
    const key = matchKey(roundNumber, courtNumber);
    setHistoryByKey((prev) => ({ ...prev, [key]: [] }));
  }

  function toggleComplete(roundNumber: number, courtNumber: number) {
    updateMatchScore(roundNumber, courtNumber, (s) => ({ ...s, isComplete: !s.isComplete }));
  }

  // Simple scoring controls:
  // - games are 0..7 (so 6-6 and 7-6 possible)
  // - sets are 0..3 (keeps it sane for Americano short matches)
  function incGames(roundNumber: number, courtNumber: number, team: "A" | "B") {
    updateMatchScore(roundNumber, courtNumber, (s) => {
      if (s.isComplete) return s;
      const next = { ...s };
      if (team === "A") next.gamesA = clamp(next.gamesA + 1, 0, 7);
      else next.gamesB = clamp(next.gamesB + 1, 0, 7);
      return next;
    });
  }

  function decGames(roundNumber: number, courtNumber: number, team: "A" | "B") {
    updateMatchScore(roundNumber, courtNumber, (s) => {
      if (s.isComplete) return s;
      const next = { ...s };
      if (team === "A") next.gamesA = clamp(next.gamesA - 1, 0, 7);
      else next.gamesB = clamp(next.gamesB - 1, 0, 7);
      return next;
    });
  }

  function incSets(roundNumber: number, courtNumber: number, team: "A" | "B") {
    updateMatchScore(roundNumber, courtNumber, (s) => {
      if (s.isComplete) return s;
      const next = { ...s };
      if (team === "A") next.setsA = clamp(next.setsA + 1, 0, 3);
      else next.setsB = clamp(next.setsB + 1, 0, 3);
      return next;
    });
  }

  function decSets(roundNumber: number, courtNumber: number, team: "A" | "B") {
    updateMatchScore(roundNumber, courtNumber, (s) => {
      if (s.isComplete) return s;
      const next = { ...s };
      if (team === "A") next.setsA = clamp(next.setsA - 1, 0, 3);
      else next.setsB = clamp(next.setsB - 1, 0, 3);
      return next;
    });
  }

  function setRound(nextRoundNumber: number) {
    if (!session) return;

    const next: AmericanoSession = { ...session, currentRound: nextRoundNumber };
    persist(next);
  }

  function goPrevRound() {
    if (!session) return;
    const idx = currentRoundIndex;
    if (idx <= 0) return;
    const prevRound = roundNumbers[idx - 1];
    setRound(prevRound);
  }

  function goNextRound() {
    if (!session) return;
    const idx = currentRoundIndex;
    if (idx >= roundNumbers.length - 1) return;

    // Guardrail: do not advance until all matches complete in current round
    if (!allMatchesComplete) return;

    const nextRound = roundNumbers[idx + 1];
    setRound(nextRound);
  }

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
      maxWidth: 860,
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
    tileHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
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
    scoreRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
    scoreBox: {
      borderRadius: 16,
      padding: 12,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      display: "grid",
      gap: 8,
    },
    scoreTitle: { fontWeight: 1000, fontSize: 13, opacity: 0.92 },
    bigNums: { fontSize: 28, fontWeight: 1150, letterSpacing: 0.4, lineHeight: 1.1 },
    miniNums: { fontSize: 14, fontWeight: 950, opacity: 0.9, marginTop: 2 },
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
              Round {session.currentRound} , Courts {session.courts}
            </div>
          </div>

          <div style={styles.topControls}>
            <button style={styles.btn} onClick={() => router.push("/americano")}>
              Settings
            </button>

            <button style={{ ...styles.btn, opacity: currentRoundIndex <= 0 ? 0.45 : 1 }} onClick={goPrevRound} disabled={currentRoundIndex <= 0}>
              Prev round
            </button>

            <button
              style={{ ...styles.btnPrimary, opacity: currentRoundIndex >= roundNumbers.length - 1 || !allMatchesComplete ? 0.45 : 1 }}
              onClick={goNextRound}
              disabled={currentRoundIndex >= roundNumbers.length - 1 || !allMatchesComplete}
            >
              Next round
            </button>
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

              return (
                <div key={m.courtNumber} style={styles.tile}>
                  <div style={styles.tileHeader}>
                    <div style={styles.courtTitle}>Court {m.courtNumber}</div>
                    <div style={{ ...styles.statusPill, borderColor: m.score.isComplete ? "rgba(0,168,168,0.55)" : "rgba(255,255,255,0.14)" }}>
                      {statusText}
                    </div>
                  </div>

                  <div style={styles.teamLine}>Team A: {a1}, {a2}</div>
                  <div style={styles.teamLine}>Team B: {b1}, {b2}</div>

                  <div style={styles.scoreRow}>
                    <div style={styles.scoreBox}>
                      <div style={styles.scoreTitle}>Team A</div>
                      <div style={styles.bigNums}>
                        {m.score.setsA} sets , {m.score.gamesA} games
                      </div>
                      <div style={styles.controlsRow}>
                        <button
                          style={{ ...styles.ctrlBtnPrimary, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => incGames(currentRound.roundNumber, m.courtNumber, "A")}
                          disabled={m.score.isComplete}
                        >
                          Game +
                        </button>
                        <button
                          style={{ ...styles.ctrlBtn, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => decGames(currentRound.roundNumber, m.courtNumber, "A")}
                          disabled={m.score.isComplete}
                        >
                          Game -
                        </button>
                        <button
                          style={{ ...styles.ctrlBtnPrimary, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => incSets(currentRound.roundNumber, m.courtNumber, "A")}
                          disabled={m.score.isComplete}
                        >
                          Set +
                        </button>
                        <button
                          style={{ ...styles.ctrlBtn, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => decSets(currentRound.roundNumber, m.courtNumber, "A")}
                          disabled={m.score.isComplete}
                        >
                          Set -
                        </button>
                      </div>
                    </div>

                    <div style={styles.scoreBox}>
                      <div style={styles.scoreTitle}>Team B</div>
                      <div style={styles.bigNums}>
                        {m.score.setsB} sets , {m.score.gamesB} games
                      </div>
                      <div style={styles.controlsRow}>
                        <button
                          style={{ ...styles.ctrlBtnPrimary, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => incGames(currentRound.roundNumber, m.courtNumber, "B")}
                          disabled={m.score.isComplete}
                        >
                          Game +
                        </button>
                        <button
                          style={{ ...styles.ctrlBtn, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => decGames(currentRound.roundNumber, m.courtNumber, "B")}
                          disabled={m.score.isComplete}
                        >
                          Game -
                        </button>
                        <button
                          style={{ ...styles.ctrlBtnPrimary, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => incSets(currentRound.roundNumber, m.courtNumber, "B")}
                          disabled={m.score.isComplete}
                        >
                          Set +
                        </button>
                        <button
                          style={{ ...styles.ctrlBtn, opacity: m.score.isComplete ? 0.45 : 1 }}
                          onClick={() => decSets(currentRound.roundNumber, m.courtNumber, "B")}
                          disabled={m.score.isComplete}
                        >
                          Set -
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={styles.tinyRow}>
                    <button style={styles.tinyBtn} onClick={() => toggleComplete(currentRound.roundNumber, m.courtNumber)}>
                      {m.score.isComplete ? "Reopen" : "Mark complete"}
                    </button>
                    <button style={{ ...styles.tinyBtn, opacity: canUndo ? 1 : 0.45 }} onClick={() => undoMatch(currentRound.roundNumber, m.courtNumber)} disabled={!canUndo}>
                      Undo
                    </button>
                    <button style={styles.tinyBtn} onClick={() => resetMatch(currentRound.roundNumber, m.courtNumber)}>
                      Reset
                    </button>
                  </div>

                  <div style={styles.hint}>
                    Use Game plus and minus during play. Use Set plus and minus only if you want to track sets for longer games.
                    Mark complete when final.
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.hint}>No round data.</div>
        )}
      </div>
    </div>
  );
}