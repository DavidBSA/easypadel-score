"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PlayersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode");

  const [players, setPlayers] = useState([
    "",
    "",
    "",
    ""
  ]);

  function updatePlayer(index: number, value: string) {
    const updated = [...players];
    updated[index] = value;
    setPlayers(updated);
  }

  function startMatch() {
    router.push("/match");
  }

  return (
    <main style={{ textAlign: "center", padding: "40px" }}>
      <h1>Enter Players</h1>

      <p>Match type: {mode}</p>

      <div style={{ marginTop: "30px" }}>
        {players.map((player, index) => (
          <div key={index} style={{ marginBottom: "10px" }}>
            <input
              type="text"
              placeholder={`Player ${index + 1}`}
              value={player}
              onChange={(e) => updatePlayer(index, e.target.value)}
              style={{
                padding: "10px",
                fontSize: "16px",
                width: "200px"
              }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={startMatch}
        style={{
          marginTop: "20px",
          padding: "12px 25px",
          fontSize: "18px"
        }}
      >
        Start Match
      </button>

      <br />

      <button
        onClick={() => router.push("/")}
        style={{
          marginTop: "15px",
          padding: "8px 20px"
        }}
      >
        Back
      </button>
    </main>
  );
}