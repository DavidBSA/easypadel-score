"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const STORAGE_PLAYERS_KEY = "eps_players";
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
  pointsPerMatch?: number;
  servesPerRotation?: number;
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
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function buildRound(players: SessionPlayer[], courts: number, roundNumber: number): Round {
  const mixed = shuffle(players.slice(0, courts * 4));
  const matches: CourtMatch[] = [];
  for (let c = 0; c < courts; c++) {
    const b = c * 4;
    matches.push({
      courtNumber: c + 1,
      teamA: [mixed[b].id, mixed[b + 1].id],
      teamB: [mixed[b + 2].id, mixed[b + 3].id],
      score: { setsA: 0, setsB: 0, gamesA: 0, gamesB: 0, isComplete: false },
    });
  }
  return { roundNumber, matches };
}

const playerChipStyle = (active: boolean): React.CSSProperties => ({
  borderRadius: 14,
  padding: 12,
  background: active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
  border: active ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.10)",
  cursor: "pointer",
  fontWeight: 900,
  color: active ? WHITE : WARM_WHITE,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
});

export default function AmericanoPage() {
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [savedPlayers, setSavedPlayers] = useState<string[]>([]);
  const [session, setSession] = useState<AmericanoSession | null>(null);
  const [courts, setCourts] = useState<number>(2);
  const [servesPerRotation, setServesPerRotation] = useState<number>(4);
  const [pickedNames, setPickedNames] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = safeParseJSON<string[]>(localStorage.getItem(STORAGE_PLAYERS_KEY), []);
    setSavedPlayers(Array.from(new Set(saved.map(normalizeName).filter(Boolean))));
    setSession(safeParseJSON<AmericanoSession | null>(localStorage.getItem(STORAGE_SESSION_KEY), null));
    setLoaded(true);
  }, []);

  const minPlayers = useMemo(() => courts * 4, [courts]);
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
    setPickedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  function createSession() {
    setError("");
    const unique = Array.from(new Set(pickedNames.map(normalizeName).filter(Boolean)));
    if (unique.length < minPlayers) {
      setError(`Select at least ${minPlayers} players for ${courts} court${courts > 1 ? "s" : ""}. Extra players rotate as sit-outs.`);
      return;
    }
    const players: SessionPlayer[] = unique.map((name) => ({ id: makeId(), name }));
    const next: AmericanoSession = {
      code: makeCode(),
      createdAtISO: new Date().toISOString(),
      courts,
      players,
      currentRound: 1,
      rounds: [buildRound(players, courts, 1)],
      pointsPerMatch: 21,
      servesPerRotation,
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

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 680, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.50)", marginTop: 12 },
    titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    title: { fontSize: 22, fontWeight: 1000 },
    subtitle: { color: WARM_WHITE, opacity: 0.6, fontSize: 13, marginTop: 5, lineHeight: 1.35 },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 18, marginBottom: 8 },
    row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const },
    input: { flex: 1, background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "14px 12px", fontSize: 16, outline: "none", fontWeight: 900 },
    btn: { borderRadius: 14, padding: "14px 14px", fontSize: 15, fontWeight: 950, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnPrimary: { borderRadius: 14, padding: "14px 18px", fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, whiteSpace: "nowrap" as const },
    btnDanger: { borderRadius: 14, padding: "14px 14px", fontSize: 15, fontWeight: 950, cursor: "pointer", border: "1px solid rgba(255,64,64,0.35)", background: "rgba(255,64,64,0.10)", color: WHITE, whiteSpace: "nowrap" as const },
    courtCounter: { fontSize: 20, fontWeight: 1000, minWidth: 90, textAlign: "center" as const },
    counterMeta: { fontSize: 13, color: WARM_WHITE, opacity: 0.55, marginLeft: "auto" },
    grid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" },
    small: { fontSize: 12, color: WARM_WHITE, opacity: 0.55, marginTop: 6, lineHeight: 1.35 },
    activeSessionCode: { fontSize: 22, fontWeight: 1000, color: ORANGE, letterSpacing: 2 },
    activeSessionMeta: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4 },
    error: { marginTop: 12, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
      };

  if (!loaded) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ opacity: 0.7, fontWeight: 900 }}>Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.titleRow}>
          <div>
            <div style={styles.title}>Mixed Americano</div>
            <div style={styles.subtitle}>Rotating partners · Points-based scoring</div>
          </div>
          <button style={styles.btn} onClick={() => router.push("/")}>Home</button>
        </div>

        <div style={styles.divider} />

        {session ? (
          <>
            <div style={styles.sectionLabel}>Active session</div>
            <div style={styles.activeSessionCode}>{session.code}</div>
            <div style={styles.activeSessionMeta}>
              {session.players.length} players · {session.courts} court{session.courts > 1 ? "s" : ""}
            </div>
            <div style={styles.small}>Stored on this device.</div>
            <div style={{ ...styles.row, marginTop: 14 }}>
              <button style={styles.btnPrimary} onClick={() => router.push("/americano/session")}>Open session</button>
              <button style={styles.btnDanger} onClick={discardSession}>Discard session</button>
            </div>
          </>
        ) : (
          <>
            {/* Courts */}
            <div style={styles.sectionLabel}>Courts</div>
            <div style={styles.row}>
              <button style={styles.btn} onClick={() => setCourts((c) => Math.max(1, c - 1))}>−</button>
              <div style={styles.courtCounter}>{courts} {courts === 1 ? "court" : "courts"}</div>
              <button style={styles.btn} onClick={() => setCourts((c) => Math.min(6, c + 1))}>+</button>
              <div style={styles.counterMeta}>Min {minPlayers} players · {selectedCount} selected</div>
            </div>

            <div style={styles.divider} />

            {/* Serves per rotation */}
            <div style={styles.sectionLabel}>Serves before rotation</div>
            <div style={styles.row}>
              {[2, 4].map((n) => (
                <div key={n} style={(styles.serveChip as (a: boolean) => React.CSSProperties)(servesPerRotation === n)} onClick={() => setServesPerRotation(n)}>
                  {n} points per serve
                </div>
              ))}
            </div>
            <div style={styles.small}>
              How many consecutive points each player serves before the serve passes on. 4 is standard.
            </div>

            <div style={styles.divider} />

            {/* Add player */}
            <div style={styles.sectionLabel}>Add player</div>
            <div style={styles.row}>
              <input
                style={styles.input}
                value={newName}
                placeholder="Player name"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addSavedPlayer(); }}
              />
              <button style={styles.btnPrimary} onClick={addSavedPlayer}>Add</button>
            </div>
            <div style={styles.small}>Names saved locally and reused across sessions.</div>

            {/* Player grid */}
            <div style={styles.sectionLabel}>Select players</div>
            {savedPlayers.length === 0 ? (
              <div style={styles.small}>Add players above to get started.</div>
            ) : (
              <div style={styles.grid}>
                {savedPlayers.map((name) => {
                  const active = pickedNames.includes(name);
                  return (
                    <div key={name} style={playerChipStyle(active)} onClick={() => togglePick(name)}>
                      <div>{name}</div>
                      {active && <div style={{ fontSize: 12, color: ORANGE, fontWeight: 1000 }}>✓</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div style={{ ...styles.row, marginTop: 16 }}>
              <button style={styles.btn} onClick={() => { setPickedNames([]); setError(""); }}>Clear</button>
              <div style={{ flex: 1 }} />
              <button
                style={{ ...styles.btnPrimary, opacity: selectedCount >= minPlayers ? 1 : 0.4 }}
                onClick={createSession}
                disabled={selectedCount < minPlayers}
              >
                Create session
              </button>
            </div>

            {error && <div style={styles.error}>{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}