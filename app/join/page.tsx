"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

type SessionFormat = "SINGLE" | "MIXED" | "TEAM" | null;
type SessionStatus = "LOBBY" | "ACTIVE" | "COMPLETE" | null;

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams?.get("code")?.toUpperCase() ?? "");
  const [playerName, setPlayerName] = useState("");
  const [playerName2, setPlayerName2] = useState("");
  const [teamName, setTeamName] = useState("");
  const [sessionFormat, setSessionFormat] = useState<SessionFormat>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(null);
  const [formatLoading, setFormatLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) { setSessionFormat(null); setSessionStatus(null); return; }
    setFormatLoading(true);
    setError("");
    fetch(`/api/sessions/${c}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.format) setSessionFormat(data.format); else setSessionFormat(null);
        if (data?.status) setSessionStatus(data.status as SessionStatus); else setSessionStatus(null);
      })
      .catch(() => { setSessionFormat(null); setSessionStatus(null); })
      .finally(() => setFormatLoading(false));
  }, [code]);

  const isTeam = sessionFormat === "TEAM";
  const isLocked = sessionStatus === "ACTIVE" || sessionStatus === "COMPLETE";

  async function join() {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) { setError("Enter a 4-character session code."); return; }
    if (!playerName.trim()) { setError(isTeam ? "Enter Player 1's name to join." : "Enter your name to join."); return; }
    setLoading(true); setError(""); setIsFull(false);

    try {
      const body: Record<string, string> = { playerName: playerName.trim() };
      if (isTeam && playerName2.trim()) body.playerName2 = playerName2.trim();

      const r = await fetch(`/api/sessions/${c}/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();

      if (!r.ok) {
        if (data.error === "SESSION_FULL") setIsFull(true);
        setError(data.message ?? data.error ?? "Could not join session.");
        setLoading(false); return;
      }

      localStorage.setItem(`eps_join_${c}`, JSON.stringify({ deviceId: data.deviceId, isOrganiser: false }));
      if (data.playerId) {
        localStorage.setItem(`eps_player_${c}`, JSON.stringify({ id: data.playerId, name: data.playerName }));
      }

      router.push(`/session/${c}/player`);
    } catch {
      setError("Network error — check your connection.");
      setLoading(false);
    }
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
    lockedBox: { marginTop: 14, borderRadius: 14, padding: "14px 16px", background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.35)", display: "grid", gap: 8 },
    lockedTitle: { fontWeight: 1000, fontSize: 14, color: WHITE },
    lockedSub: { fontSize: 13, color: WARM_WHITE, opacity: 0.7, lineHeight: 1.5 },
    playerViewBtn: { marginTop: 4, width: "100%", borderRadius: 12, padding: "12px 16px", fontSize: 14, fontWeight: 1000, cursor: "pointer", border: `1px solid ${ORANGE}`, background: "rgba(255,107,0,0.12)", color: WHITE },
  };

  return (
    <div style={st.page}>
      <div style={st.card}>
        <button style={st.backBtn} onClick={() => router.push("/")}>← Back</button>
        <div style={st.title}>Join Session</div>
        <div style={st.sub}>
          Enter the code from your organiser{isTeam ? " and your team details." : " and your name."}
        </div>

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

        {/* ── Session locked warning ── */}
        {isLocked && !formatLoading && (
          <div style={st.lockedBox}>
            <div style={st.lockedTitle}>
              {sessionStatus === "COMPLETE" ? "🏆 Session complete" : "🔒 Session in progress"}
            </div>
            <div style={st.lockedSub}>
              {sessionStatus === "COMPLETE"
                ? "This session has finished. You can still view the player screen to see results."
                : "This session has already started. New players can't join — ask your organiser to add you manually from the organiser view."}
            </div>
            {sessionStatus === "ACTIVE" && (
              <div style={st.lockedSub}>
                Already registered? Go to the player view to claim your name.
              </div>
            )}
            <button
              style={st.playerViewBtn}
              onClick={() => router.push(`/session/${code.trim().toUpperCase()}/player`)}
            >
              Go to player view →
            </button>
          </div>
        )}

        {/* ── Join form — only shown when session is LOBBY or unknown ── */}
        {!isLocked && (
          <>
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
                {!playerName2.trim() && playerName.trim() && (
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
              {loading
                ? "Joining…"
                : isTeam
                  ? (playerName2.trim() ? "Join as a team" : "Join solo")
                  : "Join Session"}
            </button>

            {error && (
              <div style={{
                ...st.errorBox,
                background: isFull ? "rgba(255,180,0,0.10)" : "rgba(255,64,64,0.10)",
                border: `1px solid ${isFull ? "rgba(255,180,0,0.40)" : "rgba(255,64,64,0.30)"}`,
              }}>
                {isFull && <div style={{ fontSize: 18, marginBottom: 4 }}>🏟️</div>}
                {error}
              </div>
            )}
          </>
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