"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams?.get("code")?.toUpperCase() ?? "");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFull, setIsFull] = useState(false);

  async function join() {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) { setError("Enter a 4-character session code."); return; }
    if (!playerName.trim()) { setError("Enter your name to join."); return; }
    setLoading(true); setError(""); setIsFull(false);
    try {
      const r = await fetch(`/api/sessions/${c}/devices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.error === "SESSION_FULL") setIsFull(true);
        setError(data.message ?? data.error ?? "Could not join session.");
        setLoading(false); return;
      }
      localStorage.setItem(`eps_join_${c}`, JSON.stringify({ deviceId: data.deviceId, isOrganiser: false }));
      if (data.playerId) localStorage.setItem(`eps_player_${c}`, JSON.stringify({ id: data.playerId, name: data.playerName }));
      router.push(`/session/${c}/player`);
    } catch { setError("Network error — check your connection."); setLoading(false); }
  }

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 420, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 24, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", marginTop: 48 },
    backBtn: { background: "none", border: "none", color: WARM_WHITE, opacity: 0.6, cursor: "pointer", fontWeight: 900, fontSize: 14, padding: "0 0 12px 0" },
    title: { fontSize: 26, fontWeight: 1000, marginBottom: 6 },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, lineHeight: 1.4, marginBottom: 24 },
    label: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginBottom: 8 },
    codeInput: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "18px 14px", fontSize: 28, fontWeight: 1100, textAlign: "center" as const, outline: "none", letterSpacing: 8, textTransform: "uppercase" as const, boxSizing: "border-box" as const },
    nameInput: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "16px 14px", fontSize: 18, fontWeight: 900, outline: "none", boxSizing: "border-box" as const },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "18px 0" },
    primaryBtn: { width: "100%", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, marginTop: 20 },
    errorBox: { marginTop: 12, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13, color: WHITE },
    hint: { fontSize: 12, color: WARM_WHITE, opacity: 0.5, marginTop: 10, lineHeight: 1.4 },
  };

  return (
    <div style={st.page}>
      <div style={st.card}>
        <button style={st.backBtn} onClick={() => router.push("/")}>← Back</button>
        <div style={st.title}>Join Session</div>
        <div style={st.sub}>Enter the code from your organiser and your name.</div>

        <div style={st.label}>Session code</div>
        <input
          style={st.codeInput}
          value={code}
          maxLength={4}
          placeholder="XXXX"
          autoFocus
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") join(); }}
        />

        <div style={st.divider} />

        <div style={st.label}>Your name</div>
        <input
          style={st.nameInput}
          value={playerName}
          placeholder="e.g. Chris"
          maxLength={30}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") join(); }}
        />
        <div style={st.hint}>Your name will appear on the leaderboard and court assignments.</div>

        <button
          style={{ ...st.primaryBtn, opacity: loading ? 0.5 : 1 }}
          onClick={join}
          disabled={loading}
        >
          {loading ? "Joining…" : "Join Session"}
        </button>

        {error && (
          <div style={{ ...st.errorBox, background: isFull ? "rgba(255,180,0,0.10)" : "rgba(255,64,64,0.10)", border: `1px solid ${isFull ? "rgba(255,180,0,0.40)" : "rgba(255,64,64,0.30)"}` }}>
            {isFull && <div style={{ fontSize: 18, marginBottom: 4 }}>🏟️</div>}
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#000000" }} />}>
      <JoinForm />
    </Suspense>
  );
}