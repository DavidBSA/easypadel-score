"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function MatchPage() {

  const params = useSearchParams();
  const data = params.get("data");

  let players: string[] = [];
  let sets = 3;
  let mode = "";

  if (data) {
    const parsed = JSON.parse(decodeURIComponent(data));
    players = parsed.players;
    sets = parsed.sets;
    mode = parsed.mode;
  }

  const teamA = [players[0], players[1]];
  const teamB = [players[2], players[3]];

  const scoreLabels = ["0", "15", "30", "40"];

  const [pointsA, setPointsA] = useState(0);
  const [pointsB, setPointsB] = useState(0);

  const [gamesA, setGamesA] = useState(0);
  const [gamesB, setGamesB] = useState(0);

  const [setsWonA, setSetsWonA] = useState(0);
  const [setsWonB, setSetsWonB] = useState(0);

  const [history, setHistory] = useState<any[]>([]);

  function saveState() {
    setHistory([
      ...history,
      {
        pointsA,
        pointsB,
        gamesA,
        gamesB,
        setsWonA,
        setsWonB
      }
    ]);
  }

  function undo() {

    if (history.length === 0) return;

    const previous = history[history.length - 1];

    setPointsA(previous.pointsA);
    setPointsB(previous.pointsB);
    setGamesA(previous.gamesA);
    setGamesB(previous.gamesB);
    setSetsWonA(previous.setsWonA);
    setSetsWonB(previous.setsWonB);

    setHistory(history.slice(0, history.length - 1));
  }

  function resetGame() {
    setPointsA(0);
    setPointsB(0);
  }

  function winGameA() {

    const newGames = gamesA + 1;

    if (newGames >= 6 && newGames - gamesB >= 2) {
      setSetsWonA(setsWonA + 1);
      setGamesA(0);
      setGamesB(0);
    } else {
      setGamesA(newGames);
    }

    resetGame();
  }

  function winGameB() {

    const newGames = gamesB + 1;

    if (newGames >= 6 && newGames - gamesA >= 2) {
      setSetsWonB(setsWonB + 1);
      setGamesA(0);
      setGamesB(0);
    } else {
      setGamesB(newGames);
    }

    resetGame();
  }

  function pointTeamA() {

    saveState();

    if (pointsA >= 3 && pointsB < 3) {
      winGameA();
      return;
    }

    if (pointsA === 3 && pointsB === 3) {
      setPointsA(4);
      return;
    }

    if (pointsA === 4) {
      winGameA();
      return;
    }

    if (pointsB === 4) {
      setPointsB(3);
      return;
    }

    setPointsA(pointsA + 1);
  }

  function pointTeamB() {

    saveState();

    if (pointsB >= 3 && pointsA < 3) {
      winGameB();
      return;
    }

    if (pointsA === 3 && pointsB === 3) {
      setPointsB(4);
      return;
    }

    if (pointsB === 4) {
      winGameB();
      return;
    }

    if (pointsA === 4) {
      setPointsA(3);
      return;
    }

    setPointsB(pointsB + 1);
  }

  function displayScore(points: number) {
    if (points === 4) return "Ad";
    return scoreLabels[points];
  }

  const setsNeeded = sets === 1 ? 1 : 2;

  const matchWinner =
    setsWonA === setsNeeded
      ? "Team A Wins!"
      : setsWonB === setsNeeded
      ? "Team B Wins!"
      : null;

  return (
    <main style={{ textAlign: "center", padding: "40px" }}>

      <h1>Match Score</h1>

      <p>{mode} match</p>

      <h2>{teamA.join(" & ")}</h2>
      <h2>vs</h2>
      <h2>{teamB.join(" & ")}</h2>

      <h3 style={{ marginTop: "30px" }}>Sets</h3>

      <p>{setsWonA} - {setsWonB}</p>

      <h3>Games</h3>

      <p style={{ fontSize: "26px" }}>
        {gamesA} - {gamesB}
      </p>

      <h3>Points</h3>

      <p style={{ fontSize: "32px" }}>
        {displayScore(pointsA)} - {displayScore(pointsB)}
      </p>

      {matchWinner && (
        <h2 style={{ color: "green" }}>{matchWinner}</h2>
      )}

      {!matchWinner && (
        <>
          <button
            onClick={pointTeamA}
            style={{ margin: "10px", padding: "15px 25px" }}
          >
            Point Team A
          </button>

          <button
            onClick={pointTeamB}
            style={{ margin: "10px", padding: "15px 25px" }}
          >
            Point Team B
          </button>
        </>
      )}

      <div style={{ marginTop: "30px" }}>

        <button
          onClick={undo}
          style={{
            padding: "10px 20px",
            background: "#444",
            color: "white"
          }}
        >
          Undo Last Point
        </button>

      </div>

    </main>
  );
}