"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";
const GREEN = "#00C851";
const RED = "#FF4040";

type Player = { id: string; name: string; isActive: boolean };
type Match = {
  id: string;
  queuePosition: number;
  courtNumber: number | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE";
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
  pointsA: number | null;
  pointsB: number | null;
  scoreStatus: "PENDING" | "CONFIRMED" | "CONFLICT" | null;
  completedAt: string | null;
};
type Session = {
  id: string;
  code: string;
  format: string;
  status: "LOBBY" | "ACTIVE" | "COMPLETE";
  courts: number;
  pointsPerMatch: number;
  players: Player[];
  matches: Match[];
};

export default function ResultsPage() {
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

  // Per-match edit state: matchId → { pA, pB, editing, saving, saved, error }
  const [editState, setEditState] = useState<Record<string, {
    pA: number; pB: number; editing: boolean; saving: boolean; saved: boolean; error: string;
  }>>({});

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

  const loadSession = useCallback(async () => {
    try {
      const r = await fetch(`/api/sessions/${code}`);
      const data = await r.json();
      setSession(data);
      // Initialise edit state for any new completed matches
      setEditState((prev) => {
        const next = { ...prev };
        for (const m of (data.matches ?? []).filter((m: Match) => m.status === "COMPLETE")) {
          if (!(m.id in next)) {
            next[m.id] = { pA: m.pointsA ?? 0, pB: m.pointsB ?? 0, editing: false, saving: false, saved: false, error: "" };
          }
        }
        return next;
      });
    } catch {
      setSessionError("Failed to load session.");
    }
  }, [code]);

  useEffect(() => {
    if (!deviceId || !code) return;
    loadSession();
  }, [deviceId, code, loadSession]);

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

  function setEdit(matchId: string, patch: Partial<{ pA: number; pB: number; editing: boolean; saving: boolean; saved: boolean; error: string }>) {
    setEditState((prev) => ({ ...prev, [matchId]: { ...prev[matchId], ...patch } }));
  }

  function openEdit(m: Match) {
    setEdit(m.id, { pA: m.pointsA ?? 0, pB: m.pointsB ?? 0, editing: true, saved: false, error: "" });
  }

  function cancelEdit(matchId: string, m: Match) {
    setEdit(matchId, { pA: m.pointsA ?? 0, pB: m.pointsB ?? 0, editing: false, error: "" });
  }

  async function saveEdit(matchId: string) {
    if (!deviceId) return;
    const es = editState[matchId];
    if (!es) return;
    setEdit(matchId, { saving: true, error: "" });
    try {
      const r = await fetch(`/api/matches/${matchId}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, pointsA: es.pA, pointsB: es.pB }),
      });
      const data = await r.json();
      if (!r.ok) {
        setEdit(matchId, { saving: false, error: data.error ?? "Save failed." });
        return;
      }
      setEdit(matchId, { saving: false, editing: false, saved: true, error: "" });
      // Reload so displayed scores reflect the edit
      await loadSession();
    } catch {
      setEdit(matchId, { saving: false, error: "Network error." });
    }
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
    btnSmall: { borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnSave: { borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 1000, cursor: "pointer", border: "none", background: GREEN, color: WHITE, whiteSpace: "nowrap" as const },
    btnCancel: { borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: WHITE, whiteSpace: "nowrap" as const },
    matchCard: { borderRadius: 16, padding: 14, background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 },
    matchCardEditing: { borderRadius: 16, padding: 14, background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.30)", marginBottom: 10 },
    matchHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 },
    courtLabel: { fontSize: 12, fontWeight: 1000, color: ORANGE, letterSpacing: 0.5 },
    completedAt: { fontSize: 11, opacity: 0.45, fontWeight: 900 },
    teamRow: { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" },
    teamNames: { fontWeight: 950, fontSize: 14, lineHeight: 1.4 },
    teamNamesB: { fontWeight: 950, fontSize: 14, lineHeight: 1.4, textAlign: "right" as const },
    scoreDisplay: { fontSize: 28, fontWeight: 1150, letterSpacing: 2, textAlign: "center" as const, color: WHITE },
    stepBtn: { width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 18, fontWeight: 1000, cursor: "pointer" },
    stepVal: { fontSize: 24, fontWeight: 1150, minWidth: 32, textAlign: "center" as const },
    editRow: { marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const },
    editTeamLabel: { fontSize: 12, opacity: 0.65, fontWeight: 900, minWidth: 54 },
    editActions: { marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const },
    savedBadge: { fontSize: 11, fontWeight: 1000, color: GREEN, padding: "4px 10px", borderRadius: 999, background: "rgba(0,200,80,0.10)", border: "1px solid rgba(0,200,80,0.28)" },
    errorBox: { marginTop: 8, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 10, borderRadius: 10, fontWeight: 900, fontSize: 12 },
    hint: { fontSize: 12, opacity: 0.55, color: WARM_WHITE, lineHeight: 1.4 },
    emptyState: { borderRadius: 16, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" as const, opacity: 0.6, fontWeight: 900 },
    pinInput: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "14px 12px", fontSize: 20, fontWeight: 900, textAlign: "center" as const, outline: "none", boxSizing: "border-box" as const },
  };

  if (!bootstrapped) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading…</div></div></div>;

  // PIN gate — same pattern as organiser page
  if (!deviceId) {
    return (
      <div style={st.page}>
        <div style={{ ...st.card, maxWidth: 420, marginTop: 60 }}>
          <button style={st.btn} onClick={() => router.push(`/organiser/${code}`)}>← Back</button>
          <div style={{ ...st.title, marginTop: 14 }}>Organiser Access</div>
          <div style={{ ...st.sub, marginBottom: 20 }}>Enter the organiser PIN to view results for <strong style={{ color: ORANGE }}>{code}</strong>.</div>
          <input style={st.pinInput} value={pinInput} type="password" placeholder="PIN" maxLength={8} autoFocus
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") claimOrganiser(); }} />
          <button style={{ ...st.btnOrange, width: "100%", marginTop: 14, padding: 16, fontSize: 15, opacity: pinLoading ? 0.5 : 1 }}
            onClick={claimOrganiser} disabled={pinLoading}>
            {pinLoading ? "Verifying…" : "Access results"}
          </button>
          {pinError && <div style={{ marginTop: 10, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 }}>{pinError}</div>}
        </div>
      </div>
    );
  }

  if (!session) return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={{ opacity: 0.7 }}>Loading results…{sessionError && ` — ${sessionError}`}</div>
      </div>
    </div>
  );

  const nameById = session.players.reduce<Record<string, string>>((m, p) => { m[p.id] = p.name; return m; }, {});
  const completedMatches = session.matches
    .filter((m) => m.status === "COMPLETE")
    .sort((a, b) => {
      // Sort by completedAt ascending — earliest first
      if (!a.completedAt && !b.completedAt) return 0;
      if (!a.completedAt) return 1;
      if (!b.completedAt) return -1;
      return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    });

  function formatTime(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={st.row}>
          <div>
            <div style={st.title}>Match Results · {session.code}</div>
            <div style={st.sub}>{session.format} · {completedMatches.length} completed match{completedMatches.length !== 1 ? "es" : ""}</div>
          </div>
          <button style={st.btn} onClick={() => router.push(`/organiser/${code}`)}>← Organiser</button>
        </div>

        <div style={st.divider} />

        <div style={{ ...st.hint, marginBottom: 14 }}>
          All confirmed match scores are listed below. Use Edit score to correct a result — the leaderboard updates immediately on all devices.
        </div>

        {completedMatches.length === 0 ? (
          <div style={st.emptyState}>No completed matches yet.</div>
        ) : (
          completedMatches.map((m, idx) => {
            const a1 = nameById[m.teamAPlayer1] ?? "?";
            const a2 = nameById[m.teamAPlayer2] ?? "?";
            const b1 = nameById[m.teamBPlayer1] ?? "?";
            const b2 = nameById[m.teamBPlayer2] ?? "?";
            const pA = m.pointsA ?? 0;
            const pB = m.pointsB ?? 0;
            const es = editState[m.id];
            const isEditing = es?.editing ?? false;

            return (
              <div key={m.id} style={isEditing ? st.matchCardEditing : st.matchCard}>
                <div style={st.matchHeader}>
                  <div>
                    <div style={st.courtLabel}>
                      Match {idx + 1}{m.courtNumber !== null ? ` · Court ${m.courtNumber}` : ""}
                    </div>
                    {m.completedAt && (
                      <div style={st.completedAt}>Completed {formatTime(m.completedAt)}</div>
                    )}
                  </div>
                  {!isEditing && (
                    <button style={st.btnSmall} onClick={() => openEdit(m)}>Edit score</button>
                  )}
                </div>

                {/* Score display (non-editing) */}
                {!isEditing && (
                  <div style={st.teamRow}>
                    <div>
                      <div style={st.teamNames}>{a1}</div>
                      <div style={st.teamNames}>{a2}</div>
                    </div>
                    <div>
                      <div style={{ ...st.scoreDisplay, color: pA > pB ? GREEN : pA < pB ? RED : WHITE }}>
                        {pA}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.35, fontWeight: 900, textAlign: "center" as const }}>—</div>
                      <div style={{ ...st.scoreDisplay, color: pB > pA ? GREEN : pB < pA ? RED : WHITE }}>
                        {pB}
                      </div>
                    </div>
                    <div>
                      <div style={st.teamNamesB}>{b1}</div>
                      <div style={st.teamNamesB}>{b2}</div>
                    </div>
                  </div>
                )}

                {/* Edit mode */}
                {isEditing && es && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 10, opacity: 0.85 }}>
                      {a1} & {a2} <span style={{ opacity: 0.4 }}>vs</span> {b1} & {b2}
                    </div>
                    <div style={st.editRow}>
                      <span style={st.editTeamLabel}>Team A:</span>
                      <button style={st.stepBtn} onClick={() => setEdit(m.id, { pA: Math.max(0, es.pA - 1) })}>−</button>
                      <span style={st.stepVal}>{es.pA}</span>
                      <button style={st.stepBtn} onClick={() => setEdit(m.id, { pA: es.pA + 1 })}>+</button>
                      <span style={{ ...st.editTeamLabel, marginLeft: 12 }}>Team B:</span>
                      <button style={st.stepBtn} onClick={() => setEdit(m.id, { pB: Math.max(0, es.pB - 1) })}>−</button>
                      <span style={st.stepVal}>{es.pB}</span>
                      <button style={st.stepBtn} onClick={() => setEdit(m.id, { pB: es.pB + 1 })}>+</button>
                    </div>
                    <div style={st.editActions}>
                      <button
                        style={{ ...st.btnSave, opacity: es.saving ? 0.5 : 1 }}
                        onClick={() => saveEdit(m.id)}
                        disabled={es.saving}
                      >
                        {es.saving ? "Saving…" : `Save ${es.pA}–${es.pB}`}
                      </button>
                      <button style={st.btnCancel} onClick={() => cancelEdit(m.id, m)}>Cancel</button>
                    </div>
                    {es.error && <div style={st.errorBox}>{es.error}</div>}
                  </>
                )}

                {/* Saved flash */}
                {!isEditing && es?.saved && (
                  <div style={{ marginTop: 8 }}>
                    <span style={st.savedBadge}>✓ Score updated</span>
                  </div>
                )}
              </div>
            );
          })
        )}

        <div style={{ ...st.hint, marginTop: 16 }}>
          Score edits are permanent and update the leaderboard on all connected devices immediately.
        </div>
      </div>
    </div>
  );
}