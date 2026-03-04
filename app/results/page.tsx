"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo } from "react";

type SetRecord = {
  gamesA: number;
  gamesB: number;
  tiebreakPlayed: boolean;
  tbA: number;
  tbB: number;
};

type ResultsPayload = {
  mode: string;
  setsConfigured: number;
  teamA: string[];
  teamB: string[];
  setsWonA: number;
  setsWonB: number;
  setHistory: SetRecord[];
  winner: "A" | "B";
};

export default function ResultsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const data = params.get("data");

  const payload = useMemo(() => {
    if (!data) return null as ResultsPayload | null;
    return JSON.parse(decodeURIComponent(data)) as ResultsPayload;
  }, [data]);

  if (!payload) {
    return (
      <main style={{ textAlign: "center", padding: "40px" }}>
        <h1>Results</h1>
        <p>No results data found.</p>
        <button onClick={() => router.push("/")} style={{ padding: "12px 18px" }}>
          Back to Home
        </button>
      </main>
    );
  }

  const winnerName =
    payload.winner === "A"
      ? payload.teamA.join(" & ")
      : payload.teamB.join(" & ");

  return (
    <main style={{ textAlign: "center", padding: "40px" }}>
      <h1>Match Results</h1>

      <p>{payload.mode} match</p>

      <h2>{payload.teamA.join(" & ")}</h2>
      <h2>vs</h2>
      <h2>{payload.teamB.join(" & ")}</h2>

      <h3 style={{ marginTop: "26px" }}>Final Sets</h3>
      <p style={{ fontSize: "22px" }}>
        {payload.setsWonA} , {payload.setsWonB}
      </p>

      <h3 style={{ marginTop: "26px" }}>Set Scores</h3>

      <div style={{ maxWidth: "420px", margin: "0 auto", textAlign: "left" }}>
        {payload.setHistory.length === 0 && <p>No sets recorded.</p>}

        {payload.setHistory.map((s, idx) => {
          const tbText = s.tiebreakPlayed ? ` (TB ${s.tbA} , ${s.tbB})` : "";
          return (
            <p key={idx} style={{ fontSize: "18px" }}>
              Set {idx + 1}: {s.gamesA} , {s.gamesB}
              {tbText}
            </p>
          );
        })}
      </div>

      <h2 style={{ marginTop: "30px", color: "green" }}>
        Winner: {winnerName}
      </h2>

      <div style={{ marginTop: "30px" }}>
        <button onClick={() => router.push("/")} style={{ padding: "12px 18px" }}>
          New Match
        </button>
      </div>
    </main>
  );
}