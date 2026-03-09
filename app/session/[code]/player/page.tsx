"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";
const GREEN = "#00C851";

type Player = { id: string; name: string; isActive: boolean };
type ScoreSubmission = { id: string; deviceId: string; pointsA: number; pointsB: number };
type Match = {
  id: string;
  courtNumber: number | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE";
  teamAPlayer1: string; teamAPlayer2: string;
  teamBPlayer1: string; teamBPlayer2: string;
  pointsA: number | null; pointsB: number | null;
  scoreStatus: "PENDING" | "CONFIRMED" | "CONFLICT" | null;
  scoreSubmissions: ScoreSubmission[];
};
type Session = {
  code: string; format: string; status: string;
  courts: number; pointsPerMatch: number;
  players: Player[]; matches: Match[];
};

type ScoringMode = "final" | "live";

function chipStyle(active: boolean): React.CSSProperties {
  return {
    borderRadius: 14, padding: "12px 14px",
    background: active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
    border: active ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.10)",
    cursor: "pointer", fontWeight: 900, fontSize: 14, color: WHITE,
  };
}

function modeTabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 1000, cursor: "pointer",
    border: "none", borderRadius: 10,
    background: active ? ORANGE : "transparent",
    color: active ? WHITE : WARM_WHITE,
    opacity: active ? 1 : 0.55,
    transition: "background 0.15s",
  };
}

function statusBoxStyle(color: string): React.CSSProperties {
  return {
    borderRadius: 18, padding: "24px 20px",
    background: color + "12",
    border: `1px solid ${color}30`,
    textAlign: "center" as const,
  };
}

export default function PlayerPage() {
  const params = useParams();
  const code = (Array.isArray(params?.code) ? params.code[0] : params?.code ?? "") as string;
  const router = useRouter();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");

  // Scoring state
  const [scoringMode, setScoringMode] = useState<ScoringMode>("final");
  // Final mode: player enters their team's score only
  const [myScore, setMyScore] = useState<string>("");
  // Live mode: both scores via steppers
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!code) return;
    try {
      const stored = localStorage.getItem(`eps_join_${code}`);
      if (stored) { const { deviceId: did } = JSON.parse(stored); if (did) setDeviceId(did); }
    } catch { /* ignore */ }
    try {
      const ps = localStorage.getItem(`eps_player_${code}`);
      if (ps) setSelectedPlayer(JSON.parse(ps));
    } catch { /* ignore */ }
    setBootstrapped(true);
  }, [code]);

  const applySession = useCallback((data: Session) => setSession(data), []);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/sessions/${code}`).then((r) => r.json()).then(applySession).catch(() => {});
    const es = new EventSource(`/api/sessions/${code}/stream`);
    esRef.current = es;
    es.onmessage = (e) => { try { applySession(JSON.parse(e.data)); } catch { /* ignore */ } };
    es.onerror = () => {
      es.close();
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          fetch(`/api/sessions/${code}`).then((r) => r.json()).then(applySession).catch(() => {});
        }, 3000);
      }
    };
    return () => {
      es.close();
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [code, applySession]);

  async function claimPlayer(p: Player) {
    setClaiming(true); setClaimError("");
    try {
      const r = await fetch(`/api/sessions/${code}/devices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: p.id }),
      });
      const data = await r.json();
      if (!r.ok) { setClaimError(data.error ?? "Could not register device."); setClaiming(false); return; }
      const did = data.deviceId;
      setDeviceId(did);
      localStorage.setItem(`eps_join_${code}`, JSON.stringify({ deviceId: did, isOrganiser: false }));
      localStorage.setItem(`eps_player_${code}`, JSON.stringify(p));
      setSelectedPlayer(p);
    } catch { setClaimError("Network error. Please try again."); }
    setClaiming(false);
  }

  function changeName() {
    localStorage.removeItem(`eps_player_${code}`);
    localStorage.removeItem(`eps_join_${code}`);
    setSelectedPlayer(null); setDeviceId(null);
    setSubmitResult(null); setClaimError("");
  }

  async function submitScore() {
    if (!deviceId || !myMatch || !myTeam) return;
    setSubmitting(true); setSubmitError(""); setSubmitResult(null);

    let pA: number; let pB: number;
    const total = session?.pointsPerMatch ?? 21;

    if (scoringMode === "final") {
      const mine = parseInt(myScore, 10);
      if (isNaN(mine) || mine < 0 || mine > total) {
        setSubmitError(`Enter a valid score between 0 and ${total}.`);
        setSubmitting(false); return;
      }
      pA = myTeam === "A" ? mine : total - mine;
      pB = myTeam === "B" ? mine : total - mine;
    } else {
      pA = scoreA; pB = scoreB;
    }

    try {
      const r = await fetch(`/api/matches/${myMatch.id}/score`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, pointsA: pA, pointsB: pB }),
      });
      const data = await r.json();
      if (!r.ok) { setSubmitError(data.error ?? "Failed to submit."); setSubmitting(false); return; }
      setSubmitResult(data.result);
    } catch { setSubmitError("Network error."); }
    setSubmitting(false);
  }

  // Derived
  const myMatch = (selectedPlayer && session)
    ? session.matches.find((m) =>
        (m.status === "IN_PROGRESS" || m.status === "COMPLETE") &&
        [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].includes(selectedPlayer.id)
      )
    : undefined;

  const myTeam: "A" | "B" | null = (myMatch && selectedPlayer)
    ? ([myMatch.teamAPlayer1, myMatch.teamAPlayer2].includes(selectedPlayer.id) ? "A" : "B")
    : null;

  const alreadySubmitted = !!(myMatch && deviceId && myMatch.scoreSubmissions.some((s) => s.deviceId === deviceId));
  const nameById = (session?.players ?? []).reduce<Record<string, string>>((m, p) => { m[p.id] = p.name; return m; }, {});
  const total = session?.pointsPerMatch ?? 21;

  // Derived other-team score for final mode display
  const myScoreNum = parseInt(myScore, 10);
  const otherScore = (!isNaN(myScoreNum) && myScoreNum >= 0 && myScoreNum <= total) ? total - myScoreNum : null;

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 480, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", marginTop: 12 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
    title: { fontSize: 22, fontWeight: 1000 },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4, lineHeight: 1.4 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 0" },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 16, marginBottom: 10 },
    btn: { borderRadius: 14, padding: "10px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE },
    grid2: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0,1fr))" },
    bigNum: { fontSize: 56, fontWeight: 1200, letterSpacing: 0, lineHeight: 1 },
    stepBtn: { width: 52, height: 52, borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 26, fontWeight: 1000, cursor: "pointer" },
    scoreRow: { display: "flex", alignItems: "center", gap: 14, justifyContent: "center", margin: "8px 0" },
    primaryBtn: { width: "100%", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, marginTop: 14 },
    errorBox: { marginTop: 10, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    successBox: { marginTop: 10, background: "rgba(0,200,80,0.10)", border: "1px solid rgba(0,200,80,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    modeToggle: { display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 4, marginBottom: 14 },
    scoreInput: { width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.20)", borderRadius: 14, padding: "16px 12px", fontSize: 48, fontWeight: 1200, textAlign: "center" as const, outline: "none", boxSizing: "border-box" as const, lineHeight: 1 },
    autoScore: { textAlign: "center" as const, borderRadius: 14, padding: "16px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 48, fontWeight: 1200, lineHeight: 1, color: WARM_WHITE, opacity: 0.4 },
    teamLabel: { fontWeight: 1000, fontSize: 13, opacity: 0.75, marginBottom: 8, textAlign: "center" as const },
    hint: { fontSize: 12, color: WARM_WHITE, opacity: 0.5, textAlign: "center" as const, marginTop: 8, lineHeight: 1.4 },
  };

  if (!bootstrapped) {
    return <div style={st.page}><div style={st.card}><div style={{ opacity: 0.7 }}>Loading…</div></div></div>;
  }

  // Name picker
  if (!selectedPlayer) {
    return (
      <div style={st.page}>
        <div style={st.card}>
          <button style={{ ...st.btn, marginBottom: 14 }} onClick={() => router.push("/")}>← Home</button>
          <div style={st.title}>Who are you?</div>
          <div style={{ ...st.sub, marginBottom: 4 }}>
            Tap your name to claim your spot. If you haven't joined yet,{" "}
            <span style={{ color: ORANGE, cursor: "pointer", fontWeight: 1000 }} onClick={() => router.push(`/join?code=${code}`)}>
              join with the session code
            </span>.
          </div>
          {!session ? (
            <div style={{ opacity: 0.6, marginTop: 14, fontWeight: 900 }}>Loading player list…</div>
          ) : (
            <>
              <div style={st.sectionLabel}>Session {code} — tap your name</div>
              <div style={st.grid2}>
                {session.players.map((p) => (
                  <div key={p.id} style={{ ...chipStyle(false), opacity: claiming ? 0.5 : 1 }}
                    onClick={() => { if (!claiming) claimPlayer(p); }}>
                    {p.name}
                  </div>
                ))}
              </div>
              {claimError && <div style={st.errorBox}>{claimError}</div>}
            </>
          )}
        </div>
      </div>
    );
  }

  // Main player view
  let statusBlock: React.ReactNode;

  if (!myMatch) {
    statusBlock = (
      <div style={statusBoxStyle(WARM_WHITE)}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
        <div style={{ fontWeight: 1000, fontSize: 20 }}>Waiting</div>
        <div style={{ opacity: 0.6, marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
          The organiser will assign you to a court soon.
        </div>
      </div>
    );
  } else if (myMatch.status === "COMPLETE" || myMatch.scoreStatus === "CONFIRMED") {
    const pA = myMatch.pointsA ?? 0; const pB = myMatch.pointsB ?? 0;
    const mine = myTeam === "A" ? pA : pB;
    const theirs = myTeam === "A" ? pB : pA;
    const won = mine > theirs;
    statusBlock = (
      <div style={statusBoxStyle(won ? GREEN : ORANGE)}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{won ? "🏆" : "🎾"}</div>
        <div style={{ fontWeight: 1000, fontSize: 20 }}>Match complete</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "baseline", margin: "14px 0" }}>
          <span style={{ ...st.bigNum, color: myTeam === "A" ? ORANGE : WARM_WHITE }}>{pA}</span>
          <span style={{ opacity: 0.35, fontWeight: 900, fontSize: 24 }}>—</span>
          <span style={{ ...st.bigNum, color: myTeam === "B" ? ORANGE : WARM_WHITE }}>{pB}</span>
        </div>
        <div style={{ opacity: 0.6, fontSize: 13 }}>
          {won ? `You won ${mine}–${theirs}` : mine === theirs ? "It's a draw!" : `You scored ${mine}`}
        </div>
      </div>
    );
  } else if (myMatch.status === "IN_PROGRESS") {
    const a1 = nameById[myMatch.teamAPlayer1]; const a2 = nameById[myMatch.teamAPlayer2];
    const b1 = nameById[myMatch.teamBPlayer1]; const b2 = nameById[myMatch.teamBPlayer2];

    if (myMatch.scoreStatus === "CONFLICT") {
      statusBlock = (
        <div style={statusBoxStyle(ORANGE)}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Score conflict</div>
          <div style={{ opacity: 0.65, marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
            The submitted scores don't match.<br />The organiser is resolving this.
          </div>
        </div>
      );
    } else if (alreadySubmitted || submitResult === "PENDING") {
      const pA = myMatch.pointsA ?? 0; const pB = myMatch.pointsB ?? 0;
      statusBlock = (
        <div style={statusBoxStyle(GREEN)}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Score submitted</div>
          <div style={{ fontSize: 32, fontWeight: 1200, margin: "12px 0", opacity: 0.9 }}>{pA} — {pB}</div>
          <div style={{ opacity: 0.65, marginTop: 4, fontSize: 14 }}>Awaiting organiser confirmation.</div>
        </div>
      );
    } else if (submitResult === "CONFIRMED") {
      const pA = myMatch.pointsA ?? 0; const pB = myMatch.pointsB ?? 0;
      const mine = myTeam === "A" ? pA : pB;
      const theirs = myTeam === "A" ? pB : pA;
      statusBlock = (
        <div style={statusBoxStyle(GREEN)}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Match confirmed!</div>
          <div style={{ fontSize: 32, fontWeight: 1200, margin: "12px 0" }}>{pA} — {pB}</div>
          <div style={{ opacity: 0.6, fontSize: 13 }}>{mine > theirs ? `You won ${mine}–${theirs}` : mine === theirs ? "Draw!" : `You scored ${mine}`}</div>
        </div>
      );
    } else {
      // Score entry UI
      statusBlock = (
        <>
          {/* Court info */}
          <div style={statusBoxStyle(ORANGE)}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>🎾</div>
            <div style={{ fontWeight: 1000, fontSize: 22 }}>Court {myMatch.courtNumber}</div>
            <div style={{ opacity: 0.65, marginTop: 6, fontSize: 13 }}>
              {a1} & {a2} <span style={{ opacity: 0.5 }}>vs</span> {b1} & {b2}
            </div>
          </div>

          <div style={st.sectionLabel}>Enter score</div>

          {/* Mode toggle */}
          <div style={st.modeToggle}>
            <button style={modeTabStyle(scoringMode === "final")} onClick={() => setScoringMode("final")}>
              Final score
            </button>
            <button style={modeTabStyle(scoringMode === "live")} onClick={() => setScoringMode("live")}>
              Live scoring
            </button>
          </div>

          {scoringMode === "final" ? (
            /* ── Final score mode ── */
            <>
              <div style={st.grid2}>
                <div>
                  <div style={st.teamLabel}>Your team{myTeam ? ` (Team ${myTeam})` : ""}</div>
                  <input
                    style={st.scoreInput}
                    inputMode="numeric"
                    placeholder="0"
                    value={myScore}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "");
                      setMyScore(v);
                    }}
                  />
                </div>
                <div>
                  <div style={st.teamLabel}>Opponents</div>
                  <div style={st.autoScore}>
                    {otherScore !== null ? otherScore : "—"}
                  </div>
                </div>
              </div>
              <div style={st.hint}>
                Enter your team's points — opponents auto-calculated from {total} total.
              </div>
            </>
          ) : (
            /* ── Live scoring mode ── */
            <>
              <div style={st.grid2}>
                <div style={{ textAlign: "center" as const }}>
                  <div style={st.teamLabel}>Team A{myTeam === "A" ? " · You" : ""}</div>
                  <div style={st.scoreRow}>
                    <button style={st.stepBtn} onClick={() => setScoreA((v) => Math.max(0, v - 1))}>−</button>
                    <div style={st.bigNum}>{scoreA}</div>
                    <button style={st.stepBtn} onClick={() => setScoreA((v) => v + 1)}>+</button>
                  </div>
                </div>
                <div style={{ textAlign: "center" as const }}>
                  <div style={st.teamLabel}>Team B{myTeam === "B" ? " · You" : ""}</div>
                  <div style={st.scoreRow}>
                    <button style={st.stepBtn} onClick={() => setScoreB((v) => Math.max(0, v - 1))}>−</button>
                    <div style={st.bigNum}>{scoreB}</div>
                    <button style={st.stepBtn} onClick={() => setScoreB((v) => v + 1)}>+</button>
                  </div>
                </div>
              </div>
              <div style={st.hint}>
                {scoreA + scoreB} of {total} pts played. If another device also scores, both must match to confirm.
              </div>
            </>
          )}

          <button
            style={{ ...st.primaryBtn, opacity: submitting ? 0.5 : 1 }}
            onClick={submitScore}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit final score"}
          </button>

          {submitError && <div style={st.errorBox}>{submitError}</div>}
        </>
      );
    }
  }

  return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={st.row}>
          <div>
            <div style={st.title}>Hi, {selectedPlayer.name}</div>
            <div style={st.sub}>Session {code}</div>
          </div>
          <button style={st.btn} onClick={changeName}>Change name</button>
        </div>
        <div style={st.divider} />
        {statusBlock}
      </div>
    </div>
  );
}