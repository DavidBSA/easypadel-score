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
  id: string;
  queuePosition: number;
  courtNumber: number | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE";
  teamAPlayer1: string; teamAPlayer2: string;
  teamBPlayer1: string; teamBPlayer2: string;
  pointsA: number | null; pointsB: number | null;
  scoreStatus: "PENDING" | "CONFIRMED" | "CONFLICT" | null;
  scoreSubmissions: ScoreSubmission[];
  startedAt: string | null; completedAt: string | null;
};
type Session = {
  id: string; code: string; format: string; status: string;
  courts: number; pointsPerMatch: number;
  players: Player[]; matches: Match[];
};

function pill(label: string, bg: string, border: string): React.ReactNode {
  return (
    <span style={{ display: "inline-block", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 1000, background: bg, border: `1px solid ${border}`, color: WHITE }}>
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

  // Conflict resolve: matchId → { pA, pB }
  const [resolving, setResolving] = useState<Record<string, { pA: number; pB: number }>>({});
  const [resolveLoading, setResolveLoading] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bootstrap: read deviceId from localStorage
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
    // Seed resolving state for new conflicts
    setResolving((prev) => {
      const next = { ...prev };
      for (const m of data.matches) {
        if (m.scoreStatus === "CONFLICT" && !(m.id in next)) {
          next[m.id] = { pA: m.pointsA ?? 0, pB: m.pointsB ?? 0 };
        }
      }
      return next;
    });
  }, []);

  // Start live updates once we have a deviceId
  useEffect(() => {
    if (!deviceId || !code) return;

    fetch(`/api/sessions/${code}`)
      .then((r) => r.json())
      .then(applySession)
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserPin: pinInput.trim() }),
      });
      const data = await r.json();
      if (!r.ok || !data.isOrganiser) { setPinError("Incorrect PIN."); setPinLoading(false); return; }
      localStorage.setItem(`eps_join_${code}`, JSON.stringify({ deviceId: data.deviceId, isOrganiser: true }));
      setDeviceId(data.deviceId);
    } catch { setPinError("Network error."); }
    setPinLoading(false);
  }

  async function startMatch(matchId: string, courtNumber: number) {
    if (!deviceId) return;
    await fetch(`/api/matches/${matchId}/start`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courtNumber, deviceId }),
    });
  }

  async function resolveConflict(matchId: string) {
    if (!deviceId) return;
    const { pA, pB } = resolving[matchId] ?? { pA: 0, pB: 0 };
    setResolveLoading(matchId);
    try {
      await fetch(`/api/matches/${matchId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, pointsA: pA, pointsB: pB }),
      });
    } finally { setResolveLoading(null); }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
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
    courtCard: { borderRadius: 16, padding: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 },
    conflictCard: { borderRadius: 16, padding: 14, background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.3)", marginBottom: 10 },
    queueCard: { borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 10 },
    stepBtn: { width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 18, fontWeight: 1000, cursor: "pointer" },
    val: { fontSize: 22, fontWeight: 1100, minWidth: 32, textAlign: "center" as const },
    names: { fontWeight: 900, fontSize: 14, lineHeight: 1.4 },
    score: { fontSize: 30, fontWeight: 1150, letterSpacing: 1 },
    pinInput: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "14px 12px", fontSize: 20, fontWeight: 900, textAlign: "center" as const, outline: "none", boxSizing: "border-box" as const },
    errorBox: { marginTop: 10, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    pillsRow: { display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 12 },
  };

  if (!bootstrapped) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading…</div></div></div>;

  // ── PIN gate ─────────────────────────────────────────────────────────────────
  if (!deviceId) {
    return (
      <div style={st.page}>
        <div style={{ ...st.card, maxWidth: 420, marginTop: 60 }}>
          <button style={st.btn} onClick={() => router.push("/")}>← Back</button>
          <div style={{ ...st.title, marginTop: 14 }}>Organiser Access</div>
          <div style={{ ...st.sub, marginBottom: 20 }}>Enter the organiser PIN for session <strong style={{ color: ORANGE }}>{code}</strong>.</div>
          <input
            style={st.pinInput}
            value={pinInput}
            type="password"
            placeholder="PIN"
            maxLength={8}
            autoFocus
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") claimOrganiser(); }}
          />
          <button
            style={{ ...st.btnOrange, width: "100%", marginTop: 14, padding: 16, fontSize: 15, opacity: pinLoading ? 0.5 : 1 }}
            onClick={claimOrganiser}
            disabled={pinLoading}
          >
            {pinLoading ? "Verifying…" : "Access organiser view"}
          </button>
          {pinError && <div style={st.errorBox}>{pinError}</div>}
        </div>
      </div>
    );
  }

  if (!session) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading session…{sessionError && ` — ${sessionError}`}</div></div></div>;

  // ── Derived state ─────────────────────────────────────────────────────────────
  const nameById = session.players.reduce<Record<string, string>>((m, p) => { m[p.id] = p.name; return m; }, {});
  function names(m: Match) {
    return {
      a1: nameById[m.teamAPlayer1] ?? "?", a2: nameById[m.teamAPlayer2] ?? "?",
      b1: nameById[m.teamBPlayer1] ?? "?", b2: nameById[m.teamBPlayer2] ?? "?",
    };
  }

  const inProgress = session.matches.filter((m) => m.status === "IN_PROGRESS");
  const conflicts = session.matches.filter((m) => m.scoreStatus === "CONFLICT");
  const pending = session.matches.filter((m) => m.status === "PENDING");
  const complete = session.matches.filter((m) => m.status === "COMPLETE");
  const courts = Array.from({ length: session.courts }, (_, i) => i + 1);

  return (
    <div style={st.page}>
      <div style={st.card}>

        {/* Header */}
        <div style={st.row}>
          <div>
            <div style={st.title}>Organiser · {session.code}</div>
            <div style={st.sub}>{session.format} · {session.players.length} players · {session.courts} courts · {session.pointsPerMatch} pts</div>
          </div>
          <button style={st.btn} onClick={() => router.push("/")}>Home</button>
        </div>

        <div style={st.pillsRow}>
          {pill(`${inProgress.length} playing`, "rgba(255,107,0,0.18)", "rgba(255,107,0,0.45)")}
          {pill(`${pending.length} queued`, "rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)")}
          {pill(`${complete.length} done`, "rgba(0,200,80,0.12)", "rgba(0,200,80,0.35)")}
          {conflicts.length > 0 && pill(`⚠ ${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""}`, "rgba(255,64,64,0.15)", "rgba(255,64,64,0.4)")}
        </div>

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
                  <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>
                    Submitted: {m.scoreSubmissions.map((s) => `${s.pointsA}–${s.pointsB}`).join(" · ")}
                  </div>
                  <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 13, opacity: 0.7, minWidth: 60 }}>Team A:</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pA: Math.max(0, rv.pA - 1) })}>−</button>
                    <span style={st.val}>{rv.pA}</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pA: rv.pA + 1 })}>+</button>
                    <span style={{ fontSize: 13, opacity: 0.7, minWidth: 60, marginLeft: 8 }}>Team B:</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pB: Math.max(0, rv.pB - 1) })}>−</button>
                    <span style={st.val}>{rv.pB}</span>
                    <button style={st.stepBtn} onClick={() => updateRv({ pB: rv.pB + 1 })}>+</button>
                    <button
                      style={{ ...st.btnOrange, opacity: resolveLoading === m.id ? 0.5 : 1 }}
                      onClick={() => resolveConflict(m.id)}
                      disabled={resolveLoading === m.id}
                    >
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
          {courts.map((cn) => {
            const m = inProgress.find((x) => x.courtNumber === cn);
            if (!m) {
              return (
                <div key={cn} style={{ ...st.courtCard, opacity: 0.45 }}>
                  <div style={{ fontWeight: 1000, fontSize: 15, color: ORANGE }}>Court {cn}</div>
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Open — no active match</div>
                </div>
              );
            }
            const { a1, a2, b1, b2 } = names(m);
            const pA = m.pointsA ?? 0; const pB = m.pointsB ?? 0;
            const sColor = m.scoreStatus === "CONFLICT" ? RED : m.scoreStatus === "CONFIRMED" ? GREEN : m.scoreStatus === "PENDING" ? WARM_WHITE : ORANGE;
            const sLabel = m.scoreStatus === "CONFLICT" ? "⚠ Conflict" : m.scoreStatus === "CONFIRMED" ? "✓ Confirmed" : m.scoreStatus === "PENDING" ? "Score submitted" : "In play";
            return (
              <div key={cn} style={{ ...st.courtCard, borderColor: "rgba(255,107,0,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontWeight: 1000, fontSize: 15, color: ORANGE }}>Court {cn}</div>
                  <span style={{ fontSize: 11, fontWeight: 1000, color: sColor }}>{sLabel}</span>
                </div>
                <div style={st.names}>{a1} & {a2}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0" }}>
                  <span style={st.score}>{pA}</span>
                  <span style={{ opacity: 0.35, fontWeight: 900 }}>—</span>
                  <span style={st.score}>{pB}</span>
                </div>
                <div style={st.names}>{b1} & {b2}</div>
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
                    {courts.map((cn) => {
                      const busy = inProgress.some((x) => x.courtNumber === cn);
                      return (
                        <button
                          key={cn}
                          style={{ ...st.btn, opacity: busy ? 0.3 : 1 }}
                          onClick={() => { if (!busy) startMatch(m.id, cn); }}
                          disabled={busy}
                        >
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
          <div style={{ opacity: 0.55, fontWeight: 900, padding: "16px 0", textAlign: "center" }}>
            All {complete.length} matches complete 🏆
          </div>
        )}
      </div>
    </div>
  );
}