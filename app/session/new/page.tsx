"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

type Format = "MIXED" | "TEAM";

export default function NewSessionPage() {
  const router = useRouter();

  const [format, setFormat] = useState<Format>("MIXED");
  const [courts, setCourts] = useState(2);
  const [pointsPerMatch, setPointsPerMatch] = useState(21);
  const [playerInputs, setPlayerInputs] = useState<string[]>(Array(8).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const minPlayers = courts * 4;

  const validPlayers = useMemo(
    () => playerInputs.map((n) => n.trim()).filter(Boolean),
    [playerInputs]
  );

  function setPlayer(i: number, v: string) {
    setPlayerInputs((prev) => prev.map((p, idx) => (idx === i ? v : p)));
  }

  function addRow() {
    setPlayerInputs((prev) => [...prev, ""]);
  }

  async function create() {
    setError("");
    if (validPlayers.length < minPlayers) {
      setError(`Enter at least ${minPlayers} players for ${courts} court${courts > 1 ? "s" : ""}.`);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, courts, pointsPerMatch, players: validPlayers }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Failed to create session."); setLoading(false); return; }

      const { code, organiserPin } = data;

      // Register this device as organiser immediately
      const devR = await fetch(`/api/sessions/${code}/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserPin }),
      });
      const devData = await devR.json();
      if (devData.deviceId) {
        localStorage.setItem(`eps_join_${code}`, JSON.stringify({ deviceId: devData.deviceId, isOrganiser: true }));
      }

      // Store PIN briefly so organiser can share it
      localStorage.setItem(`eps_pin_${code}`, organiserPin);

      router.push(`/session/${code}/organiser`);
    } catch {
      setError("Network error — check your connection.");
      setLoading(false);
    }
  }

  const formatChip = (f: Format, label: string, sub: string) => (
    <div
      onClick={() => setFormat(f)}
      style={{
        flex: 1, borderRadius: 14, padding: "14px 12px", cursor: "pointer", textAlign: "center" as const,
        background: format === f ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
        border: format === f ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div style={{ fontWeight: 1000, fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.55, marginTop: 3 }}>{sub}</div>
    </div>
  );

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 560, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", marginTop: 12 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    title: { fontSize: 22, fontWeight: 1000 },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 16, marginBottom: 10 },
    settingsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    settingBox: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 },
    settingLabel: { fontSize: 12, opacity: 0.55, fontWeight: 900, marginBottom: 10 },
    stepper: { display: "flex", alignItems: "center", gap: 14 },
    stepBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 20, fontWeight: 1000, cursor: "pointer" },
    stepVal: { fontSize: 22, fontWeight: 1100, minWidth: 36, textAlign: "center" as const },
    grid2: { display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0,1fr))" },
    input: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 12px", fontSize: 14, outline: "none", fontWeight: 900, boxSizing: "border-box" as const },
    btn: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE },
    btnPrimary: { width: "100%", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, marginTop: 18 },
    errorBox: { marginTop: 12, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    small: { fontSize: 12, color: WARM_WHITE, opacity: 0.5, marginTop: 6, lineHeight: 1.4 },
  };

  return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={st.row}>
          <div>
            <div style={st.title}>Create Session</div>
            <div style={st.sub}>Multi-device · Live scoring</div>
          </div>
          <button style={st.btn} onClick={() => router.push("/")}>Home</button>
        </div>
        <div style={st.divider} />

        {/* Format */}
        <div style={st.sectionLabel}>Format</div>
        <div style={{ display: "flex", gap: 10 }}>
          {formatChip("MIXED", "Mixed Americano", "Rotating partners")}
          {formatChip("TEAM", "Team Americano", "Fixed partners")}
        </div>

        {/* Courts + Points */}
        <div style={st.sectionLabel}>Match settings</div>
        <div style={st.settingsGrid}>
          <div style={st.settingBox}>
            <div style={st.settingLabel}>Courts</div>
            <div style={st.stepper}>
              <button style={st.stepBtn} onClick={() => setCourts((c) => Math.max(1, c - 1))}>−</button>
              <div style={st.stepVal}>{courts}</div>
              <button style={st.stepBtn} onClick={() => setCourts((c) => Math.min(6, c + 1))}>+</button>
            </div>
          </div>
          <div style={st.settingBox}>
            <div style={st.settingLabel}>Points per match</div>
            <div style={st.stepper}>
              <button style={st.stepBtn} onClick={() => setPointsPerMatch((p) => Math.max(8, p - 1))}>−</button>
              <div style={st.stepVal}>{pointsPerMatch}</div>
              <button style={st.stepBtn} onClick={() => setPointsPerMatch((p) => Math.min(99, p + 1))}>+</button>
            </div>
          </div>
        </div>
        <div style={st.small}>Minimum {minPlayers} players required for {courts} court{courts > 1 ? "s" : ""}.</div>

        {/* Players */}
        <div style={st.sectionLabel}>
          Players — {validPlayers.length} entered{validPlayers.length < minPlayers ? ` (need ${minPlayers})` : " ✓"}
        </div>
        <div style={st.grid2}>
          {playerInputs.map((v, i) => (
            <input
              key={i}
              style={st.input}
              placeholder={`Player ${i + 1}`}
              value={v}
              onChange={(e) => setPlayer(i, e.target.value)}
            />
          ))}
        </div>
        <button style={{ ...st.btn, marginTop: 10, fontSize: 13 }} onClick={addRow}>
          + Add more players
        </button>

        <button
          style={{ ...st.btnPrimary, opacity: loading ? 0.5 : 1 }}
          onClick={create}
          disabled={loading}
        >
          {loading ? "Creating…" : "Create Session"}
        </button>

        {error && <div style={st.errorBox}>{error}</div>}

        <div style={st.small}>
          You'll be taken straight to the organiser view. Share the session code with players so they can join at <strong>/join</strong>.
        </div>
      </div>
    </div>
  );
}