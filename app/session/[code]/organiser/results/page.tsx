"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";
const GREEN = "#00C851";
const RED = "#FF4040";

type Player = { id: string; name: string };
type Match = {
  id: string; queuePosition: number; courtNumber: number | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE";
  teamAPlayer1: string; teamAPlayer2: string;
  teamBPlayer1: string; teamBPlayer2: string;
  pointsA: number | null; pointsB: number | null;
  scoreStatus: string | null;
  completedAt: string | null;
};
type Session = { id: string; code: string; format: string; players: Player[]; matches: Match[] };

export default function ResultsPage() {
  const params = useParams();
  const code = (Array.isArray(params?.code) ? params.code[0] : params?.code ?? "") as string;
  const router = useRouter();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");

  // Edit state: matchId → { pA, pB } | null
  const [editing, setEditing] = useState<Record<string, { pA: number; pB: number } | null>>({});
  const [saveLoading, setSaveLoading] = useState<string | null>(null);
  const [saveFlash, setSaveFlash] = useState<string | null>(null);

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

  useEffect(() => {
    if (!deviceId || !code) return;
    fetch(`/api/sessions/${code}`)
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setError("Failed to load session."));
  }, [deviceId, code]);

  async function saveEdit(matchId: string) {
    if (!deviceId) return;
    const edit = editing[matchId];
    if (!edit) return;
    setSaveLoading(matchId);
    try {
      const r = await fetch(`/api/matches/${matchId}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, pointsA: edit.pA, pointsB: edit.pB }),
      });
      if (r.ok) {
        // Refresh session data
        const updated = await fetch(`/api/sessions/${code}`).then((r) => r.json());
        setSession(updated);
        setEditing((prev) => ({ ...prev, [matchId]: null }));
        setSaveFlash(matchId);
        setTimeout(() => setSaveFlash(null), 2000);
      } else {
        const d = await r.json();
        setError(d.error ?? "Save failed.");
      }
    } catch { setError("Network error."); }
    setSaveLoading(null);
  }

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 720, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", marginTop: 12 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" as const },
    title: { fontSize: 22, fontWeight: 1000 },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 0" },
    btn: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnOrange: { borderRadius: 14, padding: "11px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, whiteSpace: "nowrap" as const },
    btnGreen: { borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "none", background: GREEN, color: WHITE, whiteSpace: "nowrap" as const },
    matchCard: { borderRadius: 16, padding: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 },
    stepBtn: { width: 38, height: 38, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 20, fontWeight: 1000, cursor: "pointer" },
    hint: { fontSize: 12, opacity: 0.55, color: WARM_WHITE, lineHeight: 1.4, marginBottom: 14 },
    errorBox: { marginTop: 10, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
  };

  if (!bootstrapped) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading…</div></div></div>;

  if (!deviceId) {
    return (
      <div style={st.page}>
        <div style={{ ...st.card, maxWidth: 420, marginTop: 60 }}>
          <div style={st.title}>Access required</div>
          <div style={{ ...st.sub, marginBottom: 16 }}>You need organiser access to view results.</div>
          {/* Bug 1 fix: correct path */}
          <button style={st.btnOrange} onClick={() => router.push(`/session/${code}/organiser`)}>← Organiser</button>
        </div>
      </div>
    );
  }

  if (!session) return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading results…{error && ` — ${error}`}</div></div></div>;

  const nameById = session.players.reduce<Record<string, string>>((m, p) => { m[p.id] = p.name; return m; }, {});
  const completed = session.matches
    .filter((m) => m.status === "COMPLETE")
    .sort((a, b) => {
      if (!a.completedAt || !b.completedAt) return 0;
      return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    });

  function formatTime(iso: string | null) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={st.row}>
          <div>
            <div style={st.title}>Match Results · {code}</div>
            <div style={st.sub}>{session.format} · {completed.length} completed match{completed.length !== 1 ? "es" : ""}</div>
          </div>
          {/* Bug 1 fix: correct path */}
          <button style={st.btn} onClick={() => router.push(`/session/${code}/organiser`)}>← Organiser</button>
        </div>

        <div style={st.divider} />
        <div style={st.hint}>All confirmed match scores are listed below. Use Edit score to correct a result — the leaderboard updates immediately on all devices.</div>

        {error && <div style={st.errorBox}>{error}</div>}

        {completed.length === 0 && <div style={{ opacity: 0.55, fontWeight: 900 }}>No completed matches yet.</div>}

        {completed.map((m, idx) => {
          const a1 = nameById[m.teamAPlayer1] ?? "?"; const a2 = nameById[m.teamAPlayer2] ?? "?";
          const b1 = nameById[m.teamBPlayer1] ?? "?"; const b2 = nameById[m.teamBPlayer2] ?? "?";
          const pA = m.pointsA ?? 0; const pB = m.pointsB ?? 0;
          const isEditing = editing[m.id] != null;
          const edit = editing[m.id];
          const flashed = saveFlash === m.id;

          return (
            <div key={m.id} style={{ ...st.matchCard, borderColor: flashed ? "rgba(0,200,80,0.4)" : "rgba(255,255,255,0.08)" }}>

              {/* Match header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 1000, fontSize: 13, color: ORANGE }}>Match {idx + 1}</span>
                  {m.courtNumber && <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 8 }}>Court {m.courtNumber}</span>}
                  {m.completedAt && <span style={{ fontSize: 12, opacity: 0.4, marginLeft: 8 }}>· {formatTime(m.completedAt)}</span>}
                </div>
                {!isEditing && (
                  <button style={st.btn} onClick={() => setEditing((prev) => ({ ...prev, [m.id]: { pA, pB } }))}>
                    {flashed ? "✓ Saved" : "Edit score"}
                  </button>
                )}
              </div>

              {/* Score display or edit */}
              {isEditing && edit ? (
                <div>
                  {/* Team A edit row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>{a1} & {a2}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button style={st.stepBtn} onClick={() => setEditing((prev) => ({ ...prev, [m.id]: { ...edit, pA: Math.max(0, edit.pA - 1) } }))}>−</button>
                      <span style={{ fontSize: 24, fontWeight: 1100, minWidth: 32, textAlign: "center" as const }}>{edit.pA}</span>
                      <button style={st.stepBtn} onClick={() => setEditing((prev) => ({ ...prev, [m.id]: { ...edit, pA: edit.pA + 1 } }))}>+</button>
                    </div>
                  </div>
                  {/* Team B edit row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>{b1} & {b2}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button style={st.stepBtn} onClick={() => setEditing((prev) => ({ ...prev, [m.id]: { ...edit, pB: Math.max(0, edit.pB - 1) } }))}>−</button>
                      <span style={{ fontSize: 24, fontWeight: 1100, minWidth: 32, textAlign: "center" as const }}>{edit.pB}</span>
                      <button style={st.stepBtn} onClick={() => setEditing((prev) => ({ ...prev, [m.id]: { ...edit, pB: edit.pB + 1 } }))}>+</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...st.btnGreen, opacity: saveLoading === m.id ? 0.5 : 1 }} onClick={() => saveEdit(m.id)} disabled={saveLoading === m.id}>
                      {saveLoading === m.id ? "Saving…" : `Save ${edit.pA}–${edit.pB}`}
                    </button>
                    <button style={st.btn} onClick={() => setEditing((prev) => ({ ...prev, [m.id]: null }))}>Cancel</button>
                  </div>
                </div>
              ) : (
                /* Score display */
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.5, fontWeight: 900, marginBottom: 3 }}>Team A</div>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>{a1}</div>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>{a2}</div>
                  </div>
                  <div style={{ textAlign: "center" as const, padding: "0 8px" }}>
                    <div style={{ fontSize: 34, fontWeight: 1150, lineHeight: 1.1 }}>
                      <span style={{ color: pA > pB ? GREEN : pA < pB ? RED : WHITE }}>{pA}</span>
                    </div>
                    <div style={{ fontSize: 16, opacity: 0.3, margin: "2px 0" }}>—</div>
                    <div style={{ fontSize: 34, fontWeight: 1150, lineHeight: 1.1 }}>
                      <span style={{ color: pB > pA ? GREEN : pB < pA ? RED : WHITE }}>{pB}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontSize: 12, opacity: 0.5, fontWeight: 900, marginBottom: 3 }}>Team B</div>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>{b1}</div>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>{b2}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div style={{ ...st.hint, marginTop: 16 }}>Score edits are permanent and update the leaderboard on all connected devices immediately.</div>
      </div>
    </div>
  );
}