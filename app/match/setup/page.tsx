"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

function cleanName(value: string) {
  return value.trim();
}

export default function StandardMatchSetupPage() {
  const router = useRouter();

  const [playerPool, setPlayerPool] = useState<string[]>([]);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");
  const [p4, setP4] = useState("");

  const [sets, setSets] = useState<1 | 3 | 5>(3);

  const [goldenPoint, setGoldenPoint] = useState(false);
  const [superTiebreakFinalSet, setSuperTiebreakFinalSet] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("eps_players");
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      const cleaned = parsed.map(cleanName).filter(Boolean);
      setPlayerPool(Array.from(new Set(cleaned)));
    } catch {
      setPlayerPool([]);
    }
  }, []);

  function savePool(next: string[]) {
    const cleaned = next.map(cleanName).filter(Boolean);
    const unique = Array.from(new Set(cleaned));
    setPlayerPool(unique);
    try {
      localStorage.setItem("eps_players", JSON.stringify(unique));
    } catch {}
  }

  function addPlayer() {
    const name = cleanName(window.prompt("Enter player name") || "");
    if (!name) return;
    savePool([...playerPool, name]);
  }

  const selected = useMemo(() => {
    return [p1, p2, p3, p4].map(cleanName).filter(Boolean);
  }, [p1, p2, p3, p4]);

  const hasDuplicates = useMemo(() => {
    const uniq = new Set(selected);
    return uniq.size !== selected.length;
  }, [selected]);

  const canStart =
    cleanName(p1) &&
    cleanName(p2) &&
    cleanName(p3) &&
    cleanName(p4) &&
    !hasDuplicates;

  function setsSummary(value: number) {
    if (value === 1) return "1 set";
    if (value === 3) return "Best of 3 sets";
    return "Best of 5 sets";
  }

  function startMatch() {
    if (!canStart) return;

    const matchData = {
      players: [cleanName(p1), cleanName(p2), cleanName(p3), cleanName(p4)],
      mode: "standard",
      sets,
      rules: {
        goldenPoint,
        superTiebreakFinalSet,
      },
    };

    const encoded = encodeURIComponent(JSON.stringify(matchData));
    router.push(`/match?data=${encoded}`);
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 900,
    marginBottom: 10,
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: WHITE,
    fontSize: 16,
    outline: "none",
  };

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
  };

  const toggleRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    marginTop: 12,
  };

  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(0,168,168,0.25)" : "rgba(255,255,255,0.06)",
    color: WHITE,
    cursor: "pointer",
    fontWeight: 800,
    minWidth: 110,
  });

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
      <div style={{ width: "100%", maxWidth: 560 }}>
        <Link href="/" style={{ color: WHITE, textDecoration: "none" }}>
          ← Home
        </Link>

        <h1 style={{ fontSize: "2.0rem", fontWeight: 900, marginTop: 14 }}>
          Standard Match Setup
        </h1>

        <div style={{ opacity: 0.75, marginTop: 8 }}>
          Select four players, choose rules, then start
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={labelStyle}>Players</div>
            <button
              type="button"
              onClick={addPlayer}
              style={{
                background: "transparent",
                color: TEAL,
                border: "none",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              Add player
            </button>
          </div>

          <div style={rowStyle}>
            <select value={p1} onChange={(e) => setP1(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: NAVY, color: WHITE }}>
                Select player
              </option>
              {playerPool.map((name) => (
                <option key={`p1_${name}`} value={name} style={{ background: NAVY, color: WHITE }}>
                  {name}
                </option>
              ))}
            </select>

            <select value={p2} onChange={(e) => setP2(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: NAVY, color: WHITE }}>
                Select player
              </option>
              {playerPool.map((name) => (
                <option key={`p2_${name}`} value={name} style={{ background: NAVY, color: WHITE }}>
                  {name}
                </option>
              ))}
            </select>

            <select value={p3} onChange={(e) => setP3(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: NAVY, color: WHITE }}>
                Select player
              </option>
              {playerPool.map((name) => (
                <option key={`p3_${name}`} value={name} style={{ background: NAVY, color: WHITE }}>
                  {name}
                </option>
              ))}
            </select>

            <select value={p4} onChange={(e) => setP4(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: NAVY, color: WHITE }}>
                Select player
              </option>
              {playerPool.map((name) => (
                <option key={`p4_${name}`} value={name} style={{ background: NAVY, color: WHITE }}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
            Player pool size: {playerPool.length}
          </div>

          {hasDuplicates ? (
            <div style={{ marginTop: 10, color: "#ffcc66", fontWeight: 800 }}>
              Duplicate player selected, choose four different players
            </div>
          ) : null}
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Rules</div>

          <div style={toggleRow}>
            <div style={{ fontWeight: 900 }}>Golden point at deuce</div>
            <button
              type="button"
              onClick={() => setGoldenPoint((v) => !v)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: goldenPoint ? "rgba(0,168,168,0.25)" : "rgba(255,255,255,0.06)",
                color: WHITE,
                cursor: "pointer",
                fontWeight: 900,
                minWidth: 70,
              }}
            >
              {goldenPoint ? "On" : "Off"}
            </button>
          </div>

          <div style={toggleRow}>
            <div style={{ fontWeight: 900 }}>Super tiebreak as final set</div>
            <button
              type="button"
              onClick={() => setSuperTiebreakFinalSet((v) => !v)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: superTiebreakFinalSet ? "rgba(0,168,168,0.25)" : "rgba(255,255,255,0.06)",
                color: WHITE,
                cursor: "pointer",
                fontWeight: 900,
                minWidth: 70,
              }}
            >
              {superTiebreakFinalSet ? "On" : "Off"}
            </button>
          </div>

          <div style={{ marginTop: 16, fontWeight: 900 }}>Number of sets</div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setSets(1)} style={chipBtn(sets === 1)}>
              1 set
            </button>
            <button type="button" onClick={() => setSets(3)} style={chipBtn(sets === 3)}>
              Best of 3
            </button>
            <button type="button" onClick={() => setSets(5)} style={chipBtn(sets === 5)}>
              Best of 5
            </button>
          </div>

          <div style={{ marginTop: 12, opacity: 0.8, fontSize: 13 }}>
            {setsSummary(sets)}, tiebreak at 6 all
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={startMatch}
            disabled={!canStart}
            style={{
              width: "100%",
              padding: "16px 18px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: canStart ? TEAL : "rgba(255,255,255,0.10)",
              color: WHITE,
              fontWeight: 900,
              fontSize: 18,
              cursor: canStart ? "pointer" : "not-allowed",
            }}
          >
            Start Match
          </button>
        </div>
      </div>
    </main>
  );
}