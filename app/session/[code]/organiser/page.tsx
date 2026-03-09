"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";
const GREEN = "#00C851";
const RED = "#FF4040";

type Player = { id: string; name: string; isActive: boolean };
type ScoreSubmission = { id: string; deviceId: string; pointsA: number; pointsB: number; submittedAt: string };
type Match = {
  id: string; queuePosition: number; courtNumber: number | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE";
  teamAPlayer1: string; teamAPlayer2: string;
  teamBPlayer1: string; teamBPlayer2: string;
  pointsA: number | null; pointsB: number | null;
  scoreStatus: "PENDING" | "CONFIRMED" | "CONFLICT" | null;
  scoreSubmissions: ScoreSubmission[];
  startedAt: string | null; completedAt: string | null;
};
type Session = {
  id: string; code: string; format: string;
  status: "LOBBY" | "ACTIVE" | "COMPLETE";
  courts: number; pointsPerMatch: number; maxPlayers: number | null;
  players: Player[]; matches: Match[];
};
type LeaderRow = {
  playerId: string; name: string;
  played: number; wins: number; draws: number; losses: number;
  pointsFor: number; pointsAgainst: number; diff: number;
};

// courtScores: pA is null = untouched, number = organiser has set a value
type CourtScore = { pA: number | null };

function pill(label: string, bg: string, border: string, onClick?: () => void): React.ReactNode {
  return (
    <span onClick={onClick} style={{
      display: "inline-block", borderRadius: 999, padding: "4px 10px",
      fontSize: 11, fontWeight: 1000, background: bg, border: `1px solid ${border}`, color: WHITE,
      cursor: onClick ? "pointer" : "default",
    }}>
      {label}
    </span>
  );
}

export default function OrganiserPage() {
  const params = useParams();
  const code = (Array.isArray(params?.code) ? params.code[0] : params?.code ?? "") as string;
  const router = useRouter();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">("idle");
  const [shareQRStatus, setShareQRStatus] = useState<"idle" | "loading" | "shared" | "copied">("idle");
  const [showQR, setShowQR] = useState(false);

  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState("");

  const [resolving, setResolving] = useState<Record<string, { pA: number; pB: number }>>({});
  const [resolveLoading, setResolveLoading] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState<string | null>(null);

  // pA: null = untouched (submit disabled), number = organiser entered a value
  const [courtScores, setCourtScores] = useState<Record<string, CourtScore>>({});
  const [submitLoading, setSubmitLoading] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!code) return;
    try {
      const stored = localStorage.getItem(`eps_join_${code}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.isOrganiser && parsed.deviceId) setDeviceId(parsed.deviceId);
      }
    } catch { /* ignore */ }
    setBootstrapped(true);
  }, [code]);

  const applySession = useCallback((data: Session) => {
    setSession(data);
    setResolving((prev) => {
      const next = { ...prev };
      for (const m of data.matches) {
        if (m.scoreStatus === "CONFLICT" && !(m.id in next)) {
          next[m.id] = { pA: m.pointsA ?? 0, pB: m.pointsB ?? 0 };
        }
      }
      return next;
    });
    // Only initialise court score entry for newly active matches (don't overwrite existing entries)
    setCourtScores((prev) => {
      const next = { ...prev };
      for (const m of data.matches) {
        if (m.status === "IN_PROGRESS" && !(m.id in next)) {
          next[m.id] = { pA: null }; // null = untouched
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!deviceId || !code) return;
    fetch(`/api/sessions/${code}`)
      .then((r) => r.json()).then(applySession)
      .catch(() => setSessionError("Failed to load session."));
    const es = new EventSource(`/api/sessions/${code}/stream`);
    esRef.current = es;
    es.onmessage = (e) => { try { applySession(JSON.parse(e.data)); } catch { /* ignore */ } };
    es.onerror = () => {
      es.close();
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          fetch(`/api/sessions/${code}`).then((r) => r.json()).then(applySession).catch(() => { });
        }, 3000);
      }
    };
    return () => {
      es.close();
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [deviceId, code, applySession]);

  async function claimOrganiser() {
    if (!pinInput.trim()) { setPinError("Enter the organiser PIN."); return; }
    setPinLoading(true); setPinError("");
    try {
      const r = await fetch(`/api/sessions/${code}/devices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserPin: pinInput.trim() }),
      });
      const data = await r.json();
      if (!r.ok || !data.isOrganiser) { setPinError("Incorrect PIN."); setPinLoading(false); return; }
      localStorage.setItem(`eps_join_${code}`, JSON.stringify({ deviceId: data.deviceId, isOrganiser: true }));
      setDeviceId(data.deviceId);
    } catch { setPinError("Network error."); }
    setPinLoading(false);
  }

  async function addPlayerManually() {
    const name = addName.trim();
    if (!name || !deviceId) return;
    setAddLoading(true); setAddError("");
    try {
      const r = await fetch(`/api/sessions/${code}/players`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, playerName: name }),
      });
      const data = await r.json();
      if (!r.ok) { setAddError(data.message ?? data.error ?? "Could not add player."); setAddLoading(false); return; }
      setAddName("");
    } catch { setAddError("Network error."); }
    setAddLoading(false);
  }

  async function lockAndStart() {
    if (!deviceId) return;
    setStartLoading(true); setStartError("");
    try {
      const r = await fetch(`/api/sessions/${code}/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await r.json();
      if (!r.ok) { setStartError(data.error ?? "Could not start session."); setStartLoading(false); return; }
    } catch { setStartError("Network error."); }
    setStartLoading(false);
  }

  async function startMatch(matchId: string, courtNumber: number) {
    if (!deviceId) return;
    await fetch(`/api/matches/${matchId}/start`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courtNumber, deviceId }),
    });
  }

  async function confirmScore(matchId: string) {
    if (!deviceId) return;
    setConfirmLoading(matchId);
    try {
      await fetch(`/api/matches/${matchId}/score`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, isOrganiserConfirm: true }),
      });
    } finally { setConfirmLoading(null); }
  }

  async function resolveConflict(matchId: string) {
    if (!deviceId) return;
    const { pA, pB } = resolving[matchId] ?? { pA: 0, pB: 0 };
    setResolveLoading(matchId);
    try {
      await fetch(`/api/matches/${matchId}/score`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, pointsA: pA, pointsB: pB, isOrganiserOverride: true }),
      });
    } finally { setResolveLoading(null); }
  }

  async function submitCourtScore(matchId: string, ppm: number) {
    if (!deviceId) return;
    const cs = courtScores[matchId];
    if (cs?.pA === null || cs?.pA === undefined) return;
    const pA = cs.pA;
    const pB = ppm - pA;
    setSubmitLoading(matchId);
    try {
      await fetch(`/api/matches/${matchId}/score`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, pointsA: pA, pointsB: pB, isOrganiserOverride: true }),
      });
      // Reset entry state after submit
      setCourtScores((prev) => ({ ...prev, [matchId]: { pA: null } }));
    } finally { setSubmitLoading(null); }
  }

  function adjustCourtScore(matchId: string, delta: number, ppm: number) {
    setCourtScores((prev) => {
      const current = prev[matchId]?.pA ?? 0;
      const next = Math.max(0, Math.min(ppm, current + delta));
      return { ...prev, [matchId]: { pA: next } };
    });
  }

  // ── Share helpers ──────────────────────────────────────────────────────────
  function getJoinUrl() {
    return typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : `/join?code=${code}`;
  }

  async function shareLink() {
    const url = getJoinUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join my padel session", text: `Join my EasyPadelScore session — code: ${code}`, url });
        setShareStatus("shared"); setTimeout(() => setShareStatus("idle"), 2500); return;
      } catch (err: unknown) { if (err instanceof Error && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); setShareStatus("copied"); setTimeout(() => setShareStatus("idle"), 2500); } catch { /* ignore */ }
  }

  async function shareQR() {
    const url = getJoinUrl();
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&bgcolor=0D1B2A&color=FFFFFF&margin=16`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        setShareQRStatus("loading");
        const resp = await fetch(qrUrl);
        const blob = await resp.blob();
        const file = new File([blob], `EasyPadelScore-${code}.png`, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: "Join my padel session", text: `Scan to join session ${code}`, files: [file] });
          setShareQRStatus("shared"); setTimeout(() => setShareQRStatus("idle"), 2500); return;
        }
      } catch (err: unknown) { if (err instanceof Error && err.name === "AbortError") { setShareQRStatus("idle"); return; } }
      try {
        await navigator.share({ title: "Join my padel session", text: `Scan to join session ${code}`, url: qrUrl });
        setShareQRStatus("shared"); setTimeout(() => setShareQRStatus("idle"), 2500); return;
      } catch (err: unknown) { if (err instanceof Error && err.name === "AbortError") { setShareQRStatus("idle"); return; } }
    }
    try { await navigator.clipboard.writeText(url); setShareQRStatus("copied"); setTimeout(() => setShareQRStatus("idle"), 2500); } catch { setShareQRStatus("idle"); }
  }

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 720, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", marginTop: 12 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" as const },
    title: { fontSize: 22, fontWeight: 1000 },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 0" },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 16, marginBottom: 10 },
    btn: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnOrange: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, whiteSpace: "nowrap" as const },
    btnGreen: { borderRadius: 14, padding: "14px 20px", fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: GREEN, color: WHITE, whiteSpace: "nowrap" as const },
    btnConfirm: { borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", background: GREEN, color: WHITE, whiteSpace: "nowrap" as const, marginTop: 10, width: "100%" },
    courtCard: { borderRadius: 16, padding: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 },
    conflictCard: { borderRadius: 16, padding: 14, background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.3)", marginBottom: 10 },
    queueCard: { borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 10 },
    stepBtn: { width: 44, height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.09)", color: WHITE, fontSize: 22, fontWeight: 1000, cursor: "pointer", flexShrink: 0 },
    val: { fontSize: 22, fontWeight: 1100, minWidth: 32, textAlign: "center" as const },
    names: { fontWeight: 900, fontSize: 14, lineHeight: 1.4 },
    pinInput: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "14px 12px", fontSize: 20, fontWeight: 900, textAlign: "center" as const, outline: "none", boxSizing: "border-box" as const },
    errorBox: { marginTop: 10, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    pillsRow: { display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 12 },
    shareCard: { marginTop: 12, borderRadius: 16, padding: 14, background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.22)" },
    shareTop: { display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" as const },
    codeBlock: { fontSize: 28, fontWeight: 1150, color: ORANGE, letterSpacing: 4, lineHeight: 1 },
    shareButtons: { display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" },
    btnShare: { borderRadius: 14, padding: "11px 16px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, whiteSpace: "nowrap" as const },
    btnShareSecondary: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    qrWrap: { marginTop: 12, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 10 },
    addRow: { display: "flex", gap: 10, alignItems: "center" },
    addInput: { flex: 1, background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 900, outline: "none" },
    playerPill: { borderRadius: 12, padding: "8px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 14, fontWeight: 900, color: WHITE },
    lobbyCard: { borderRadius: 18, padding: 18, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" },
    startSection: { marginTop: 16, borderRadius: 16, padding: 16, background: "rgba(0,200,80,0.06)", border: "1px solid rgba(0,200,80,0.20)", display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const },
    lbWrap: { marginTop: 4, borderRadius: 18, padding: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8 },
    lbHead: { display: "grid", gridTemplateColumns: "40px 1fr 90px 110px 64px", gap: 8, fontSize: 11, opacity: 0.5, fontWeight: 950, padding: "0 10px", textTransform: "uppercase" as const, letterSpacing: 0.5 },
    lbRow: { display: "grid", gridTemplateColumns: "40px 1fr 90px 110px 64px", gap: 8, alignItems: "center", borderRadius: 12, padding: "10px 10px" },
    lbRight: { textAlign: "right" as const },
    lbCenter: { textAlign: "center" as const },
    hint: { fontSize: 12, opacity: 0.55, color: WARM_WHITE, lineHeight: 1.4 },
  };

  if (!bootstrapped) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading…</div></div></div>;

  if (!deviceId) {
    return (
      <div style={st.page}>
        <div style={{ ...st.card, maxWidth: 420, marginTop: 60 }}>
          <button style={st.btn} onClick={() => router.push("/")}>← Back</button>
          <div style={{ ...st.title, marginTop: 14 }}>Organiser Access</div>
          <div style={{ ...st.sub, marginBottom: 20 }}>Enter the organiser PIN for session <strong style={{ color: ORANGE }}>{code}</strong>.</div>
          <input style={st.pinInput} value={pinInput} type="password" placeholder="PIN" maxLength={8} autoFocus
            onChange={(e) => setPinInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") claimOrganiser(); }} />
          <button style={{ ...st.btnOrange, width: "100%", marginTop: 14, padding: 16, fontSize: 15, opacity: pinLoading ? 0.5 : 1 }}
            onClick={claimOrganiser} disabled={pinLoading}>
            {pinLoading ? "Verifying…" : "Access organiser view"}
          </button>
          {pinError && <div style={st.errorBox}>{pinError}</div>}
        </div>
      </div>
    );
  }

  if (!session) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading session…{sessionError && ` — ${sessionError}`}</div></div></div>;

  const nameById = session.players.reduce<Record<string, string>>((m, p) => { m[p.id] = p.name; return m; }, {});
  function names(m: Match) {
    return { a1: nameById[m.teamAPlayer1] ?? "?", a2: nameById[m.teamAPlayer2] ?? "?", b1: nameById[m.teamBPlayer1] ?? "?", b2: nameById[m.teamBPlayer2] ?? "?" };
  }

  const minPlayers = session.courts * 4;
  const canStart = session.players.length >= minPlayers;
  const canWebShare = typeof navigator !== "undefined" && !!navigator.share;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getJoinUrl())}&bgcolor=0D1B2A&color=FFFFFF&margin=10`;

  const shareLinkLabel = shareStatus === "shared" ? "✓ Shared!" : shareStatus === "copied" ? "✓ Copied!" : "⬆ Share link";
  const shareQRLabel = shareQRStatus === "loading" ? "Loading…" : shareQRStatus === "shared" ? "✓ Shared!" : shareQRStatus === "copied" ? "✓ Link copied" : "Share QR";

  // Share card shown in LOBBY only — hidden once session is ACTIVE
  const shareCard = session.status === "LOBBY" ? (
    <div style={st.shareCard}>
      <div style={st.shareTop}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, fontWeight: 1000, opacity: 0.5, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 6 }}>Session code</div>
          <div style={st.codeBlock}>{code}</div>
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>Players join at <strong>/join</strong></div>
        </div>
        <div style={st.shareButtons}>
          <button style={{ ...st.btnShare, background: shareStatus !== "idle" ? "rgba(0,200,80,0.85)" : ORANGE }} onClick={shareLink}>
            {canWebShare ? "⬆" : "📋"} {shareLinkLabel}
          </button>
          <button style={{ ...st.btnShareSecondary, borderColor: showQR ? "rgba(255,107,0,0.45)" : "rgba(255,255,255,0.20)", background: showQR ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.07)" }} onClick={() => setShowQR((v) => !v)}>
            QR {showQR ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {showQR && (
        <div style={st.qrWrap}>
          <img src={qrUrl} alt={`Join ${code}`} width={160} height={160} style={{ borderRadius: 14, display: "block" }} />
          <button style={{ ...st.btnShareSecondary, background: shareQRStatus !== "idle" ? "rgba(0,200,80,0.15)" : "rgba(255,255,255,0.07)", borderColor: shareQRStatus !== "idle" ? "rgba(0,200,80,0.45)" : "rgba(255,255,255,0.20)", opacity: shareQRStatus === "loading" ? 0.6 : 1 }}
            onClick={shareQR} disabled={shareQRStatus === "loading"}>
            {canWebShare ? "⬆" : "📋"} {shareQRLabel}
          </button>
          <div style={st.hint}>Scan to join on any phone</div>
        </div>
      )}
    </div>
  ) : null;

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (session.status === "LOBBY") {
    return (
      <div style={st.page}>
        <div style={st.card}>
          <div style={st.row}>
            <div>
              <div style={st.title}>Organiser · {code}</div>
              <div style={st.sub}>{session.format} · {session.courts} court{session.courts > 1 ? "s" : ""} · {session.pointsPerMatch} pts · Waiting for players</div>
            </div>
            <button style={st.btn} onClick={() => router.push("/")}>Home</button>
          </div>
          <div style={st.pillsRow}>
            {pill(`${session.players.length} joined`, "rgba(255,107,0,0.18)", "rgba(255,107,0,0.45)")}
            {pill(`${minPlayers} needed to start`, "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)")}
            {session.maxPlayers !== null && pill(`${session.maxPlayers} max`, "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)")}
          </div>
          {shareCard}
          <div style={st.divider} />
          <div style={st.sectionLabel}>Players — {session.players.length}{session.maxPlayers !== null ? ` / ${session.maxPlayers}` : ""}</div>
          <div style={st.lobbyCard}>
            {session.players.length === 0 ? (
              <div style={st.hint}>No players yet — share the code above.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                {session.players.map((p) => <div key={p.id} style={st.playerPill}>{p.name}</div>)}
              </div>
            )}
          </div>
          <div style={st.sectionLabel}>Add player manually</div>
          <div style={st.addRow}>
            <input style={st.addInput} value={addName} placeholder="Player name" maxLength={30}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addPlayerManually(); }} />
            <button style={{ ...st.btnOrange, opacity: addLoading ? 0.5 : 1 }} onClick={addPlayerManually} disabled={addLoading}>
              {addLoading ? "Adding…" : "Add"}
            </button>
          </div>
          {addError && <div style={st.errorBox}>{addError}</div>}
          <div style={st.startSection}>
            <div>
              <div style={{ fontWeight: 1000, fontSize: 15 }}>
                {canStart ? "Ready to start!" : `Need ${minPlayers - session.players.length} more player${minPlayers - session.players.length !== 1 ? "s" : ""}`}
              </div>
              <div style={st.hint}>Locking entries generates the full match queue.</div>
            </div>
            <button style={{ ...st.btnGreen, opacity: canStart && !startLoading ? 1 : 0.4 }} onClick={lockAndStart} disabled={!canStart || startLoading}>
              {startLoading ? "Starting…" : "Lock & Start →"}
            </button>
          </div>
          {startError && <div style={st.errorBox}>{startError}</div>}
        </div>
      </div>
    );
  }

  // ── ACTIVE / COMPLETE ──────────────────────────────────────────────────────
  const ppm = session.pointsPerMatch;
  const inProgress = session.matches.filter((m) => m.status === "IN_PROGRESS");
  const conflicts = session.matches.filter((m) => m.scoreStatus === "CONFLICT");
  const pending = session.matches.filter((m) => m.status === "PENDING");
  const complete = session.matches.filter((m) => m.status === "COMPLETE");
  const courtNumbers = Array.from({ length: session.courts }, (_, i) => i + 1);

  const leaderboard: LeaderRow[] = (() => {
    const base = new Map<string, LeaderRow>();
    for (const p of session.players) base.set(p.id, { playerId: p.id, name: p.name, played: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 });
    for (const m of complete) {
      const pA = m.pointsA ?? 0; const pB = m.pointsB ?? 0;
      for (const pid of [m.teamAPlayer1, m.teamAPlayer2]) {
        const r = base.get(pid);
        if (r) { r.played++; r.pointsFor += pA; r.pointsAgainst += pB; if (pA > pB) r.wins++; else if (pA === pB) r.draws++; else r.losses++; }
      }
      for (const pid of [m.teamBPlayer1, m.teamBPlayer2]) {
        const r = base.get(pid);
        if (r) { r.played++; r.pointsFor += pB; r.pointsAgainst += pA; if (pB > pA) r.wins++; else if (pB === pA) r.draws++; else r.losses++; }
      }
    }
    return Array.from(base.values()).map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst })).sort((a, b) => b.diff !== a.diff ? b.diff - a.diff : b.pointsFor !== a.pointsFor ? b.pointsFor - a.pointsFor : a.name.localeCompare(b.name));
  })();

  return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={st.row}>
          <div>
            <div style={st.title}>Organiser · {code}</div>
            <div style={st.sub}>{session.format} · {session.players.length} players · {session.courts} courts · {ppm} pts</div>
          </div>
          <button style={st.btn} onClick={() => router.push("/")}>Home</button>
        </div>

        <div style={st.pillsRow}>
          {pill(`${inProgress.length} playing`, "rgba(255,107,0,0.18)", "rgba(255,107,0,0.45)")}
          {pill(`${pending.length} queued`, "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)")}
          {pill(`${complete.length} done`, "rgba(0,200,80,0.12)", "rgba(0,200,80,0.35)", complete.length > 0 ? () => router.push(`/session/${code}/organiser/results`) : undefined)}
          {conflicts.length > 0 && pill(`⚠ ${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""}`, "rgba(255,64,64,0.15)", "rgba(255,64,64,0.4)")}
        </div>
        {complete.length > 0 && <div style={{ ...st.hint, marginTop: 6 }}>Tap <strong style={{ color: GREEN }}>{complete.length} done</strong> to view and edit confirmed match scores.</div>}

        <div style={st.divider} />

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <>
            <div style={st.sectionLabel}>⚠ Conflicts — enter correct score</div>
            {conflicts.map((m) => {
              const { a1, a2, b1, b2 } = names(m);
              const rv = resolving[m.id] ?? { pA: m.pointsA ?? 0, pB: m.pointsB ?? 0 };
              const updateRv = (patch: Partial<{ pA: number; pB: number }>) =>
                setResolving((prev) => ({ ...prev, [m.id]: { ...rv, ...patch } }));
              return (
                <div key={m.id} style={st.conflictCard}>
                  <div style={st.names}>Court {m.courtNumber} · {a1} & {a2} <span style={{ opacity: 0.5 }}>vs</span> {b1} & {b2}</div>
                  <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>Submitted: {m.scoreSubmissions.map((s) => `${s.pointsA}–${s.pointsB}`).join(" · ")}</div>
                  <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 13, opacity: 0.7, minWidth: 60 }}>Team A:</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pA: Math.max(0, rv.pA - 1) })}>−</button>
                    <span style={st.val}>{rv.pA}</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pA: rv.pA + 1 })}>+</button>
                    <span style={{ fontSize: 13, opacity: 0.7, minWidth: 60, marginLeft: 8 }}>Team B:</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pB: Math.max(0, rv.pB - 1) })}>−</button>
                    <span style={st.val}>{rv.pB}</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pB: rv.pB + 1 })}>+</button>
                    <button style={{ ...st.btnOrange, opacity: resolveLoading === m.id ? 0.5 : 1 }} onClick={() => resolveConflict(m.id)} disabled={resolveLoading === m.id}>
                      {resolveLoading === m.id ? "Saving…" : "Confirm score"}
                    </button>
                  </div>
                </div>
              );
            })}
            <div style={st.divider} />
          </>
        )}

        {/* Courts */}
        <div style={st.sectionLabel}>Courts</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: session.courts >= 2 ? "repeat(2, minmax(0,1fr))" : "1fr" }}>
          {courtNumbers.map((cn) => {
            const m = inProgress.find((x) => x.courtNumber === cn);
            if (!m) return (
              <div key={cn} style={{ ...st.courtCard, opacity: 0.45 }}>
                <div style={{ fontWeight: 1000, fontSize: 15, color: ORANGE }}>Court {cn}</div>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Open — no active match</div>
              </div>
            );

            const { a1, a2, b1, b2 } = names(m);
            const isPending = m.scoreStatus === "PENDING";
            const isConfirmed = m.scoreStatus === "CONFIRMED";
            const isConflict = m.scoreStatus === "CONFLICT";
            const sColor = isConflict ? RED : isConfirmed ? GREEN : isPending ? ORANGE : WARM_WHITE;
            const sLabel = isConflict ? "⚠ Conflict" : isConfirmed ? "✓ Confirmed" : isPending ? "⏳ Awaiting confirmation" : "In play";

            // Score entry state
            const cs = courtScores[m.id] ?? { pA: null };
            const entryA = cs.pA; // null = untouched
            const entryB = entryA !== null ? ppm - entryA : null;
            const canSubmit = entryA !== null && !isPending && !isConfirmed && !isConflict;
            const showEntry = !isPending && !isConfirmed && !isConflict;

            // Confirmed/submitted score to display at top of card
            const displayA = m.pointsA;
            const displayB = m.pointsB;
            const hasSubmittedScore = displayA !== null && displayB !== null;

            return (
              <div key={cn} style={{ ...st.courtCard, borderColor: isPending ? "rgba(255,107,0,0.35)" : isConflict ? "rgba(255,64,64,0.35)" : "rgba(255,107,0,0.2)" }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 1000, fontSize: 15, color: ORANGE }}>Court {cn}</div>
                  <span style={{ fontSize: 11, fontWeight: 1000, color: sColor }}>{sLabel}</span>
                </div>

                {/* Team names + score display (only show if score already submitted) */}
                {hasSubmittedScore ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 1000, fontSize: 13, opacity: 0.7, marginBottom: 2 }}>Team A</div>
                      <div style={{ fontWeight: 950, fontSize: 13 }}>{a1} & {a2}</div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ fontSize: 30, fontWeight: 1150, letterSpacing: 1 }}>
                        <span style={{ color: displayA! > displayB! ? GREEN : displayA! < displayB! ? RED : WHITE }}>{displayA}</span>
                        <span style={{ opacity: 0.3, margin: "0 6px" }}>–</span>
                        <span style={{ color: displayB! > displayA! ? GREEN : displayB! < displayA! ? RED : WHITE }}>{displayB}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontWeight: 1000, fontSize: 13, opacity: 0.7, marginBottom: 2 }}>Team B</div>
                      <div style={{ fontWeight: 950, fontSize: 13 }}>{b1} & {b2}</div>
                    </div>
                  </div>
                ) : (
                  /* No score yet — just show team names */
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 4 }}>{a1} & {a2}</div>
                    <div style={{ fontWeight: 950, fontSize: 13 }}>{b1} & {b2}</div>
                  </div>
                )}

                {/* Score entry — single stepper for Team A, Team B auto-calculates */}
                {showEntry && (
                  <div style={{ borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>

                    {/* Team A stepper */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 1000, flex: 1 }}>{a1} & {a2}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button style={{ ...st.stepBtn, opacity: entryA === null || entryA === 0 ? 0.35 : 1 }}
                          onClick={() => adjustCourtScore(m.id, -1, ppm)} disabled={entryA === null || entryA === 0}>−</button>
                        <span style={{ fontSize: 28, fontWeight: 1150, minWidth: 36, textAlign: "center" as const, color: entryA === null ? "rgba(255,255,255,0.25)" : WHITE }}>
                          {entryA === null ? "—" : entryA}
                        </span>
                        <button style={{ ...st.stepBtn, opacity: entryA !== null && entryA >= ppm ? 0.35 : 1 }}
                          onClick={() => adjustCourtScore(m.id, +1, ppm)} disabled={entryA !== null && entryA >= ppm}>+</button>
                      </div>
                    </div>

                    {/* Team B — auto-calculated */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ fontSize: 13, fontWeight: 1000, flex: 1, opacity: 0.7 }}>{b1} & {b2}</div>
                      <div style={{ fontSize: 28, fontWeight: 1150, minWidth: 36, textAlign: "center" as const, color: entryB === null ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", paddingRight: 4 }}>
                        {entryB === null ? "—" : entryB}
                      </div>
                    </div>

                    {entryA === null && (
                      <div style={{ fontSize: 12, opacity: 0.45, marginTop: 8, textAlign: "center" as const }}>Tap + to enter {a1} & {a2}'s score</div>
                    )}

                    {/* Submit */}
                    <button
                      style={{ marginTop: 12, width: "100%", borderRadius: 12, padding: "13px 16px", fontSize: 14, fontWeight: 1000, cursor: canSubmit ? "pointer" : "default", border: "none", background: canSubmit ? ORANGE : "rgba(255,255,255,0.1)", color: canSubmit ? WHITE : "rgba(255,255,255,0.3)", transition: "all 0.15s" }}
                      onClick={() => submitCourtScore(m.id, ppm)}
                      disabled={!canSubmit || submitLoading === m.id}
                    >
                      {submitLoading === m.id ? "Submitting…" : canSubmit ? `Submit  ${entryA} – ${entryB}` : "Enter score above"}
                    </button>
                  </div>
                )}

                {/* Confirm button when player score is awaiting organiser confirm */}
                {isPending && (
                  <button style={{ ...st.btnConfirm, opacity: confirmLoading === m.id ? 0.5 : 1 }}
                    onClick={() => confirmScore(m.id)} disabled={confirmLoading === m.id}>
                    {confirmLoading === m.id ? "Confirming…" : `✓ Confirm ${displayA}–${displayB}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Queue */}
        {pending.length > 0 && (
          <>
            <div style={st.sectionLabel}>Queue — {pending.length} match{pending.length !== 1 ? "es" : ""} waiting</div>
            {pending.map((m) => {
              const { a1, a2, b1, b2 } = names(m);
              return (
                <div key={m.id} style={st.queueCard}>
                  <div style={st.names}>{a1} & {a2} <span style={{ opacity: 0.4 }}>vs</span> {b1} & {b2}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" as const }}>
                    {courtNumbers.map((cn) => {
                      const busy = inProgress.some((x) => x.courtNumber === cn);
                      return (
                        <button key={cn} style={{ ...st.btn, opacity: busy ? 0.3 : 1 }}
                          onClick={() => { if (!busy) startMatch(m.id, cn); }} disabled={busy}>
                          Start on Court {cn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {pending.length === 0 && inProgress.length === 0 && complete.length > 0 && (
          <div style={{ opacity: 0.55, fontWeight: 900, padding: "16px 0", textAlign: "center" as const }}>All {complete.length} matches complete 🏆</div>
        )}

        <div style={st.divider} />

        {/* Leaderboard */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const }}>Leaderboard</div>
          {complete.length > 0 && (
            <button style={{ borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(0,200,80,0.35)", background: "rgba(0,200,80,0.08)", color: GREEN, whiteSpace: "nowrap" as const }}
              onClick={() => router.push(`/session/${code}/organiser/results`)}>
              View all results →
            </button>
          )}
        </div>
        <div style={st.lbWrap}>
          <div style={st.lbHead}>
            <div style={st.lbCenter}>Rank</div><div>Player</div>
            <div style={st.lbCenter}>W / D / L</div>
            <div style={st.lbRight}>Points</div>
            <div style={st.lbRight}>Diff</div>
          </div>
          {leaderboard.map((r, idx) => {
            const isTop3 = idx < 3 && r.played > 0;
            return (
              <div key={r.playerId} style={{ ...st.lbRow, background: isTop3 ? "rgba(255,107,0,0.10)" : "rgba(255,255,255,0.04)", border: `1px solid ${isTop3 ? "rgba(255,107,0,0.30)" : "rgba(255,255,255,0.07)"}` }}>
                <div style={{ fontSize: 15, fontWeight: 1100, textAlign: "center" as const, color: idx === 0 && r.played > 0 ? ORANGE : WHITE }}>{idx + 1}</div>
                <div style={{ fontWeight: 950, fontSize: 14 }}>{r.name}</div>
                <div style={{ ...st.lbCenter, fontSize: 13, fontWeight: 1000 }}>
                  <span style={{ color: GREEN }}>{r.wins}</span><span style={{ opacity: 0.35, margin: "0 3px" }}>/</span>
                  <span style={{ color: WHITE }}>{r.draws}</span><span style={{ opacity: 0.35, margin: "0 3px" }}>/</span>
                  <span style={{ color: RED }}>{r.losses}</span>
                </div>
                <div style={{ ...st.lbRight, fontSize: 13, fontWeight: 1000 }}>{r.pointsFor} – {r.pointsAgainst}</div>
                <div style={{ ...st.lbRight, fontSize: 13, fontWeight: 1100, color: r.diff > 0 ? GREEN : r.diff < 0 ? RED : WHITE }}>{r.diff > 0 ? `+${r.diff}` : r.diff}</div>
              </div>
            );
          })}
          {complete.length === 0 && <div style={st.hint}>No completed matches yet.</div>}
        </div>
      </div>
    </div>
  );
}