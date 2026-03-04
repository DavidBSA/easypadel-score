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

const STORAGE_PLAYERS_KEY = "eps_players";
const STORAGE_MATCH_KEY = "eps_match_payload";

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

export default function MatchSetupPage() {
  const router = useRouter();

  const [savedPlayers, setSavedPlayers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(["", "", "", ""]);

  const [sets, setSets] = useState<number>(3);
  const [goldenPoint, setGoldenPoint] = useState<boolean>(true);
  const [superTiebreakFinalSet, setSuperTiebreakFinalSet] = useState<boolean>(true);

  const [newPlayerName, setNewPlayerName] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const initial = safeParseJSON<string[]>(localStorage.getItem(STORAGE_PLAYERS_KEY), []);
    const cleaned = Array.from(new Set(initial.map(normalizeName).filter(Boolean)));
    setSavedPlayers(cleaned);
    if (cleaned.length >= 4) {
      setSelected([cleaned[0] ?? "", cleaned[1] ?? "", cleaned[2] ?? "", cleaned[3] ?? ""]);
    }
  }, []);

  const canStart = useMemo(() => {
    const names = selected.map(normalizeName).filter(Boolean);
    if (names.length !== 4) return false;
    const unique = new Set(names);
    return unique.size === 4;
  }, [selected]);

  function updateSelected(index: number, value: string) {
    setError("");
    setSelected((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addPlayer() {
    const name = normalizeName(newPlayerName);
    if (!name) return;

    setError("");

    setSavedPlayers((prev) => {
      const next = Array.from(new Set([...prev, name]));
      localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(next));
      return next;
    });

    setNewPlayerName("");
  }

  function startMatch() {
    const names = selected.map(normalizeName).filter(Boolean);
    if (names.length !== 4) {
      setError("Please select 4 players.");
      return;
    }
    if (new Set(names).size !== 4) {
      setError("Players must be unique.");
      return;
    }

    const payload: MatchPayload = {
      players: names,
      mode: "standard",
      sets,
      rules: {
        goldenPoint,
        superTiebreakFinalSet,
      },
    };

    localStorage.setItem(STORAGE_MATCH_KEY, JSON.stringify(payload));
    router.push("/match");
  }

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: NAVY,
      color: WHITE,
      padding: 16,
      display: "flex",
      justifyContent: "center",
    },
    card: {
      width: "100%",
      maxWidth: 520,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    },
    title: { fontSize: 22, fontWeight: 800, letterSpacing: 0.2, marginBottom: 4 },
    subtitle: { opacity: 0.85, marginBottom: 16, fontSize: 13 },
    sectionTitle: { fontWeight: 800, marginTop: 14, marginBottom: 10 },
    row: { display: "flex", gap: 10, alignItems: "center" },
    grid: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
    select: {
      width: "100%",
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: 12,
      padding: "14px 12px",
      fontSize: 16,
      outline: "none",
    },
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
    button: {
      width: "100%",
      background: TEAL,
      color: NAVY,
      border: "none",
      borderRadius: 14,
      padding: "16px 14px",
      fontSize: 18,
      fontWeight: 900,
      cursor: "pointer",
      boxShadow: "0 10px 18px rgba(0,168,168,0.18)",
    },
    buttonSecondary: {
      background: "rgba(255,255,255,0.10)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: 12,
      padding: "14px 12px",
      fontSize: 16,
      fontWeight: 800,
      cursor: "pointer",
      minWidth: 120,
      whiteSpace: "nowrap",
    },
    pillRow: { display: "flex", gap: 10, flexWrap: "wrap" },
    pill: (active: boolean): React.CSSProperties => ({
      padding: "12px 12px",
      borderRadius: 999,
      border: active ? `1px solid ${TEAL}` : "1px solid rgba(255,255,255,0.18)",
      background: active ? "rgba(0,168,168,0.16)" : "rgba(255,255,255,0.08)",
      color: WHITE,
      fontWeight: 900,
      cursor: "pointer",
      userSelect: "none",
      minWidth: 110,
      textAlign: "center",
    }),
    toggle: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: 14,
      padding: 12,
    },
    small: { fontSize: 12, opacity: 0.85, marginTop: 4 },
    error: {
      marginTop: 12,
      background: "rgba(255,64,64,0.12)",
      border: "1px solid rgba(255,64,64,0.30)",
      color: WHITE,
      padding: 10,
      borderRadius: 12,
      fontWeight: 800,
    },
    divider: { height: 1, background: "rgba(255,255,255,0.10)", margin: "14px 0" },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.title}>Standard Match Setup</div>
        <div style={styles.subtitle}>Pick 4 players, pick sets, then start scoring.</div>

        <div style={styles.sectionTitle}>Players</div>
        <div style={styles.grid}>
          {["Player 1", "Player 2", "Player 3", "Player 4"].map((label, i) => (
            <div key={label}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6, fontWeight: 800 }}>{label}</div>
              <select
                style={styles.select}
                value={selected[i]}
                onChange={(e) => updateSelected(i, e.target.value)}
              >
                <option value="">Select player</option>
                {savedPlayers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div style={styles.divider} />

        <div style={styles.sectionTitle}>Add player</div>
        <div style={styles.row}>
          <input
            style={styles.input}
            value={newPlayerName}
            placeholder="Type name"
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPlayer();
            }}
          />
          <button style={styles.buttonSecondary} onClick={addPlayer}>
            Add
          </button>
        </div>
        <div style={styles.small}>Saved locally on this device.</div>

        <div style={styles.divider} />

        <div style={styles.sectionTitle}>Number of sets</div>
        <div style={styles.pillRow}>
          <div style={styles.pill(sets === 1)} onClick={() => setSets(1)}>
            1 set
          </div>
          <div style={styles.pill(sets === 3)} onClick={() => setSets(3)}>
            Best of 3
          </div>
          <div style={styles.pill(sets === 5)} onClick={() => setSets(5)}>
            Best of 5
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.sectionTitle}>Rules</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={styles.toggle}>
            <div>
              <div style={{ fontWeight: 900 }}>Golden point at deuce</div>
              <div style={styles.small}>At 40 40, next point wins the game.</div>
            </div>
            <input
              aria-label="Golden point"
              type="checkbox"
              checked={goldenPoint}
              onChange={(e) => setGoldenPoint(e.target.checked)}
              style={{ transform: "scale(1.3)" }}
            />
          </div>

          <div style={styles.toggle}>
            <div>
              <div style={{ fontWeight: 900 }}>Super tiebreak as final set</div>
              <div style={styles.small}>Final set becomes first to 10, win by 2.</div>
            </div>
            <input
              aria-label="Super tiebreak final set"
              type="checkbox"
              checked={superTiebreakFinalSet}
              onChange={(e) => setSuperTiebreakFinalSet(e.target.checked)}
              style={{ transform: "scale(1.3)" }}
            />
          </div>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={{ marginTop: 16 }}>
          <button style={{ ...styles.button, opacity: canStart ? 1 : 0.45 }} onClick={startMatch} disabled={!canStart}>
            Start match
          </button>
        </div>
      </div>
    </div>
  );
}