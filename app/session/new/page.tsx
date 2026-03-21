"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

type Format = "SINGLE" | "MIXED" | "TEAM";
type DeuceMode = "star" | "golden" | "traditional";

function serveDistribution(pts: number): [number, number, number, number] {
  const base = Math.floor(pts / 4);
  const rem = pts % 4;
  return [0, 1, 2, 3].map((i) => base + (i >= 4 - rem ? 1 : 0)) as [number, number, number, number];
}

const DEUCE_OPTIONS: { value: DeuceMode; label: string; desc: string }[] = [
  { value: "star", label: "Star Point", desc: "Two advantages, then deciding point (FIP 2026)" },
  { value: "golden", label: "Golden Point", desc: "Deciding point immediately at first deuce" },
  { value: "traditional", label: "Traditional", desc: "Unlimited advantage until 2-point lead" },
];

export default function NewSessionPage() {
  const router = useRouter();

  const [isMobile, setIsMobile] = useState(false);
  const [format, setFormat] = useState<Format>("MIXED");
  const [courts, setCourts] = useState(2);
  const [pointsPerMatch, setPointsPerMatch] = useState(21);
  const [slotMode, setSlotMode] = useState<"open" | "fixed">("open");
  const [maxTeams, setMaxTeams] = useState(8);
  const [sets, setSets] = useState(3);
  const [deuceMode, setDeuceMode] = useState<DeuceMode>("star");
  const [tiebreak, setTiebreak] = useState(true);
  const [superTiebreak, setSuperTiebreak] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isSingle = format === "SINGLE";
  const isTeam = format === "TEAM";
  const effectiveCourts = isSingle ? 1 : courts;
  const minPlayers = isSingle ? 4 : effectiveCourts * 4;
  const minTeams = effectiveCourts * 2;

  const maxPlayersForAPI = isTeam ? maxTeams * 2 : maxTeams;
  const minSlotsForAPI = isTeam ? minTeams : minPlayers;

  const dist = useMemo(() => serveDistribution(pointsPerMatch), [pointsPerMatch]);
  const serveIsEven = useMemo(() => dist[0] === dist[1] && dist[1] === dist[2] && dist[2] === dist[3], [dist]);

  const singleSummary = useMemo(() => {
    const deuce = DEUCE_OPTIONS.find((d) => d.value === deuceMode)?.label ?? "Star Point";
    const tb = tiebreak ? "Tiebreak at 6-6" : "No tiebreak";
    const st = sets > 1 && superTiebreak ? "Super tiebreak final set" : null;
    return [sets === 1 ? "1 set" : "Best of " + sets, deuce, tb, st].filter(Boolean).join(" · ");
  }, [sets, deuceMode, tiebreak, superTiebreak]);

  async function createSession() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          courts: effectiveCourts,
          pointsPerMatch: isSingle ? 0 : pointsPerMatch,
          servesPerRotation: isSingle ? null : 4,
          maxPlayers: isSingle ? 4 : slotMode === "fixed" ? Math.max(maxPlayersForAPI, minSlotsForAPI) : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Failed to create session."); setLoading(false); return; }

      if (isSingle) {
        localStorage.setItem("eps_match_rules_" + data.code, JSON.stringify({
          sets,
          rules: { deuceMode, tiebreak, superTiebreak: sets === 1 ? false : superTiebreak },
        }));
      }

      const dr = await fetch("/api/sessions/" + data.code + "/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserPin: data.organiserPin }),
      });
      const ddata = await dr.json();
      if (!dr.ok) { setError(ddata.error ?? "Failed to register device."); setLoading(false); return; }

      localStorage.setItem("eps_join_" + data.code, JSON.stringify({ deviceId: ddata.deviceId, isOrganiser: true }));
      localStorage.setItem("eps_pin_" + data.code, data.organiserPin);

      router.push("/session/" + data.code + "/organiser");
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 520, background: NAVY, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", marginTop: 24, marginBottom: 32 },
    titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    title: { fontSize: 22, fontWeight: 1000 },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.6, marginTop: 4, lineHeight: 1.35 },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.45, textTransform: "uppercase" as const, marginTop: 20, marginBottom: 10 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "18px 0" },
    btn: { borderRadius: 14, padding: "12px 14px", fontSize: 14, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    btnPrimary: { width: "100%", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, marginTop: 20 },
    formatGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 },
    settingsGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 },
    settingBox: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 },
    settingLabel: { fontSize: 12, opacity: 0.55, fontWeight: 900, marginBottom: 10 },
    stepper: { display: "flex", alignItems: "center", gap: 14 },
    // ── Swapped: + on left, − on right ──────────────────────────────────────
    stepBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, fontSize: 20, fontWeight: 1000, cursor: "pointer" },
    stepVal: { fontSize: 22, fontWeight: 1100, minWidth: 36, textAlign: "center" as const },
    slotGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 },
    small: { fontSize: 12, opacity: 0.45, marginTop: 6, lineHeight: 1.35 },
    errorBox: { marginTop: 12, background: "rgba(255,64,64,0.10)", border: "1px solid rgba(255,64,64,0.30)", color: WHITE, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 13 },
    hint: { fontSize: 12, opacity: 0.55, marginTop: 10, lineHeight: 1.45, color: WARM_WHITE },
    summaryBar: { marginTop: 12, borderRadius: 12, padding: "10px 14px", background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.18)", fontSize: 12, fontWeight: 900, color: WARM_WHITE },
    pillRow: { display: "flex", gap: 8 },
    deuceGrid: { display: "grid", gap: 8 },
    toggle: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "12px 14px" },
    toggleLabel: { fontWeight: 900, fontSize: 14 },
    toggleDesc: { fontSize: 12, opacity: 0.5, color: WARM_WHITE, marginTop: 3 },
    serveCard: { borderRadius: 14, padding: "14px 16px", background: "rgba(255,107,0,0.10)", border: "1px solid rgba(255,107,0,0.35)", display: "grid", gap: 6 },
  };

  const formatCard = (active: boolean): React.CSSProperties => ({
    borderRadius: 14,
    padding: isMobile ? "12px 14px" : "14px 12px",
    cursor: "pointer", fontWeight: 1000,
    border: "1px solid " + (active ? "rgba(255,107,0,0.55)" : "rgba(255,255,255,0.08)"),
    background: active ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
    display: "flex",
    flexDirection: isMobile ? "row" as const : "column" as const,
    alignItems: isMobile ? "center" as const : "flex-start" as const,
    gap: isMobile ? 10 : 0,
  });

  const slotCard = (active: boolean): React.CSSProperties => ({
    borderRadius: 14, padding: 14, cursor: "pointer",
    border: "1px solid " + (active ? "rgba(255,107,0,0.55)" : "rgba(255,255,255,0.08)"),
    background: active ? "rgba(255,107,0,0.08)" : "rgba(255,255,255,0.04)",
  });

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "13px 14px", borderRadius: 14, cursor: "pointer", fontWeight: active ? 1000 : 900, flex: 1,
    border: active ? "1px solid " + ORANGE : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
    color: active ? WHITE : WARM_WHITE, textAlign: "center" as const, fontSize: 14,
  });

  const deuceCardStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: 14, padding: "12px 14px", cursor: "pointer", display: "grid", gap: 3,
    border: active ? "1px solid " + ORANGE : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
  });

  const effectiveMaxTeams = Math.max(maxTeams, minTeams);

  return (
    <div style={st.page}>
      <div style={st.card}>

        <div style={st.titleRow}>
          <div>
            <div style={st.title}>Create Session</div>
            <div style={st.sub}>Multi-device · Live scoring</div>
          </div>
          <button style={st.btn} onClick={() => router.push("/")}>Home</button>
        </div>

        <div style={st.sectionLabel}>Format</div>
        <div style={st.formatGrid}>
          <div style={formatCard(format === "SINGLE")} onClick={() => setFormat("SINGLE")}>
            <div style={{ fontSize: 14 }}>Single Match</div>
            <div style={{ fontSize: 11, opacity: 0.55, marginTop: isMobile ? 0 : 4 }}>1 court · 4 players</div>
          </div>
          <div style={formatCard(format === "MIXED")} onClick={() => setFormat("MIXED")}>
            <div style={{ fontSize: 14 }}>Mixed Americano</div>
            <div style={{ fontSize: 11, opacity: 0.55, marginTop: isMobile ? 0 : 4 }}>Rotating partners</div>
          </div>
          <div style={formatCard(format === "TEAM")} onClick={() => setFormat("TEAM")}>
            <div style={{ fontSize: 14 }}>Team Americano</div>
            <div style={{ fontSize: 11, opacity: 0.55, marginTop: isMobile ? 0 : 4 }}>Fixed partners</div>
          </div>
        </div>

        <div style={st.divider} />

        {isSingle && (
          <>
            <div style={st.summaryBar}>
              {sets === 1 ? "1 set" : "Best of " + sets} · {singleSummary.split(" · ").slice(1).join(" · ")}
            </div>

            <div style={st.sectionLabel}>Number of sets</div>
            <div style={st.pillRow}>
              {[1, 3, 5].map((n) => (
                <div key={n} style={pillStyle(sets === n)} onClick={() => setSets(n)}>
                  {n === 1 ? "1 set" : "Best of " + n}
                </div>
              ))}
            </div>

            <div style={st.divider} />

            <div style={st.sectionLabel}>Deuce rule</div>
            <div style={st.deuceGrid}>
              {DEUCE_OPTIONS.map((opt) => (
                <div key={opt.value} style={deuceCardStyle(deuceMode === opt.value)} onClick={() => setDeuceMode(opt.value)}>
                  <div style={{ fontSize: 14, fontWeight: 1000 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.55, color: WARM_WHITE }}>{opt.desc}</div>
                </div>
              ))}
            </div>

            <div style={st.divider} />

            <div style={st.sectionLabel}>Tiebreak rules</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={st.toggle}>
                <div>
                  <div style={st.toggleLabel}>Tiebreak at 6-6</div>
                  <div style={st.toggleDesc}>First to 7 points, win by 2</div>
                </div>
                <input type="checkbox" checked={tiebreak} onChange={(e) => setTiebreak(e.target.checked)}
                  style={{ transform: "scale(1.4)", accentColor: ORANGE }} />
              </div>
              <div style={{ ...st.toggle, opacity: sets === 1 ? 0.45 : 1 }}>
                <div>
                  <div style={st.toggleLabel}>Super tiebreak — final set</div>
                  <div style={st.toggleDesc}>{sets === 1 ? "Not applicable for 1 set matches" : "Final set replaced by first to 10, win by 2"}</div>
                </div>
                <input type="checkbox" checked={sets === 1 ? false : superTiebreak}
                  onChange={(e) => setSuperTiebreak(e.target.checked)} disabled={sets === 1}
                  style={{ transform: "scale(1.4)", accentColor: ORANGE }} />
              </div>
            </div>

            <div style={st.hint}>Share the session code with all 4 players. They join at /join and link their device for scoring.</div>
          </>
        )}

        {!isSingle && (
          <>
            <div style={st.sectionLabel}>Match settings</div>
            <div style={st.settingsGrid}>
              <div style={st.settingBox}>
                <div style={st.settingLabel}>Courts</div>
                {/* ── + on left, − on right ── */}
                <div style={st.stepper}>
                  <button style={st.stepBtn} onClick={() => setCourts((c) => Math.min(6, c + 1))}>+</button>
                  <div style={st.stepVal}>{courts}</div>
                  <button style={st.stepBtn} onClick={() => setCourts((c) => Math.max(1, c - 1))}>−</button>
                </div>
              </div>
              <div style={st.settingBox}>
                <div style={st.settingLabel}>Points per match</div>
                <div style={st.stepper}>
                  <button style={st.stepBtn} onClick={() => setPointsPerMatch((p) => Math.min(99, p + 1))}>+</button>
                  <div style={st.stepVal}>{pointsPerMatch}</div>
                  <button style={st.stepBtn} onClick={() => setPointsPerMatch((p) => Math.max(8, p - 1))}>−</button>
                </div>
              </div>
            </div>
            <div style={st.small}>
              {isTeam
                ? "Minimum " + minTeams + " teams needed to start (" + courts + " court" + (courts > 1 ? "s" : "") + " × 2)"
                : "Minimum " + minPlayers + " players needed to start (" + courts + " court" + (courts > 1 ? "s" : "") + " × 4)"}
            </div>

            <div style={st.divider} />

            <div style={st.sectionLabel}>Serve rotation</div>
            <div style={st.serveCard}>
              <div style={{ fontSize: 13, fontWeight: 1000, color: ORANGE, letterSpacing: 0.3 }}>
                A1 → B1 → A2 → B2
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: WHITE }}>
                {serveIsEven
                  ? "Equal serves — each player serves " + dist[0] + " pts"
                  : "A1: " + dist[0] + " pts · B1: " + dist[1] + " pts · A2: " + dist[2] + " pts · B2: " + dist[3] + " pts"}
              </div>
            </div>
            <div style={st.small}>Totals adjust automatically with points per match.</div>

            <div style={st.divider} />

            <div style={st.sectionLabel}>Player slots</div>
            <div style={st.slotGrid}>
              <div style={slotCard(slotMode === "open")} onClick={() => setSlotMode("open")}>
                <div style={{ fontWeight: 1000, fontSize: 14 }}>Open</div>
                <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4, lineHeight: 1.35 }}>Anyone with the code can join until you lock entries</div>
              </div>
              <div style={slotCard(slotMode === "fixed")} onClick={() => setSlotMode("fixed")}>
                <div style={{ fontWeight: 1000, fontSize: 14 }}>Fixed slots</div>
                <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4, lineHeight: 1.35 }}>First come first served — closes when full</div>
              </div>
            </div>
            {slotMode === "fixed" && (
              <div style={{ ...st.settingBox, marginTop: 10 }}>
                <div style={st.settingLabel}>{isTeam ? "Max teams" : "Max players"}</div>
                <div style={st.stepper}>
                  <button style={st.stepBtn} onClick={() => setMaxTeams((n) => Math.min(isTeam ? 32 : 64, n + 1))}>+</button>
                  <div style={st.stepVal}>{effectiveMaxTeams}</div>
                  <button style={st.stepBtn} onClick={() => setMaxTeams((n) => Math.max(isTeam ? minTeams : minPlayers, n - 1))}>−</button>
                </div>
                <div style={{ ...st.small, marginTop: 8 }}>
                  Min {isTeam ? minTeams : minPlayers} · Max {isTeam ? 32 : 64}
                </div>
              </div>
            )}
            <div style={st.hint}>Players join at /join using the session code. You can also add them manually from the organiser view.</div>
          </>
        )}

        <button style={{ ...st.btnPrimary, opacity: loading ? 0.5 : 1 }} onClick={createSession} disabled={loading}>
          {loading ? "Creating…" : "Create Session"}
        </button>
        {error && <div style={st.errorBox}>{error}</div>}
      </div>
    </div>
  );
}