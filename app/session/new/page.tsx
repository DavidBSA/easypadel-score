"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

export default function NewSessionPage() {
  const router = useRouter();
  const [format, setFormat] = useState<"MIXED" | "TEAM">("MIXED");
  const [courts, setCourts] = useState(2);
  const [pointsPerMatch, setPointsPerMatch] = useState(21);
  const [slotMode, setSlotMode] = useState<"open" | "fixed">("open");
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const minPlayers = useMemo(() => courts * 4, [courts]);

  async function createSession() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          courts,
          pointsPerMatch,
          maxPlayers: slotMode === "fixed" ? Math.max(maxPlayers, minPlayers) : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Failed to create session."); setLoading(false); return; }

      const dr = await fetch(`/api/sessions/${data.code}/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserPin: data.organiserPin }),
      });
      const ddata = await dr.json();
      if (!dr.ok) { setError(ddata.error ?? "Failed to register device."); setLoading(false); return; }

      localStorage.setItem(`eps_join_${data.code}`, JSON.stringify({ deviceId: ddata.deviceId, isOrganiser: true }));
      localStorage.setItem(`eps_pin_${data.code}`, data.organiserPin);

      router.push(`/session/${data.code}/organiser`);
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 520, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", marginTop: 24 },
    titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    title: { fontSize: 22, fontWeight: 1000 },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4, lineHeight: 1.35 },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 20, marginBottom: 10 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "18px 0" },
    btn: { borderRadius: 14, padding: "12px 14px", fontSize: 14, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnPrimary: { width: "100%", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, marginTop: 20 },
    formatGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    settingsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    settingBox: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 },
    settingLabel: { fontSize: 12, opacity: 0.55, fontWeight: 900, marginBottom: 10 },
    stepper: { display: "flex", alignItems: "center", gap: 14 },
    stepBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 20, fontWeight: 1000, cursor: "pointer" },
    stepVal: { fontSize: 22, fontWeight: 1100, minWidth: 36, textAlign: "center" as const },
    slotGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    small: { fontSize: 12, opacity: 0.45, marginTop: 6, lineHeight: 1.35 },
    errorBox: { marginTop: 12, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    hint: { fontSize: 12, opacity: 0.55, marginTop: 10, lineHeight: 1.45, color: WARM_WHITE },
  };

  const formatCard = (active: boolean): React.CSSProperties => ({
    borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontWeight: 1000,
    border: `1px solid ${active ? "rgba(255,107,0,0.55)" : "rgba(255,255,255,0.08)"}`,
    background: active ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
  });

  const slotCard = (active: boolean): React.CSSProperties => ({
    borderRadius: 14, padding: 14, cursor: "pointer",
    border: `1px solid ${active ? "rgba(255,107,0,0.55)" : "rgba(255,255,255,0.08)"}`,
    background: active ? "rgba(255,107,0,0.08)" : "rgba(255,255,255,0.04)",
  });

  return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={st.titleRow}>
          <div>
            <div style={st.title}>Create Session</div>
            <div style={st.sub}>Multi-device · Live scoring</div>
          </div>
          <button style={st.btn} onClick={() => router.push("/")}>Home</button>
        </div>

        <div style={st.sectionLabel}>Format</div>
        <div style={st.formatGrid}>
          <div style={formatCard(format === "MIXED")} onClick={() => setFormat("MIXED")}>
            <div style={{ fontSize: 15 }}>Mixed Americano</div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>Rotating partners</div>
          </div>
          <div style={formatCard(format === "TEAM")} onClick={() => setFormat("TEAM")}>
            <div style={{ fontSize: 15 }}>Team Americano</div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>Fixed partners</div>
          </div>
        </div>

        <div style={st.divider} />

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
        <div style={st.small}>Minimum {minPlayers} players needed to start ({courts} court{courts > 1 ? "s" : ""} × 4)</div>

        <div style={st.divider} />

        <div style={st.sectionLabel}>Player slots</div>
        <div style={st.slotGrid}>
          <div style={slotCard(slotMode === "open")} onClick={() => setSlotMode("open")}>
            <div style={{ fontWeight: 1000, fontSize: 14 }}>Open</div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4, lineHeight: 1.35 }}>Anyone with the code can join until you lock entries</div>
          </div>
          <div style={slotCard(slotMode === "fixed")} onClick={() => setSlotMode("fixed")}>
            <div style={{ fontWeight: 1000, fontSize: 14 }}>Fixed slots</div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4, lineHeight: 1.35 }}>First come first served — closes when full</div>
          </div>
        </div>

        {slotMode === "fixed" && (
          <div style={{ ...st.settingBox, marginTop: 10 }}>
            <div style={st.settingLabel}>Max players</div>
            <div style={st.stepper}>
              <button style={st.stepBtn} onClick={() => setMaxPlayers((n) => Math.max(minPlayers, n - 1))}>−</button>
              <div style={st.stepVal}>{Math.max(maxPlayers, minPlayers)}</div>
              <button style={st.stepBtn} onClick={() => setMaxPlayers((n) => Math.min(64, n + 1))}>+</button>
            </div>
            <div style={{ ...st.small, marginTop: 8 }}>Min {minPlayers} · Max 64</div>
          </div>
        )}

        <div style={st.hint}>Players join at <strong>/join</strong> using the session code. You can also add them manually from the organiser view.</div>

        <button style={{ ...st.btnPrimary, opacity: loading ? 0.5 : 1 }} onClick={createSession} disabled={loading}>
          {loading ? "Creating…" : "Create Session"}
        </button>
        {error && <div style={st.errorBox}>{error}</div>}
      </div>
    </div>
  );
}