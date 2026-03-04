"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const NAVY = "#0F1E2E";
const TEAL = "#00A8A8";
const WHITE = "#FFFFFF";

const POOL_KEY = "eps_player_pool_v1";

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
    return parsed.filter((x) => typeof x === "string").map(cleanName).filter(Boolean);
  } catch {
    return [];
  }
}

function savePool(pool: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(POOL_KEY, JSON.stringify(pool));
}

export default function PlayersPage() {
  const [pool, setPool] = useState<string[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setPool(loadPool());
  }, []);

  const sorted = useMemo(() => {
    const unique = Array.from(new Set(pool.map(cleanName).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [pool]);

  function addPlayer() {
    const n = cleanName(name);
    if (!n) return;
    const next = Array.from(new Set([...pool, n]));
    setPool(next);
    savePool(next);
    setName("");
  }

  function removePlayer(n: string) {
    const next = pool.filter((x) => x !== n);
    setPool(next);
    savePool(next);
  }

  function clearAll() {
    setPool([]);
    savePool([]);
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

        <h1 style={{ fontSize: "1.9rem", marginBottom: 10 }}>Players</h1>
        <div style={{ opacity: 0.75, marginBottom: 16, fontSize: 13 }}>
          Add names once, reuse them in matches and tournaments
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter player name"
              style={{
                flex: 1,
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.05)",
                color: WHITE,
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPlayer();
              }}
            />
            <button
              onClick={addPlayer}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "none",
                background: TEAL,
                color: WHITE,
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Add
            </button>
          </div>

          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              Total players: {sorted.length}
            </div>
            <button
              onClick={clearAll}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "transparent",
                color: WHITE,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear all
            </button>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          {sorted.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No players yet</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {sorted.map((p) => (
                <div
                  key={p}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{p}</div>
                  <button
                    onClick={() => removePlayer(p)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.25)",
                      background: "transparent",
                      color: WHITE,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}