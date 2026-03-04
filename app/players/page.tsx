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

  const [sets, setSets] = useState(3);

  function updatePlayer(index: number, value: string) {
    const updated = [...players];
    updated[index] = value;
    setPlayers(updated);
  }

  function startMatch() {

    const matchData = {
      players,
      mode,
      sets
    };

    const encoded = encodeURIComponent(JSON.stringify(matchData));

    router.push(`/match?data=${encoded}`);
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
                width: "220px"
              }}
            />
          </div>
        ))}
      </div>


      <div style={{ marginTop: "25px" }}>
        <h3>Number of Sets</h3>

        <button
          onClick={() => setSets(1)}
          style={{
            margin: "5px",
            padding: "10px 20px",
            background: sets === 1 ? "#333" : "#ccc",
            color: sets === 1 ? "white" : "black"
          }}
        >
          1 Set
        </button>

        <button
          onClick={() => setSets(3)}
          style={{
            margin: "5px",
            padding: "10px 20px",
            background: sets === 3 ? "#333" : "#ccc",
            color: sets === 3 ? "white" : "black"
          }}
        >
          Best of 3
        </button>
      </div>


      <button
        onClick={startMatch}
        style={{
          marginTop: "30px",
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