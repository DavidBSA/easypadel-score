"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NAVY = "#0F1E2E";
const TEAL = "#00A8A8";
const WHITE = "#FFFFFF";

const PLAYERS_KEY = "eps_players_v1";
const POOL_KEY = "eps_player_pool_v1";

type Players = {
  a1: string;
  a2: string;
  b1: string;
  b2: string;
};

function cleanName(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function loadPool(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(POOL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => typeof x === "string")
      .map((x) => cleanName(x))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function savePool(pool: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(POOL_KEY, JSON.stringify(pool));
}

function loadPlayers(): Players {
  if (typeof window === "undefined") return { a1: "", a2: "", b1: "", b2: "" };
  try {
    const raw = localStorage.getItem(PLAYERS_KEY);
    if (!raw) return { a1: "", a2: "", b1: "", b2: "" };
    const parsed = JSON.parse(raw) as Partial<Players>;
    return {
      a1: parsed.a1 || "",
      a2: parsed.a2 || "",
      b1: parsed.b1 || "",
      b2: parsed.b2 || "",
    };
  } catch {
    return { a1: "", a2: "", b1: "", b2: "" };
  }
}

function savePlayers(p: Players) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(p));
}

function AddPlayerModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: NAVY,
          padding: 18,
          borderRadius: 14,
          width: "100%",
          maxWidth: 360,
          color: WHITE,
          border: "1px solid rgba(255,255,255,0.16)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          Add Player
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          style={inputStyle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const n = cleanName(name);
              if (!n) return;
              onAdd(n);
              onClose();
            }
          }}
        />

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button
            onClick={() => {
              const n = cleanName(name);
              if (!n) return;
              onAdd(n);
              onClose();
            }}
            style={primaryBtn}
          >
            Add
          </button>

          <button onClick={onClose} style={secondaryBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MatchSetupPage() {
  const router = useRouter();

  const [pool, setPool] = useState<string[]>([]);
  const [players, setPlayers] = useState<Players>({ a1: "", a2: "", b1: "", b2: "" });
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  useEffect(() => {
    setPool(loadPool());
    setPlayers(loadPlayers());
  }, []);

  const sortedPool = useMemo(() => {
    const unique = Array.from(new Set(pool.map(cleanName).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [pool]);

  function update(key: keyof Players, value: string) {
    setPlayers((prev) => ({ ...prev, [key]: value }));
  }

  function addToPool(name: string) {
    const next = Array.from(new Set([...pool, name].map(cleanName).filter(Boolean)));
    setPool(next);
    savePool(next);
  }

  const allSelected =
    cleanName(players.a1) &&
    cleanName(players.a2) &&
    cleanName(players.b1) &&
    cleanName(players.b2);

  function startMatch() {
    if (!allSelected) return;
    savePlayers({
      a1: cleanName(players.a1),
      a2: cleanName(players.a2),
      b1: cleanName(players.b1),
      b2: cleanName(players.b2),
    });
    router.push("/match");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: NAVY,
        color: WHITE,
        fontFamily: "Arial",
        padding: 20,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/" style={{ color: WHITE }}>
            ← Home
          </Link>
        </div>

        <h1 style={{ fontSize: "1.9rem", marginBottom: 8, fontWeight: 900 }}>
          Standard Match Setup
        </h1>

        <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 14 }}>
          Select four players, then start scoring
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 900 }}>Players</div>

            <button
              onClick={() => setShowAddPlayer(true)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: TEAL,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Add player
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select
              value={players.a1}
              onChange={(e) => update("a1", e.target.value)}
              style={selectStyle}
            >
              <option value="">Team A Player 1</option>
              {sortedPool.map((p) => (
                <option key={`a1_${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={players.a2}
              onChange={(e) => update("a2", e.target.value)}
              style={selectStyle}
            >
              <option value="">Team A Player 2</option>
              {sortedPool.map((p) => (
                <option key={`a2_${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={players.b1}
              onChange={(e) => update("b1", e.target.value)}
              style={selectStyle}
            >
              <option value="">Team B Player 1</option>
              {sortedPool.map((p) => (
                <option key={`b1_${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={players.b2}
              onChange={(e) => update("b2", e.target.value)}
              style={selectStyle}
            >
              <option value="">Team B Player 2</option>
              {sortedPool.map((p) => (
                <option key={`b2_${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Player pool size: {sortedPool.length}
          </div>
        </div>

        <button
          onClick={startMatch}
          disabled={!allSelected}
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 14,
            border: "none",
            background: allSelected ? TEAL : "rgba(255,255,255,0.12)",
            color: WHITE,
            fontSize: 17,
            fontWeight: 900,
            cursor: allSelected ? "pointer" : "not-allowed",
          }}
        >
          Start Match
        </button>

        <AddPlayerModal
          open={showAddPlayer}
          onClose={() => setShowAddPlayer(false)}
          onAdd={addToPool}
        />
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.05)",
  color: WHITE,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: WHITE,
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  background: TEAL,
  border: "none",
  padding: 12,
  borderRadius: 12,
  fontWeight: 900,
  color: WHITE,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)",
  padding: 12,
  borderRadius: 12,
  color: WHITE,
  fontWeight: 800,
  cursor: "pointer",
};