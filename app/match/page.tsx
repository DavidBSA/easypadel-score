"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const NAVY = "#0F1E2E";
const TEAL = "#00A8A8";
const WHITE = "#FFFFFF";

type Team = "A" | "B";

type EventType = "point_a" | "point_b" | "undo" | "end";

type Rules = {
  bestOfSets: 3; // fixed for now
  goldenPoint: boolean; // at deuce, next point wins game
  tiebreakAtSixAll: boolean; // standard tennis/padel
  superTiebreakFinalSet: boolean; // not used yet, placeholder
};

type State = {
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  pointsA: number;
  pointsB: number;
  finished: boolean;
  note: string;
};

const DEFAULT_RULES: Rules = {
  bestOfSets: 3,
  goldenPoint: false,
  tiebreakAtSixAll: true,
  superTiebreakFinalSet: false,
};

function pointsLabel(pointsA: number, pointsB: number, rules: Rules) {
  // deuce/adv logic
  if (pointsA >= 3 && pointsB >= 3) {
    if (pointsA === pointsB) return { a: "40", b: "40", note: "Deuce" };

    if (rules.goldenPoint) {
      return { a: "GP", b: "GP", note: "Golden Point" };
    }

    if (pointsA === pointsB + 1) return { a: "Ad", b: "40", note: "Adv A" };
    if (pointsB === pointsA + 1) return { a: "40", b: "Ad", note: "Adv B" };
    return { a: "40", b: "40", note: "" };
  }

  const map = ["0", "15", "30", "40"] as const;
  return {
    a: map[Math.min(pointsA, 3)],
    b: map[Math.min(pointsB, 3)],
    note: "",
  };
}

function isGameOver(pointsA: number, pointsB: number, rules: Rules) {
  // Golden point: at deuce (3-3 or later), next point wins
  if (rules.goldenPoint && pointsA >= 3 && pointsB >= 3) {
    return pointsA !== pointsB; // first to lead after deuce
  }

  // Standard: win by 2 after at least 4 points
  if (pointsA >= 4 || pointsB >= 4) {
    return Math.abs(pointsA - pointsB) >= 2;
  }
  return false;
}

function gameWinner(pointsA: number, pointsB: number): Team {
  return pointsA > pointsB ? "A" : "B";
}

function isSetOver(gamesA: number, gamesB: number, rules: Rules) {
  // Tiebreak at 6-6 means set ends at 7-6 after tiebreak (we implement as a game for now)
  // For now: normal set end, 6 with 2 game lead, OR 7-6 if tiebreak happened.
  const maxG = Math.max(gamesA, gamesB);
  const diff = Math.abs(gamesA - gamesB);

  if (maxG >= 6 && diff >= 2) return true;

  if (rules.tiebreakAtSixAll) {
    if ((gamesA === 7 && gamesB === 6) || (gamesB === 7 && gamesA === 6)) return true;
  }

  return false;
}

function setWinner(gamesA: number, gamesB: number): Team {
  return gamesA > gamesB ? "A" : "B";
}

function targetSets(rules: Rules) {
  // bestOf3 -> first to 2
  return 2;
}

function isTiebreakMode(gamesA: number, gamesB: number, rules: Rules) {
  return rules.tiebreakAtSixAll && gamesA === 6 && gamesB === 6;
}

function computeState(events: EventType[], rules: Rules): State {
  // Apply undo by removing last point event
  const stack: EventType[] = [];
  for (const e of events) {
    if (e === "undo") {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === "point_a" || stack[i] === "point_b") {
          stack.splice(i, 1);
          break;
        }
      }
      continue;
    }
    stack.push(e);
  }

  let setsA = 0;
  let setsB = 0;
  let gamesA = 0;
  let gamesB = 0;
  let pointsA = 0;
  let pointsB = 0;
  let finished = false;
  let note = "";

  for (const e of stack) {
    if (e === "end") {
      finished = true;
      note = "Match ended";
      break;
    }

    const inTiebreak = isTiebreakMode(gamesA, gamesB, rules);

    if (e === "point_a") pointsA += 1;
    if (e === "point_b") pointsB += 1;

    if (inTiebreak) {
      // Tiebreak rules: first to 7, win by 2
      const maxP = Math.max(pointsA, pointsB);
      const diff = Math.abs(pointsA - pointsB);
      const tbOver = maxP >= 7 && diff >= 2;

      if (tbOver) {
        const w = gameWinner(pointsA, pointsB); // winner of tiebreak "game"
        if (w === "A") gamesA = 7;
        else gamesB = 7;

        pointsA = 0;
        pointsB = 0;

        // set ends at 7-6
        const sw = setWinner(gamesA, gamesB);
        if (sw === "A") setsA += 1;
        else setsB += 1;

        gamesA = 0;
        gamesB = 0;

        if (setsA === targetSets(rules) || setsB === targetSets(rules)) {
          finished = true;
          note = "Match finished";
          break;
        }
      }

      continue;
    }

    if (isGameOver(pointsA, pointsB, rules)) {
      const w = gameWinner(pointsA, pointsB);
      if (w === "A") gamesA += 1;
      else gamesB += 1;

      pointsA = 0;
      pointsB = 0;

      if (isSetOver(gamesA, gamesB, rules)) {
        const sw = setWinner(gamesA, gamesB);
        if (sw === "A") setsA += 1;
        else setsB += 1;

        gamesA = 0;
        gamesB = 0;

        if (setsA === targetSets(rules) || setsB === targetSets(rules)) {
          finished = true;
          note = "Match finished";
          break;
        }
      }
    }
  }

  if (!finished) {
    const inTiebreak = isTiebreakMode(gamesA, gamesB, rules);
    if (inTiebreak) note = "Tiebreak";
  }

  return { setsA, setsB, gamesA, gamesB, pointsA, pointsB, finished, note };
}

export default function MatchPage() {
  const [events, setEvents] = useState<EventType[]>([]);
  const [rules] = useState<Rules>(DEFAULT_RULES);

  const state = useMemo(() => computeState(events, rules), [events, rules]);
  const pointView = useMemo(
    () => pointsLabel(state.pointsA, state.pointsB, rules),
    [state.pointsA, state.pointsB, rules]
  );

  function add(e: EventType) {
    if (state.finished) return;
    setEvents((prev) => [...prev, e]);
  }

  function undo() {
    setEvents((prev) => [...prev, "undo"]);
  }

  function reset() {
    setEvents([]);
  }

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
        <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between" }}>
          <Link href="/" style={{ color: WHITE }}>
            ← Home
          </Link>
          <div style={{ opacity: 0.75, fontSize: 12 }}>Standard match</div>
        </div>

        <h1 style={{ fontSize: "1.8rem", marginBottom: "12px" }}>Live Match</h1>

        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.85 }}>
            <div style={{ fontSize: 13 }}>Team A</div>
            <div style={{ fontSize: 13 }}>Team B</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Sets</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{state.setsA}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Games</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>
                {state.gamesA} , {state.gamesB}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Sets</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{state.setsB}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Points</div>
            <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1 }}>
              {pointView.a} , {pointView.b}
            </div>
            {state.note ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{state.note}</div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button
            onClick={() => add("point_a")}
            style={{
              padding: "22px",
              borderRadius: "14px",
              border: "none",
              background: TEAL,
              color: WHITE,
              fontSize: "18px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Point A
          </button>

          <button
            onClick={() => add("point_b")}
            style={{
              padding: "22px",
              borderRadius: "14px",
              border: "none",
              background: TEAL,
              color: WHITE,
              fontSize: "18px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Point B
          </button>

          <button
            onClick={undo}
            style={{
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: WHITE,
              fontSize: "16px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Undo
          </button>

          <button
            onClick={reset}
            style={{
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: WHITE,
              fontSize: "16px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75 }}>
          Rules: Best of 3 sets. Tiebreak at 6 all. Golden point off.
        </div>
      </div>
    </main>
  );
}