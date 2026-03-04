"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type Snapshot = {
  pointsA: number;
  pointsB: number;
  gamesA: number;
  gamesB: number;
  setsWonA: number;
  setsWonB: number;
  isTiebreak: boolean;
  tbA: number;
  tbB: number;
  serveEnabled: boolean;
  serverTeam: "A" | "B" | null;
  serverIndexInTeam: 0 | 1;
};

export default function MatchPage() {
  const params = useSearchParams();
  const data = params.get("data");

  const match = useMemo(() => {
    if (!data) {
      return {
        players: ["", "", "", ""],
        sets: 3,
        mode: "standard",
      };
    }
    const parsed = JSON.parse(decodeURIComponent(data));
    return {
      players: (parsed.players ?? ["", "", "", ""]) as string[],
      sets: (parsed.sets ?? 3) as number,
      mode: (parsed.mode ?? "standard") as string,
    };
  }, [data]);

  const teamA = [match.players[0] || "Player 1", match.players[1] || "Player 2"];
  const teamB = [match.players[2] || "Player 3", match.players[3] || "Player 4"];

  const scoreLabels = ["0", "15", "30", "40"];

  const [pointsA, setPointsA] = useState(0);
  const [pointsB, setPointsB] = useState(0);

  const [gamesA, setGamesA] = useState(0);
  const [gamesB, setGamesB] = useState(0);

  const [setsWonA, setSetsWonA] = useState(0);
  const [setsWonB, setSetsWonB] = useState(0);

  const [isTiebreak, setIsTiebreak] = useState(false);
  const [tbA, setTbA] = useState(0);
  const [tbB, setTbB] = useState(0);

  const [serveEnabled, setServeEnabled] = useState(false);
  const [serverTeam, setServerTeam] = useState<"A" | "B" | null>(null);
  const [serverIndexInTeam, setServerIndexInTeam] = useState<0 | 1>(0);

  const [history, setHistory] = useState<Snapshot[]>([]);

  function setsNeeded(totalSets: number) {
    if (!totalSets || totalSets <= 1) return 1;
    return Math.ceil(totalSets / 2);
  }

  function displayScore(points: number) {
    if (points === 4) return "Ad";
    return scoreLabels[points] ?? "0";
  }

  function saveState() {
    setHistory((prev) => [
      ...prev,
      {
        pointsA,
        pointsB,
        gamesA,
        gamesB,
        setsWonA,
        setsWonB,
        isTiebreak,
        tbA,
        tbB,
        serveEnabled,
        serverTeam,
        serverIndexInTeam,
      },
    ]);
  }

  function undo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];

      setPointsA(previous.pointsA);
      setPointsB(previous.pointsB);
      setGamesA(previous.gamesA);
      setGamesB(previous.gamesB);
      setSetsWonA(previous.setsWonA);
      setSetsWonB(previous.setsWonB);

      setIsTiebreak(previous.isTiebreak);
      setTbA(previous.tbA);
      setTbB(previous.tbB);

      setServeEnabled(previous.serveEnabled);
      setServerTeam(previous.serverTeam);
      setServerIndexInTeam(previous.serverIndexInTeam);

      return prev.slice(0, prev.length - 1);
    });
  }

  function resetGamePoints() {
    setPointsA(0);
    setPointsB(0);
  }

  function advanceServerAfterGame() {
    if (!serveEnabled) return;
    if (!serverTeam) return;
    if (isTiebreak) return;

    if (serverTeam === "A") {
      setServerTeam("B");
      setServerIndexInTeam((idx) => (idx === 0 ? 1 : 0));
      return;
    }

    setServerTeam("A");
    setServerIndexInTeam((idx) => (idx === 0 ? 1 : 0));
  }

  function maybeStartTiebreak(nextGamesA: number, nextGamesB: number) {
    if (nextGamesA === 6 && nextGamesB === 6) {
      setIsTiebreak(true);
      setTbA(0);
      setTbB(0);
      resetGamePoints();
      return true;
    }
    return false;
  }

  function awardSetToA(finalGamesA: number, finalGamesB: number) {
    setSetsWonA((v) => v + 1);
    setGamesA(0);
    setGamesB(0);
    setIsTiebreak(false);
    setTbA(0);
    setTbB(0);
    resetGamePoints();
  }

  function awardSetToB(finalGamesA: number, finalGamesB: number) {
    setSetsWonB((v) => v + 1);
    setGamesA(0);
    setGamesB(0);
    setIsTiebreak(false);
    setTbA(0);
    setTbB(0);
    resetGamePoints();
  }

  function winGameA() {
    const nextA = gamesA + 1;
    const nextB = gamesB;

    if (maybeStartTiebreak(nextA, nextB)) {
      setGamesA(nextA);
      return;
    }

    if (nextA >= 6 && nextA - nextB >= 2) {
      awardSetToA(nextA, nextB);
      advanceServerAfterGame();
      return;
    }

    setGamesA(nextA);
    resetGamePoints();
    advanceServerAfterGame();
  }

  function winGameB() {
    const nextA = gamesA;
    const nextB = gamesB + 1;

    if (maybeStartTiebreak(nextA, nextB)) {
      setGamesB(nextB);
      return;
    }

    if (nextB >= 6 && nextB - nextA >= 2) {
      awardSetToB(nextA, nextB);
      advanceServerAfterGame();
      return;
    }

    setGamesB(nextB);
    resetGamePoints();
    advanceServerAfterGame();
  }

  function pointTeamA() {
    saveState();

    if (isTiebreak) {
      const next = tbA + 1;
      setTbA(next);

      if (next >= 7 && next - tbB >= 2) {
        awardSetToA(7, 6);
      }
      return;
    }

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

    if (isTiebreak) {
      const next = tbB + 1;
      setTbB(next);

      if (next >= 7 && next - tbA >= 2) {
        awardSetToB(6, 7);
      }
      return;
    }

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

  function randomFirstServer() {
    saveState();

    const teamPick = Math.random() < 0.5 ? "A" : "B";
    const indexPick = Math.random() < 0.5 ? 0 : 1;

    setServeEnabled(true);
    setServerTeam(teamPick);
    setServerIndexInTeam(indexPick as 0 | 1);
  }

  const needed = setsNeeded(match.sets);
  const matchWinner =
    setsWonA >= needed ? "Team A Wins!" : setsWonB >= needed ? "Team B Wins!" : null;

  const serverName = (() => {
    if (!serveEnabled) return null;
    if (!serverTeam) return "Select first server";

    if (serverTeam === "A") return teamA[serverIndexInTeam];
    return teamB[serverIndexInTeam];
  })();

  return (
    <main style={{ textAlign: "center", padding: "40px" }}>
      <h1>Match Score</h1>

      <p>{match.mode} match</p>

      <h2>{teamA.join(" & ")}</h2>
      <h2>vs</h2>
      <h2>{teamB.join(" & ")}</h2>

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={() => setServeEnabled((v) => !v)}
          style={{
            padding: "10px 18px",
            marginRight: "10px",
          }}
        >
          Serve Helper: {serveEnabled ? "On" : "Off"}
        </button>

        <button
          onClick={randomFirstServer}
          style={{
            padding: "10px 18px",
          }}
        >
          Random First Server
        </button>

        {serveEnabled && (
          <p style={{ marginTop: "10px" }}>
            Server: {serverName}
            {isTiebreak ? " (tiebreak serving not tracked yet)" : ""}
          </p>
        )}
      </div>

      <h3 style={{ marginTop: "30px" }}>Sets</h3>
      <p>
        {setsWonA} , {setsWonB}
      </p>

      <h3>Games</h3>
      <p style={{ fontSize: "26px" }}>
        {gamesA} , {gamesB}
      </p>

      {!isTiebreak && (
        <>
          <h3>Points</h3>
          <p style={{ fontSize: "32px" }}>
            {displayScore(pointsA)} , {displayScore(pointsB)}
          </p>
        </>
      )}

      {isTiebreak && (
        <>
          <h3>Tiebreak</h3>
          <p style={{ fontSize: "32px" }}>
            {tbA} , {tbB}
          </p>
          <p style={{ marginTop: "6px" }}>
            First to 7, win by 2
          </p>
        </>
      )}

      {matchWinner && <h2 style={{ color: "green" }}>{matchWinner}</h2>}

      {!matchWinner && (
        <>
          <button onClick={pointTeamA} style={{ margin: "10px", padding: "15px 25px" }}>
            Point Team A
          </button>

          <button onClick={pointTeamB} style={{ margin: "10px", padding: "15px 25px" }}>
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
            color: "white",
          }}
        >
          Undo Last Point
        </button>
      </div>
    </main>
  );
}