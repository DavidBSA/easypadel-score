"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const NAVY = "#0F1E2E";
const TEAL = "#00A8A8";
const WHITE = "#FFFFFF";

type EventType = "point_a" | "point_b" | "undo";

type Players = {
  a1: string;
  a2: string;
  b1: string;
  b2: string;
};

const PLAYERS_KEY = "eps_players_v1";

function loadPlayers(): Players {
  if (typeof window === "undefined") {
    return { a1: "", a2: "", b1: "", b2: "" };
  }
  const raw = localStorage.getItem(PLAYERS_KEY);
  if (!raw) return { a1: "", a2: "", b1: "", b2: "" };
  return JSON.parse(raw);
}

function savePlayers(p: Players) {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(p));
}

export default function MatchPage() {
  const [events, setEvents] = useState<EventType[]>([]);
  const [players, setPlayers] = useState<Players>({
    a1: "",
    a2: "",
    b1: "",
    b2: "",
  });

  useEffect(() => {
    setPlayers(loadPlayers());
  }, []);

  function updatePlayer(key: keyof Players, value: string) {
    const next = { ...players, [key]: value };
    setPlayers(next);
    savePlayers(next);
  }

  function add(e: EventType) {
    setEvents((prev) => [...prev, e]);
  }

  function undo() {
    setEvents((prev) => [...prev, "undo"]);
  }

  function reset() {
    setEvents([]);
  }

  const scoreA = events.filter((e) => e === "point_a").length;
  const scoreB = events.filter((e) => e === "point_b").length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: NAVY,
        color: WHITE,
        fontFamily: "Arial",
        padding: "20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/" style={{ color: WHITE }}>
            ← Home
          </Link>
        </div>

        <h1 style={{ fontSize: "1.8rem", marginBottom: 14 }}>
          Live Match
        </h1>

        {/* PLAYER INPUT */}
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
            Players (saved for next time)
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <input
              value={players.a1}
              onChange={(e) => updatePlayer("a1", e.target.value)}
              placeholder="Team A Player 1"
              style={inputStyle}
            />

            <input
              value={players.a2}
              onChange={(e) => updatePlayer("a2", e.target.value)}
              placeholder="Team A Player 2"
              style={inputStyle}
            />

            <input
              value={players.b1}
              onChange={(e) => updatePlayer("b1", e.target.value)}
              placeholder="Team B Player 1"
              style={inputStyle}
            />

            <input
              value={players.b2}
              onChange={(e) => updatePlayer("b2", e.target.value)}
              placeholder="Team B Player 2"
              style={inputStyle}
            />
          </div>
        </div>

        {/* SCOREBOARD */}
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            {players.a1 || "Team A"} & {players.a2 || ""}
          </div>

          <div style={{ fontSize: 54, fontWeight: 900 }}>
            {scoreA}
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
            {players.b1 || "Team B"} & {players.b2 || ""}
          </div>

          <div style={{ fontSize: 54, fontWeight: 900 }}>
            {scoreB}
          </div>
        </div>

        {/* BUTTONS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <button style={buttonStyle} onClick={() => add("point_a")}>
            Point A
          </button>

          <button style={buttonStyle} onClick={() => add("point_b")}>
            Point B
          </button>

          <button style={secondaryButton} onClick={undo}>
            Undo
          </button>

          <button style={secondaryButton} onClick={reset}>
            Reset
          </button>
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.05)",
  color: "#FFFFFF",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "22px",
  borderRadius: 14,
  border: "none",
  background: "#00A8A8",
  color: "#FFFFFF",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  padding: "16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: "#FFFFFF",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};