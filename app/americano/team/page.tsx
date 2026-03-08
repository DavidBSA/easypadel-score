"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const STORAGE_KEY = "eps_team_session_active";

type TeamDraft = { tempId: string; name: string; player1: string; player2: string };

function uid() { return Math.random().toString(36).slice(2, 8); }

function defaultTeams(): TeamDraft[] {
  return [
    { tempId: uid(), name: "", player1: "", player2: "" },
    { tempId: uid(), name: "", player1: "", player2: "" },
    { tempId: uid(), name: "", player1: "", player2: "" },
    { tempId: uid(), name: "", player1: "", player2: "" },
  ];
}

export default function TeamAmericanoSetupPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamDraft[]>(defaultTeams);
  const [courts, setCourts] = useState(1);
  const [pointsPerMatch, setPointsPerMatch] = useState(21);
  const [error, setError] = useState("");
  const [existingCode, setExistingCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.code) setExistingCode(s.code);
      }
    } catch { /* ignore */ }
  }, []);

  function addTeam() {
    if (teams.length >= 12) return;
    setTeams((prev) => [...prev, { tempId: uid(), name: "", player1: "", player2: "" }]);
  }

  function removeTeam(tempId: string) {
    if (teams.length <= 2) return;
    setTeams((prev) => prev.filter((t) => t.tempId !== tempId));
  }

  function updateTeam(tempId: string, field: keyof TeamDraft, value: string) {
    setTeams((prev) => prev.map((t) => t.tempId === tempId ? { ...t, [field]: value } : t));
  }

  function validate(): string {
    const minTeams = courts * 2;
    if (teams.length < minTeams) return `Need at least ${minTeams} teams for ${courts} court${courts > 1 ? "s" : ""}. Add more teams or reduce courts.`;
    for (const t of teams) {
      if (!t.player1.trim() || !t.player2.trim()) return "Every team needs two player names.";
    }
    return "";
  }

  function startSession() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    const code = Math.random().toString(36).slice(2, 6).toUpperCase();
    const session = {
      code,
      createdAtISO: new Date().toISOString(),
      courts,
      pointsPerMatch,
      currentRound: 1,
      rounds: [],
      teams: teams.map((t) => ({
        id: uid(),
        name: t.name.trim() || `${t.player1.trim()} & ${t.player2.trim()}`,
        player1: t.player1.trim(),
        player2: t.player2.trim(),
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    router.push("/americano/team/session");
  }

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 680, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.50)", marginTop: 12 },
    titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    title: { fontSize: 22, fontWeight: 1000 },
    subtitle: { color: WARM_WHITE, opacity: 0.6, fontSize: 13, marginTop: 5, lineHeight: 1.35 },
    btn: { borderRadius: 14, padding: "12px 14px", fontSize: 15, fontWeight: 950, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnPrimary: { borderRadius: 14, padding: "14px 16px", fontSize: 16, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, width: "100%", textAlign: "center" as const },
    btnOutline: { borderRadius: 14, padding: "13px 16px", fontSize: 15, fontWeight: 1000, cursor: "pointer", border: `1px solid ${ORANGE}`, background: "rgba(255,107,0,0.08)", color: ORANGE, width: "100%", textAlign: "center" as const },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "18px 0" },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginBottom: 10 },
    settingsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    settingBox: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 },
    settingLabel: { fontSize: 12, opacity: 0.55, fontWeight: 900, marginBottom: 10 },
    stepper: { display: "flex", alignItems: "center", gap: 14 },
    stepBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 20, fontWeight: 1000, cursor: "pointer", lineHeight: 1 },
    stepVal: { fontSize: 22, fontWeight: 1100, minWidth: 30, textAlign: "center" as const },
    input: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "11px 12px", fontSize: 15, outline: "none", fontWeight: 900, boxSizing: "border-box" as const },
    teamCard: { background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 14, display: "grid", gap: 10 },
    teamCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    teamNum: { fontSize: 12, fontWeight: 1000, opacity: 0.5, letterSpacing: 0.5, textTransform: "uppercase" as const },
    removeBtn: { fontSize: 13, fontWeight: 1000, color: "rgba(255,255,255,0.35)", cursor: "pointer", border: "none", background: "none", padding: "4px 8px" },
    playerRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    inputLabel: { fontSize: 11, opacity: 0.5, fontWeight: 900, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: 0.4 },
    addBtn: { borderRadius: 14, padding: "13px", fontSize: 14, fontWeight: 1000, cursor: "pointer", border: "1px dashed rgba(255,255,255,0.20)", background: "transparent", color: WHITE, width: "100%" },
    error: { marginTop: 10, borderRadius: 12, padding: "12px 14px", background: "rgba(255,60,60,0.10)", border: "1px solid rgba(255,60,60,0.30)", fontSize: 13, fontWeight: 900, color: WHITE },
    hint: { fontSize: 12, opacity: 0.55, lineHeight: 1.35, color: WARM_WHITE },
    resumeBanner: { borderRadius: 14, padding: "14px 16px", background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.28)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" as const },
    resumeText: { fontSize: 14, fontWeight: 900 },
    resumeCode: { color: ORANGE, fontWeight: 1100 },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.titleRow}>
          <div>
            <div style={styles.title}>Team Americano</div>
            <div style={styles.subtitle}>Fixed partners · Rotating opponents</div>
          </div>
          <button style={styles.btn} onClick={() => router.push("/")}>Home</button>
        </div>

        {existingCode && (
          <>
            <div style={styles.divider} />
            <div style={styles.resumeBanner}>
              <div style={styles.resumeText}>
                Active session <span style={styles.resumeCode}>{existingCode}</span> found
              </div>
              <button style={{ ...styles.btn, padding: "10px 14px", fontSize: 14 }} onClick={() => router.push("/americano/team/session")}>
                Resume →
              </button>
            </div>
          </>
        )}

        <div style={styles.divider} />

        {/* Settings */}
        <div style={styles.sectionLabel}>Session settings</div>
        <div style={styles.settingsRow}>
          <div style={styles.settingBox}>
            <div style={styles.settingLabel}>Courts</div>
            <div style={styles.stepper}>
              <button style={styles.stepBtn} onClick={() => setCourts((c) => Math.max(1, c - 1))}>−</button>
              <div style={styles.stepVal}>{courts}</div>
              <button style={styles.stepBtn} onClick={() => setCourts((c) => Math.min(4, c + 1))}>+</button>
            </div>
          </div>
          <div style={styles.settingBox}>
            <div style={styles.settingLabel}>Points per match</div>
            <div style={styles.stepper}>
              <button style={styles.stepBtn} onClick={() => setPointsPerMatch((p) => Math.max(8, p - 1))}>−</button>
              <div style={styles.stepVal}>{pointsPerMatch}</div>
              <button style={styles.stepBtn} onClick={() => setPointsPerMatch((p) => Math.min(99, p + 1))}>+</button>
            </div>
          </div>
        </div>

        <div style={styles.divider} />

        {/* Teams */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={styles.sectionLabel}>Teams ({teams.length})</div>
          <div style={styles.hint}>Min {courts * 2} needed · max 12</div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {teams.map((team, idx) => (
            <div key={team.tempId} style={styles.teamCard}>
              <div style={styles.teamCardHeader}>
                <div style={styles.teamNum}>Team {idx + 1}</div>
                <button
                  style={{ ...styles.removeBtn, opacity: teams.length <= 2 ? 0.25 : 1 }}
                  onClick={() => removeTeam(team.tempId)}
                  disabled={teams.length <= 2}
                >
                  ✕
                </button>
              </div>
              <div>
                <div style={styles.inputLabel}>Team name (optional)</div>
                <input
                  style={styles.input}
                  placeholder={`${team.player1 || "Player 1"} & ${team.player2 || "Player 2"}`}
                  value={team.name}
                  onChange={(e) => updateTeam(team.tempId, "name", e.target.value)}
                />
              </div>
              <div style={styles.playerRow}>
                <div>
                  <div style={styles.inputLabel}>Player 1</div>
                  <input
                    style={styles.input}
                    placeholder="Name"
                    value={team.player1}
                    onChange={(e) => updateTeam(team.tempId, "player1", e.target.value)}
                  />
                </div>
                <div>
                  <div style={styles.inputLabel}>Player 2</div>
                  <input
                    style={styles.input}
                    placeholder="Name"
                    value={team.player2}
                    onChange={(e) => updateTeam(team.tempId, "player2", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            style={{ ...styles.addBtn, opacity: teams.length >= 12 ? 0.4 : 1 }}
            onClick={addTeam}
            disabled={teams.length >= 12}
          >
            + Add team
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.divider} />

        <button style={styles.btnPrimary} onClick={startSession}>
          Start session →
        </button>

        <div style={{ ...styles.hint, marginTop: 10, textAlign: "center" as const }}>
          Extra teams rotate as sit-outs. Partners stay fixed throughout.
        </div>

      </div>
    </div>
  );
}