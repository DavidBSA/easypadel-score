"use client";

import { useState } from "react";
import Link from "next/link";

const NAVY = "#0F1E2E";
const TEAL = "#00A8A8";
const WHITE = "#FFFFFF";

export default function MatchPage() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);

  function pointA() {
    setA((v) => v + 1);
  }

  function pointB() {
    setB((v) => v + 1);
  }

  function reset() {
    setA(0);
    setB(0);
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
        <div style={{ marginBottom: "16px" }}>
          <Link href="/" style={{ color: WHITE }}>
            ← Home
          </Link>
        </div>

        <h1 style={{ fontSize: "1.8rem", marginBottom: "12px" }}>
          Live Match
        </h1>

        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              opacity: 0.8,
            }}
          >
            <div>Team A</div>
            <div>Team B</div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "64px",
              fontWeight: 800,
              marginTop: "6px",
            }}
          >
            <div>{a}</div>
            <div>{b}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button
            onClick={pointA}
            style={{
              padding: "22px",
              borderRadius: "14px",
              border: "none",
              background: TEAL,
              color: WHITE,
              fontSize: "18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Point A
          </button>

          <button
            onClick={pointB}
            style={{
              padding: "22px",
              borderRadius: "14px",
              border: "none",
              background: TEAL,
              color: WHITE,
              fontSize: "18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Point B
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
              fontWeight: 700,
              cursor: "pointer",
              gridColumn: "span 2",
            }}
          >
            Reset Match
          </button>
        </div>
      </div>
    </main>
  );
}