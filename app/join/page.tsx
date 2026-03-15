"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

type SessionFormat = "SINGLE" | "MIXED" | "TEAM" | null;

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams?.get("code")?.toUpperCase() ?? "");
  const [playerName, setPlayerName] = useState("");
  const [playerName2, setPlayerName2] = useState("");
  const [teamName, setTeamName] = useState("");
  const [sessionFormat, setSessionFormat] = useState<SessionFormat>(null);
  const [formatLoading, setFormatLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFull, setIsFull] = useState(false);

  // Fetch session format whenever code reaches 4 chars
  useEffect(() => {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) { setSessionFormat(null); return; }
    setFormatLoading(true);
    setError("");
    fetch(`/api/sessions/${c}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.format) setSessionFormat(data.format); else setSessionFormat(null); })
      .catch(() => setSessionFormat(null))
      .finally(() => setFormatLoading(false));
  }, [code]);

  const isTeam = sessionFormat === "TEAM";

  async function join() {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) { setError("Enter a 4-character session code."); return; }
    if (!playerName.trim()) { setError("Enter your name to join."); return; }
    setLoading(true); setError(""); setIsFull(false);

    try {
      // Register player 1 (the person holding the device)
      const r1 = await fetch(`/api/sessions/${c}/devices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });
      const data1 = await r1.json();
      if (!r1.ok) {
        if (data1.error === "SESSION_FULL") setIsFull(true);
        setError(data1.message ?? data1.error ?? "Could not join session.");
        setLoading(false); return;
      }
      localStorage.setItem(`eps_join_${c}`, JSON.stringify({ deviceId: data1.deviceId, isOrganiser: false }));
      if (data1.playerId) localStorage.setItem(`eps_player_${c}`, JSON.stringify({ id: data1.playerId, name: data1.playerName }));

      // If Team format and player 2 name was entered, register them too
      if (isTeam && playerName2.trim()) {
        const r2 = await fetch(`/api/sessions/${c}/devices`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName: playerName2.trim() }),
        });
        if (!r2.ok) {
          // Player 1 already added — still proceed to player view, just warn
          const d2 = await r2.json();
          console.warn("Could not add player 2:", d2.message ?? d2.error);
        }
      }

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
    teamNameInput: { width: "100%", background: "rgba(255,255,255,0.05)", color: WHITE, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 900, outline: "none", boxSizing: "border-box" as const },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "18px 0" },
    primaryBtn: { width: "100%", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, marginTop: 20 },
    errorBox: { marginTop: 12, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13, color: WHITE },
    hint: { fontSize: 12, color: WARM_WHITE, opacity: 0.5, marginTop: 10, lineHeight: 1.4 },
    formatPill: { display: "inline-block", borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 1000, background: "rgba(255,107,0,0.15)", border: "1px solid rgba(255,107,0,0.40)", color: ORANGE, marginBottom: 16 },
    teamCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, display: "grid", gap: 10, marginTop: 4 },
    soloNote: { marginTop: 12, borderRadius: 12, padding: "10px 14px", background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.22)", fontSize: 12, fontWeight: 900, color: WARM_WHITE, lineHeight: 1.5 },
  };

  return (
    <div style={st.page}>
      <div style={st.card}>
        <button style={st.backBtn} onClick={() => router.push("/")}>← Back</button>
        <div style={st.title}>Join Session</div>
        <div style={st.sub}>Enter the code from your organiser{isTeam ? " and your team details." : " and your name."}</div>

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

        {formatLoading && <div style={{ ...st.hint, marginTop: 10 }}>Looking up session…</div>}
        {sessionFormat && !formatLoading && (
          <div style={{ marginTop: 10 }}>
            <span style={st.formatPill}>
              {sessionFormat === "TEAM" ? "Team Americano" : sessionFormat === "MIXED" ? "Mixed Americano" : "Single Match"}
            </span>
          </div>
        )}

        <div style={st.divider} />

        {isTeam ? (
          <>
            <div style={st.label}>Your team</div>
            <div style={st.teamCard}>
              <div style={{ fontSize: 12, fontWeight: 1000, opacity: 0.5 }}>Team name (optional)</div>
              <input
                style={st.teamNameInput}
                value={teamName}
                placeholder="e.g. The Smashers"
                maxLength={30}
                onChange={(e) => setTeamName(e.target.value)}
              />
              <input
                style={st.nameInput}
                value={playerName}
                placeholder="Player 1 name *"
                maxLength={30}
                onChange={(e) => setPlayerName(e.target.value)}
              />
              <input
                style={st.nameInput}
                value={playerName2}
                placeholder="Player 2 name (optional)"
                maxLength={30}
                onChange={(e) => setPlayerName2(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") join(); }}
              />
            </div>
            {!playerName2.trim() && (
              <div style={st.soloNote}>
                No partner? Enter your name only — you'll be paired with another solo player, or held as a reserve if none are waiting.
              </div>
            )}
          </>
        ) : (
          <>
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
          </>
        )}

        <button
          style={{ ...st.primaryBtn, opacity: loading ? 0.5 : 1 }}
          onClick={join}
          disabled={loading}
        >
          {loading ? "Joining…" : isTeam ? (playerName2.trim() ? "Join as a team" : "Join solo") : "Join Session"}
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