"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const STORAGE_KEY = "eps_team_session_active";

type TeamPair = { id: string; name: string; player1: string; player2: string };
type CourtMatch = { courtNumber: number; teamA: string; teamB: string; score: { pointsA: number; pointsB: number; firstServeTeam?: "A" | "B"; isComplete: boolean } };
type TeamRound = { roundNumber: number; matches: CourtMatch[] };
type TeamSession = { code: string; createdAtISO: string; courts: number; teams: TeamPair[]; currentRound: number; rounds: TeamRound[]; pointsPerMatch: number; servesPerRotation: number };

function safeParseJSON<T>(v: string | null, fb: T): T { try { if (!v) return fb; return JSON.parse(v) as T; } catch { return fb; } }
function makeId() { return Math.random().toString(36).slice(2, 10); }
function makeCode() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let o = ""; for (let i = 0; i < 4; i++) o += c[Math.floor(Math.random() * c.length)]; return o; }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function buildRound(teams: TeamPair[], courts: number, roundNumber: number): TeamRound {
  const shuffled = shuffle(teams.slice(0, courts * 2));
  const matches: CourtMatch[] = [];
  for (let c = 0; c < courts; c++) {
    const b = c * 2;
    matches.push({ courtNumber: c + 1, teamA: shuffled[b].id, teamB: shuffled[b + 1].id, score: { pointsA: 0, pointsB: 0, firstServeTeam: "A", isComplete: false } });
  }
  return { roundNumber, matches };
}

// Returns [A1, B1, A2, B2] serve point counts
// A1 = team A player 1, B1 = team B player 1, A2 = team A player 2, B2 = team B player 2
function serveDistribution(pts: number, spr: number): [number, number, number, number] {
  const cycle = spr * 4; const full = Math.floor(pts / cycle); const rem = pts % cycle;
  return [0, 1, 2, 3].map(i => full * spr + Math.min(Math.max(rem - i * spr, 0), spr)) as [number, number, number, number];
}

const serveChipStyle = (active: boolean): React.CSSProperties => ({
  borderRadius: 12, padding: "10px 18px", fontSize: 14, fontWeight: 1000, cursor: "pointer",
  border: active ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.14)",
  background: active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.06)",
  color: active ? WHITE : WARM_WHITE, whiteSpace: "nowrap" as const,
});

export default function TeamAmericanoPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<TeamSession | null>(null);
  const [courts, setCourts] = useState(2);
  const [pointsPerMatch, setPointsPerMatch] = useState(21);
  const [servesPerRotation, setServesPerRotation] = useState(4);
  const [teamInputs, setTeamInputs] = useState<{ name: string; player1: string; player2: string }[]>(
    Array.from({ length: 8 }, () => ({ name: "", player1: "", player2: "" }))
  );
  const [error, setError] = useState("");

  useEffect(() => {
    setSession(safeParseJSON<TeamSession | null>(localStorage.getItem(STORAGE_KEY), null));
    setLoaded(true);
  }, []);

  const minTeams = useMemo(() => courts * 2, [courts]);

  const dist = useMemo(() => serveDistribution(pointsPerMatch, servesPerRotation), [pointsPerMatch, servesPerRotation]);
  const serveHint = useMemo(() => {
    const [a1, b1, a2, b2] = dist;
    if (a1 === b1 && b1 === a2 && a2 === b2) return { even: true, text: `✓ Equal serves — each player serves ${a1} pts` };
    return { even: false, text: `Player 1 (Team A): ${a1} pts · Player 1 (Team B): ${b1} pts · Player 2 (Team A): ${a2} pts · Player 2 (Team B): ${b2} pts` };
  }, [dist]);

  function setTeamField(idx: number, field: "name" | "player1" | "player2", value: string) {
    setTeamInputs((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  }

  function createSession() {
    setError("");
    const validTeams = teamInputs
      .map((t) => ({ ...t, name: t.name.trim(), player1: t.player1.trim(), player2: t.player2.trim() }))
      .filter((t) => t.player1 && t.player2);
    if (validTeams.length < minTeams) { setError(`Enter at least ${minTeams} teams (both player names required) for ${courts} court${courts > 1 ? "s" : ""}.`); return; }
    const teams: TeamPair[] = validTeams.map((t) => ({ id: makeId(), name: t.name || `${t.player1} & ${t.player2}`, player1: t.player1, player2: t.player2 }));
    const next: TeamSession = { code: makeCode(), createdAtISO: new Date().toISOString(), courts, teams, currentRound: 1, rounds: [buildRound(teams, courts, 1)], pointsPerMatch, servesPerRotation };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    router.push("/americano/team/session");
  }

  function discardSession() { localStorage.removeItem(STORAGE_KEY); setSession(null); setError(""); }

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 680, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.50)", marginTop: 12 },
    titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    title: { fontSize: 22, fontWeight: 1000 },
    subtitle: { color: WARM_WHITE, opacity: 0.6, fontSize: 13, marginTop: 5, lineHeight: 1.35 },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 18, marginBottom: 8 },
    row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const },
    btn: { borderRadius: 14, padding: "14px 14px", fontSize: 15, fontWeight: 950, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnPrimary: { borderRadius: 14, padding: "14px 18px", fontSize: 15, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, whiteSpace: "nowrap" as const },
    btnDanger: { borderRadius: 14, padding: "14px 14px", fontSize: 15, fontWeight: 950, cursor: "pointer", border: "1px solid rgba(255,64,64,0.35)", background: "rgba(255,64,64,0.10)", color: WHITE, whiteSpace: "nowrap" as const },
    settingsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    settingBox: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 },
    settingLabel: { fontSize: 12, opacity: 0.55, fontWeight: 900, marginBottom: 10 },
    stepper: { display: "flex", alignItems: "center", gap: 14 },
    stepBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 20, fontWeight: 1000, cursor: "pointer" },
    stepVal: { fontSize: 22, fontWeight: 1100, minWidth: 36, textAlign: "center" as const },
    teamCard: { borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8 },
    input: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", fontWeight: 900, boxSizing: "border-box" as const },
    inputSmall: { width: "100%", background: "rgba(255,255,255,0.05)", color: WHITE, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", fontWeight: 900, boxSizing: "border-box" as const },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" },
    small: { fontSize: 12, color: WARM_WHITE, opacity: 0.55, marginTop: 6, lineHeight: 1.35 },
    teamsGrid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    activeSessionCode: { fontSize: 22, fontWeight: 1000, color: ORANGE, letterSpacing: 2 },
    activeSessionMeta: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4 },
    error: { marginTop: 12, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    hintEven: { marginTop: 8, borderRadius: 12, padding: "10px 14px", background: "rgba(0,200,100,0.08)", border: "1px solid rgba(0,200,100,0.28)", fontSize: 12, fontWeight: 900, color: WHITE },
    hintOdd: { marginTop: 8, borderRadius: 12, padding: "10px 14px", background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.28)", fontSize: 12, fontWeight: 900, color: WHITE },
  };

  if (!loaded) return <div style={styles.page}><div style={styles.card}><div style={{ opacity: 0.7, fontWeight: 900 }}>Loading…</div></div></div>;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <div><div style={styles.title}>Team Americano</div><div style={styles.subtitle}>Fixed partners · Rotating opponents</div></div>
          <button style={styles.btn} onClick={() => router.push("/")}>Home</button>
        </div>
        <div style={styles.divider} />

        {session ? (
          <>
            <div style={styles.sectionLabel}>Active session</div>
            <div style={styles.activeSessionCode}>{session.code}</div>
            <div style={styles.activeSessionMeta}>{session.teams.length} teams · {session.courts} court{session.courts > 1 ? "s" : ""}</div>
            <div style={styles.small}>Stored on this device.</div>
            <div style={{ ...styles.row, marginTop: 14 }}>
              <button style={styles.btnPrimary} onClick={() => router.push("/americano/team/session")}>Open session</button>
              <button style={styles.btnDanger} onClick={discardSession}>Discard session</button>
            </div>
          </>
        ) : (
          <>
            {/* Courts + Points */}
            <div style={styles.sectionLabel}>Match settings</div>
            <div style={styles.settingsGrid}>
              <div style={styles.settingBox}>
                <div style={styles.settingLabel}>Courts</div>
                <div style={styles.stepper}>
                  <button style={styles.stepBtn} onClick={() => setCourts((c) => Math.max(1, c - 1))}>−</button>
                  <div style={styles.stepVal}>{courts}</div>
                  <button style={styles.stepBtn} onClick={() => setCourts((c) => Math.min(6, c + 1))}>+</button>
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
            <div style={styles.small}>Min {minTeams} teams required</div>

            <div style={styles.divider} />

            {/* Serves per rotation */}
            <div style={styles.sectionLabel}>Serves before rotation</div>
            <div style={styles.row}>
              {[2, 4].map((n) => (
                <div key={n} style={serveChipStyle(servesPerRotation === n)} onClick={() => setServesPerRotation(n)}>{n} pts per serve</div>
              ))}
            </div>
            <div style={serveHint.even ? styles.hintEven : styles.hintOdd}>{serveHint.text}</div>
            <div style={styles.small}>Serve order per match: P1(A) → P1(B) → P2(A) → P2(B), cycling every {servesPerRotation} pts.</div>

            <div style={styles.divider} />

            {/* Teams */}
            <div style={styles.sectionLabel}>Teams — enter at least {minTeams}</div>
            <div style={styles.teamsGrid}>
              {teamInputs.map((t, i) => (
                <div key={i} style={styles.teamCard}>
                  <div style={{ fontSize: 12, fontWeight: 1000, opacity: 0.5 }}>Team {i + 1}</div>
                  <input style={styles.input} placeholder="Team name (optional)" value={t.name} onChange={(e) => setTeamField(i, "name", e.target.value)} />
                  <input style={styles.inputSmall} placeholder="Player 1 *" value={t.player1} onChange={(e) => setTeamField(i, "player1", e.target.value)} />
                  <input style={styles.inputSmall} placeholder="Player 2 *" value={t.player2} onChange={(e) => setTeamField(i, "player2", e.target.value)} />
                </div>
              ))}
            </div>
            <div style={styles.small}>Both player names required per team. Team name auto-generated if left blank.</div>

            <div style={{ ...styles.row, marginTop: 16 }}>
              <div style={{ flex: 1 }} />
              <button style={styles.btnPrimary} onClick={createSession}>Create session</button>
            </div>
            {error && <div style={styles.error}>{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}