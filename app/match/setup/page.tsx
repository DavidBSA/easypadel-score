"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import PlayerPicker from "../../components/PlayerPicker";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

export default function MatchSetupPage() {
  const router = useRouter();

  const savedPlayers = useMemo(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("eps_players");
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return parsed.filter(Boolean);
    } catch {
      return [];
    }
  }, []);

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");
  const [p4, setP4] = useState("");

  const [sets, setSets] = useState(3);

  const allOptions = useMemo(() => {
    const base = savedPlayers.length ? savedPlayers : ["David", "Player 2", "Player 3", "Player 4"];
    const cleaned = base.map((x) => x.trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  }, [savedPlayers]);

  function startMatch() {
    const players = [p1, p2, p3, p4].map((x) => x.trim());

    const matchData = {
      players,
      mode: "standard",
      sets,
    };

    const encoded = encodeURIComponent(JSON.stringify(matchData));
    router.push(`/match?data=${encoded}`);
  }

  const canStart =
    p1.trim().length > 0 &&
    p2.trim().length > 0 &&
    p3.trim().length > 0 &&
    p4.trim().length > 0;

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
        <Link href="/" style={{ color: WHITE }}>
          ← Home
        </Link>

        <h1 style={{ fontSize: "1.9rem", fontWeight: 900, marginTop: 14 }}>
          Match Setup
        </h1>

        <div style={{ opacity: 0.75, marginTop: 8 }}>
          Pick players, choose sets, then start
        </div>

        <div style={{ marginTop: 22 }}>
          <PlayerPicker
            label="Player 1"
            value={p1}
            options={allOptions}
            placeholder="Select player 1"
            onChange={setP1}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <PlayerPicker
            label="Player 2"
            value={p2}
            options={allOptions}
            placeholder="Select player 2"
            onChange={setP2}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <PlayerPicker
            label="Player 3"
            value={p3}
            options={allOptions}
            placeholder="Select player 3"
            onChange={setP3}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <PlayerPicker
            label="Player 4"
            value={p4}
            options={allOptions}
            placeholder="Select player 4"
            onChange={setP4}
          />
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={{ color: TEAL, fontWeight: 900, marginBottom: 10 }}>
            Number of Sets
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setSets(1)}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: sets === 1 ? "rgba(77,163,255,0.18)" : "rgba(255,255,255,0.06)",
                color: WHITE,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              1 Set
            </button>

            <button
              type="button"
              onClick={() => setSets(3)}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: sets === 3 ? "rgba(77,163,255,0.18)" : "rgba(255,255,255,0.06)",
                color: WHITE,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Best of 3
            </button>
          </div>
        </div>

        <div style={{ marginTop: 26, display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={startMatch}
            disabled={!canStart}
            style={{
              padding: "14px 22px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: canStart ? TEAL : "rgba(255,255,255,0.10)",
              color: WHITE,
              cursor: canStart ? "pointer" : "not-allowed",
              fontWeight: 900,
              fontSize: 16,
              width: "100%",
              maxWidth: 420,
            }}
          >
            Start Match
          </button>
        </div>
      </div>
    </main>
  );
}