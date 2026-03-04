"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

const STORAGE_PLAYERS_KEY = "eps_players";

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

export default function PlayersPage() {
  const router = useRouter();

  const [players, setPlayers] = useState<string[]>([]);
  const [newName, setNewName] = useState<string>("");

  useEffect(() => {
    const stored = safeParseJSON<string[]>(localStorage.getItem(STORAGE_PLAYERS_KEY), []);
    const cleaned = Array.from(new Set(stored.map(normalizeName).filter(Boolean)));
    setPlayers(cleaned);
    localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(cleaned));
  }, []);

  const canAdd = useMemo(() => normalizeName(newName).length > 0, [newName]);

  function save(next: string[]) {
    const cleaned = Array.from(new Set(next.map(normalizeName).filter(Boolean)));
    setPlayers(cleaned);
    localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(cleaned));
  }

  function addPlayer() {
    const name = normalizeName(newName);
    if (!name) return;
    save([...players, name]);
    setNewName("");
  }

  function removePlayer(name: string) {
    save(players.filter((p) => p !== name));
  }

  function clearAll() {
    save([]);
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
      maxWidth: 560,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    },
    title: { fontSize: 22, fontWeight: 900, marginBottom: 6 },
    subtitle: { fontSize: 13, opacity: 0.85, marginBottom: 14 },
    row: { display: "flex", gap: 10, alignItems: "center" },
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
      borderRadius: 12,
      padding: "14px 12px",
      fontSize: 16,
      fontWeight: 900,
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
    list: { marginTop: 14, display: "grid", gap: 10 },
    item: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      background: "rgba(0,0,0,0.22)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 14,
      padding: 12,
    },
    name: { fontWeight: 900, fontSize: 16 },
    small: { fontSize: 12, opacity: 0.85 },
    danger: {
      border: "1px solid rgba(255,64,64,0.30)",
      background: "rgba(255,64,64,0.12)",
      color: WHITE,
    },
    divider: { height: 1, background: "rgba(255,255,255,0.10)", margin: "14px 0" },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.title}>Players</div>
        <div style={styles.subtitle}>
          Stored locally on this device. Used in match setup.
        </div>

        <div style={styles.row}>
          <input
            style={styles.input}
            value={newName}
            placeholder="Add a player name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPlayer();
            }}
          />
          <button
            style={{ ...styles.btn, ...styles.btnPrimary, opacity: canAdd ? 1 : 0.5 }}
            onClick={addPlayer}
            disabled={!canAdd}
          >
            Add
          </button>
        </div>

        <div style={styles.divider} />

        <div style={styles.row}>
          <button style={styles.btn} onClick={() => router.push("/")}>
            Home
          </button>
          <button style={styles.btn} onClick={() => router.push("/match/setup")}>
            Match setup
          </button>
          <div style={{ flex: 1 }} />
          <button style={{ ...styles.btn, ...styles.danger }} onClick={clearAll} disabled={players.length === 0}>
            Clear all
          </button>
        </div>

        <div style={styles.list}>
          {players.length === 0 ? (
            <div style={styles.small}>No saved players yet.</div>
          ) : (
            players.map((p) => (
              <div key={p} style={styles.item}>
                <div style={styles.name}>{p}</div>
                <button style={{ ...styles.btn, ...styles.danger }} onClick={() => removePlayer(p)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}