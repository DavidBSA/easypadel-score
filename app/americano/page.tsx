"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

const STORAGE_PLAYERS_KEY = "eps_players";
const STORAGE_SESSION_KEY = "eps_session_active";

type SessionPlayer = {
  id: string;
  name: string;
};

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

type Round = {
  roundNumber: number;
  matches: CourtMatch[];
};

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

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function buildRound(players: SessionPlayer[], courts: number, roundNumber: number): Round {
  const needed = courts * 4;
  const picked = players.slice(0, needed);
  const mixed = shuffle(picked);

  const matches: CourtMatch[] = [];
  for (let c = 0; c < courts; c += 1) {
    const base = c * 4;
    const p1 = mixed[base + 0];
    const p2 = mixed[base + 1];
    const p3 = mixed[base + 2];
    const p4 = mixed[base + 3];

    matches.push({
      courtNumber: c + 1,
      teamA: [p1.id, p2.id],
      teamB: [p3.id, p4.id],
      score: {
        setsA: 0,
        setsB: 0,
        gamesA: 0,
        gamesB: 0,
        isComplete: false,
      },
    });
  }

  return { roundNumber, matches };
}

export default function AmericanoPage() {
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [savedPlayers, setSavedPlayers] = useState<string[]>([]);
  const [session, setSession] = useState<AmericanoSession | null>(null);

  const [courts, setCourts] = useState<number>(2);
  const [pickedNames, setPickedNames] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = safeParseJSON<string[]>(localStorage.getItem(STORAGE_PLAYERS_KEY), []);
    const cleaned = Array.from(new Set(saved.map(normalizeName).filter(Boolean)));
    setSavedPlayers(cleaned);

    const existing = safeParseJSON<AmericanoSession | null>(localStorage.getItem(STORAGE_SESSION_KEY), null);
    setSession(existing);

    setLoaded(true);
  }, []);

  const neededPlayers = useMemo(() => courts * 4, [courts]);

  const selectedCount = useMemo(() => pickedNames.length, [pickedNames]);

  function persistPlayers(next: string[]) {
    const cleaned = Array.from(new Set(next.map(normalizeName).filter(Boolean)));
    setSavedPlayers(cleaned);
    localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(cleaned));
  }

  function addSavedPlayer() {
    const name = normalizeName(newName);
    if (!name) return;
    setNewName("");
    setError("");
    persistPlayers([...savedPlayers, name]);
  }

  function togglePick(name: string) {
    setError("");
    setPickedNames((prev) => {
      const exists = prev.includes(name);
      if (exists) return prev.filter((n) => n !== name);
      return [...prev, name];
    });
  }

  function clearPicks() {
    setPickedNames([]);
    setError("");
  }

  function createSession() {
    setError("");

    const unique = Array.from(new Set(pickedNames.map(normalizeName).filter(Boolean)));
    if (unique.length !== neededPlayers) {
      setError(`Please select exactly ${neededPlayers} players for ${courts} courts.`);
      return;
    }

    const players: SessionPlayer[] = unique.map((name) => ({ id: makeId(), name }));

    const code = makeCode();
    const round1 = buildRound(players, courts, 1);

    const next: AmericanoSession = {
      code,
      createdAtISO: new Date().toISOString(),
      courts,
      players,
      currentRound: 1,
      rounds: [round1],
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(next));
    setSession(next);
    router.push("/americano/session");
  }

  function discardSession() {
    localStorage.removeItem(STORAGE_SESSION_KEY);
    setSession(null);
    setPickedNames([]);
    setError("");
  }

  // Dynamic style helper lives outside the typed styles object
  const playerChipStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: 14,
    padding: 12,
    background: active ? "rgba(0,168,168,0.18)" : "rgba(0,0,0,0.22)",
    border: active ? `1px solid ${TEAL}` : "1px solid rgba(255,255,255,0.10)",
    cursor: "pointer",
    fontWeight: 900,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
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
      maxWidth: 680,
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
    sectionTitle: { marginTop: 16, marginBottom: 10, fontWeight: 950, fontSize: 14 },
    row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
    input: {
      width: "100%",
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: 12,
      padding: "14px 12px",
      fontSize: 16,
      outline: "none",
    },
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
      border: "none",
      background: TEAL,
      color: NAVY,
    },
    btnDanger: {
      border: "1px solid rgba(255,64,64,0.30)",
      background: "rgba(255,64,64,0.12)",
      color: WHITE,
    },
    counter: { fontSize: 13, opacity: 0.85 },
    grid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    small: { fontSize: 12, opacity: 0.85, marginTop: 6 },
    divider: { height: 1, background: "rgba(255,255,255,0.10)", margin: "14px 0" },
    error: {
      marginTop: 12,
      background: "rgba(255,64,64,0.12)",
      border: "1px solid rgba(255,64,64,0.30)",
      color: WHITE,
      padding: 10,
      borderRadius: 12,
      fontWeight: 900,
    },
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

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <div>
            <div style={styles.title}>Americano Session</div>
            <div style={styles.subtitle}>
              Offline session creation. Later we will add multi device join with the same code.
            </div>
          </div>

          <button style={styles.btn} onClick={() => router.push("/")}>
            Home
          </button>
        </div>

        {session ? (
          <>
            <div style={styles.divider} />
            <div style={styles.sectionTitle}>Active session</div>
            <div style={styles.row}>
              <div style={{ fontWeight: 950 }}>Code</div>
              <div style={{ fontWeight: 950, color: TEAL, fontSize: 18 }}>{session.code}</div>
              <div style={{ flex: 1 }} />
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => router.push("/americano/session")}>
                Open session
              </button>
              <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={discardSession}>
                Discard
              </button>
            </div>
            <div style={styles.small}>
              Players {session.players.length} , Courts {session.courts}
            </div>
            <div style={styles.small}>This is stored locally on this device for now.</div>
          </>
        ) : (
          <>
            <div style={styles.sectionTitle}>Courts</div>
            <div style={styles.row}>
              <button style={styles.btn} onClick={() => setCourts((c) => Math.max(1, c - 1))}>
                Fewer
              </button>
              <div style={{ fontWeight: 950, fontSize: 18 }}>{courts} courts</div>
              <button style={styles.btn} onClick={() => setCourts((c) => Math.min(6, c + 1))}>
                More
              </button>

              <div style={{ flex: 1 }} />
              <div style={styles.counter}>
                Need {neededPlayers} players, Selected {selectedCount}
              </div>
            </div>

            <div style={styles.divider} />

            <div style={styles.sectionTitle}>Add player</div>
            <div style={styles.row}>
              <input
                style={styles.input}
                value={newName}
                placeholder="Type a player name"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSavedPlayer();
                }}
              />
              <button style={styles.btn} onClick={addSavedPlayer}>
                Add
              </button>
            </div>
            <div style={styles.small}>Saved locally, reused for match setup and sessions.</div>

            <div style={styles.sectionTitle}>Select players</div>

            {savedPlayers.length === 0 ? (
              <div style={styles.small}>Add players above, then select them here.</div>
            ) : (
              <div style={styles.grid}>
                {savedPlayers.map((name) => {
                  const active = pickedNames.includes(name);
                  return (
                    <div key={name} style={playerChipStyle(active)} onClick={() => togglePick(name)}>
                      <div>{name}</div>
                      <div style={{ opacity: 0.8 }}>{active ? "Selected" : ""}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={styles.row}>
              <button style={styles.btn} onClick={clearPicks}>
                Clear selection
              </button>

              <div style={{ flex: 1 }} />

              <button
                style={{
                  ...styles.btn,
                  ...styles.btnPrimary,
                  opacity: selectedCount === neededPlayers ? 1 : 0.45,
                }}
                onClick={createSession}
                disabled={selectedCount !== neededPlayers}
              >
                Create session
              </button>
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}
          </>
        )}
      </div>
    </div>
  );
}