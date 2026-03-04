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

function safeParseJSON<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function AmericanoSessionPage() {
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<AmericanoSession | null>(null);

  useEffect(() => {
    const s = safeParseJSON<AmericanoSession | null>(localStorage.getItem(STORAGE_SESSION_KEY), null);
    setSession(s);
    setLoaded(true);
  }, []);

  const currentRound = useMemo(() => {
    if (!session) return null;
    return session.rounds.find((r) => r.roundNumber === session.currentRound) ?? session.rounds[0] ?? null;
  }, [session]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    (session?.players ?? []).forEach((p) => map.set(p.id, p.name));
    return map;
  }, [session]);

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
      maxWidth: 760,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 18,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      marginTop: 12,
    },
    titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    title: { fontSize: 22, fontWeight: 950 },
    subtitle: { opacity: 0.85, fontSize: 13, marginTop: 6, lineHeight: 1.3 },
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
    sectionTitle: { marginTop: 14, marginBottom: 10, fontWeight: 950, fontSize: 14 },
    grid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    tile: {
      borderRadius: 16,
      padding: 12,
      background: "rgba(0,0,0,0.22)",
      border: "1px solid rgba(255,255,255,0.10)",
    },
    courtTitle: { fontWeight: 950, marginBottom: 8, color: TEAL },
    teamLine: { fontWeight: 900, opacity: 0.92, lineHeight: 1.35 },
    small: { fontSize: 12, opacity: 0.85, marginTop: 6 },
  };

  if (!loaded) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ opacity: 0.85, fontWeight: 900 }}>Loading…</div>
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
          <div style={styles.small}>
            Create a session from the Americano screen. Live scoring and leaderboard will be built next.
          </div>
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
          <button style={styles.btn} onClick={() => router.push("/americano")}>
            Settings
          </button>
        </div>

        <div style={styles.sectionTitle}>Current round</div>

        {currentRound ? (
          <div style={styles.grid}>
            {currentRound.matches.map((m) => {
              const a1 = nameById.get(m.teamA[0]) ?? "A1";
              const a2 = nameById.get(m.teamA[1]) ?? "A2";
              const b1 = nameById.get(m.teamB[0]) ?? "B1";
              const b2 = nameById.get(m.teamB[1]) ?? "B2";

              return (
                <div key={m.courtNumber} style={styles.tile}>
                  <div style={styles.courtTitle}>Court {m.courtNumber}</div>
                  <div style={styles.teamLine}>Team A: {a1}, {a2}</div>
                  <div style={styles.teamLine}>Team B: {b1}, {b2}</div>
                  <div style={styles.small}>Scoring screen and leaderboard coming next.</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.small}>No round data.</div>
        )}
      </div>
    </div>
  );
}