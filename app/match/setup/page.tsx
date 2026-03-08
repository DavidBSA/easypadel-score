"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const STORAGE_PLAYERS_KEY = "eps_players";
const STORAGE_MATCH_KEY = "eps_match_payload";

type DeuceMode = "star" | "golden" | "traditional";

type MatchRules = {
  deuceMode: DeuceMode;
  tiebreak: boolean;
  superTiebreak: boolean;
};

type MatchPayload = {
  sessionCode: string;
  players: { slot: string; name: string }[];
  sets: number;
  rules: MatchRules;
};

function safeParseJSON<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `EPSSM-${date}-${suffix}`;
}

const SLOTS = [
  { key: "teamA1", label: "Team A — Player 1" },
  { key: "teamA2", label: "Team A — Player 2" },
  { key: "teamB1", label: "Team B — Player 1" },
  { key: "teamB2", label: "Team B — Player 2" },
];

const DEUCE_OPTIONS: { value: DeuceMode; label: string; desc: string }[] = [
  { value: "star", label: "Star Point", desc: "Two advantages, then deciding point (FIP 2026)" },
  { value: "golden", label: "Golden Point", desc: "Deciding point immediately at first deuce" },
  { value: "traditional", label: "Traditional", desc: "Unlimited advantage until 2-point lead" },
];

export default function MatchSetupPage() {
  const router = useRouter();

  const [savedPlayers, setSavedPlayers] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({
    teamA1: "", teamA2: "", teamB1: "", teamB2: "",
  });
  const [sets, setSets] = useState<number>(3);
  const [deuceMode, setDeuceMode] = useState<DeuceMode>("star");
  const [tiebreak, setTiebreak] = useState<boolean>(true);
  const [superTiebreak, setSuperTiebreak] = useState<boolean>(true);
  const [newPlayerName, setNewPlayerName] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const initial = safeParseJSON<string[]>(localStorage.getItem(STORAGE_PLAYERS_KEY), []);
    const cleaned = Array.from(new Set(initial.map(normalizeName).filter(Boolean)));
    setSavedPlayers(cleaned);
    if (cleaned.length >= 4) {
      setSelected({ teamA1: cleaned[0], teamA2: cleaned[1], teamB1: cleaned[2], teamB2: cleaned[3] });
    }
  }, []);

  const canStart = useMemo(() => {
    const names = Object.values(selected).map(normalizeName).filter(Boolean);
    return names.length === 4 && new Set(names).size === 4;
  }, [selected]);

  const rulesSummary = useMemo(() => {
    const deuce = DEUCE_OPTIONS.find((d) => d.value === deuceMode)?.label ?? "Star Point";
    const tb = tiebreak ? "Tiebreak at 6-6" : "No tiebreak";
    const st = sets > 1 && superTiebreak ? "Super tiebreak final set" : null;
    return [deuce, tb, st].filter(Boolean).join(" · ");
  }, [deuceMode, tiebreak, superTiebreak, sets]);

  function updateSelected(slot: string, value: string) {
    setError("");
    setSelected((prev) => ({ ...prev, [slot]: value }));
  }

  function addPlayer() {
    const name = normalizeName(newPlayerName);
    if (!name) return;
    setError("");
    setSavedPlayers((prev) => {
      const next = Array.from(new Set([...prev, name]));
      localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(next));
      return next;
    });
    setNewPlayerName("");
  }

  function startMatch() {
    const names = Object.values(selected).map(normalizeName).filter(Boolean);
    if (names.length !== 4) { setError("Please select all 4 players."); return; }
    if (new Set(names).size !== 4) { setError("All 4 players must be different."); return; }

    const payload: MatchPayload = {
      sessionCode: makeCode(),
      players: SLOTS.map((s) => ({ slot: s.key, name: normalizeName(selected[s.key]) })),
      sets,
      rules: {
        deuceMode,
        tiebreak,
        superTiebreak: sets === 1 ? false : superTiebreak,
      },
    };

    localStorage.setItem(STORAGE_MATCH_KEY, JSON.stringify(payload));
    router.push("/match");
  }

  // ─── Dynamic style helpers ────────────────────────────────────────────────

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "13px 14px",
    borderRadius: 14,
    border: active ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
    color: active ? WHITE : WARM_WHITE,
    fontWeight: active ? 1000 : 900,
    cursor: "pointer",
    userSelect: "none" as const,
    flex: 1,
    textAlign: "center" as const,
    fontSize: 14,
  });

  const deuceCardStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: 14,
    padding: "12px 14px",
    border: active ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
    cursor: "pointer",
    display: "grid",
    gap: 3,
  });

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: BLACK,
      color: WHITE,
      padding: 16,
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
    },
    card: {
      width: "100%",
      maxWidth: 520,
      background: NAVY,
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20,
      padding: 18,
      boxShadow: "0 12px 40px rgba(0,0,0,0.50)",
      marginTop: 12,
      marginBottom: 32,
    },
    titleRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    title: { fontSize: 22, fontWeight: 1000 },
    subtitle: { color: WARM_WHITE, opacity: 0.6, fontSize: 13, marginTop: 5 },
    summaryBar: {
      marginTop: 12,
      borderRadius: 12,
      padding: "10px 14px",
      background: "rgba(255,107,0,0.07)",
      border: "1px solid rgba(255,107,0,0.18)",
      fontSize: 12,
      fontWeight: 900,
      color: WARM_WHITE,
      opacity: 0.9,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: 1000,
      letterSpacing: 1.4,
      opacity: 0.45,
      textTransform: "uppercase" as const,
      marginTop: 20,
      marginBottom: 10,
    },
    playerGrid: { display: "grid", gap: 10 },
    playerRow: { display: "grid", gap: 5 },
    playerLabel: { fontSize: 12, fontWeight: 1000, opacity: 0.55, letterSpacing: 0.3 },
    select: {
      width: "100%",
      background: "rgba(255,255,255,0.07)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12,
      padding: "14px 12px",
      fontSize: 16,
      outline: "none",
      fontWeight: 900,
    },
    teamDivider: {
      height: 1,
      background: "rgba(255,107,0,0.15)",
      margin: "4px 0",
    },
    addRow: { display: "flex", gap: 10, alignItems: "center" },
    input: {
      flex: 1,
      background: "rgba(255,255,255,0.07)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12,
      padding: "14px 12px",
      fontSize: 16,
      outline: "none",
      fontWeight: 900,
    },
    addBtn: {
      borderRadius: 12,
      padding: "14px 16px",
      fontSize: 15,
      fontWeight: 1000,
      cursor: "pointer",
      border: "none",
      background: ORANGE,
      color: WHITE,
      whiteSpace: "nowrap" as const,
    },
    pillRow: { display: "flex", gap: 8 },
    deuceGrid: { display: "grid", gap: 8 },
    deuceLabel: { fontSize: 14, fontWeight: 1000 },
    deuceDesc: { fontSize: 12, opacity: 0.55, color: WARM_WHITE },
    toggle: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 14,
      padding: "12px 14px",
    },
    toggleLabel: { fontWeight: 900, fontSize: 14 },
    toggleDesc: { fontSize: 12, opacity: 0.5, color: WARM_WHITE, marginTop: 3 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" },
    startBtn: {
      width: "100%",
      background: ORANGE,
      color: WHITE,
      border: "none",
      borderRadius: 16,
      padding: "18px 14px",
      fontSize: 18,
      fontWeight: 1000,
      cursor: "pointer",
      marginTop: 20,
      letterSpacing: 0.3,
    },
    backBtn: {
      borderRadius: 14,
      padding: "12px 14px",
      fontSize: 15,
      fontWeight: 950,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.07)",
      color: WHITE,
      whiteSpace: "nowrap" as const,
    },
    small: { fontSize: 12, color: WARM_WHITE, opacity: 0.5, marginTop: 6, lineHeight: 1.35 },
    error: {
      marginTop: 12,
      background: "rgba(255,64,64,0.10)",
      border: "1px solid rgba(255,64,64,0.30)",
      color: WHITE,
      padding: 12,
      borderRadius: 12,
      fontWeight: 900,
      fontSize: 13,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* ── Header ── */}
        <div style={styles.titleRow}>
          <div>
            <div style={styles.title}>Match Setup</div>
            <div style={styles.subtitle}>4 players · Pick rules · Start scoring</div>
          </div>
          <button style={styles.backBtn} onClick={() => router.push("/")}>Home</button>
        </div>

        <div style={styles.summaryBar}>
          {sets === 1 ? "1 set" : `Best of ${sets}`} · {rulesSummary}
        </div>

        {/* ── Players ── */}
        <div style={styles.sectionLabel}>Players</div>
        <div style={styles.playerGrid}>
          {SLOTS.map((slot, i) => (
            <React.Fragment key={slot.key}>
              {i === 2 && <div style={styles.teamDivider} />}
              <div style={styles.playerRow}>
                <div style={styles.playerLabel}>{slot.label}</div>
                <select
                  style={styles.select}
                  value={selected[slot.key]}
                  onChange={(e) => updateSelected(slot.key, e.target.value)}
                >
                  <option value="">Select player</option>
                  {savedPlayers.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* ── Add player ── */}
        <div style={styles.sectionLabel}>Add new player</div>
        <div style={styles.addRow}>
          <input
            style={styles.input}
            value={newPlayerName}
            placeholder="Player name"
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addPlayer(); }}
          />
          <button style={styles.addBtn} onClick={addPlayer}>Add</button>
        </div>
        <div style={styles.small}>Names saved locally and reused across matches and sessions.</div>

        <div style={styles.divider} />

        {/* ── Sets ── */}
        <div style={styles.sectionLabel}>Number of sets</div>
        <div style={styles.pillRow}>
          {[1, 3, 5].map((n) => (
            <div key={n} style={pillStyle(sets === n)} onClick={() => setSets(n)}>
              {n === 1 ? "1 set" : `Best of ${n}`}
            </div>
          ))}
        </div>

        <div style={styles.divider} />

        {/* ── Deuce mode ── */}
        <div style={styles.sectionLabel}>Deuce rule</div>
        <div style={styles.deuceGrid}>
          {DEUCE_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              style={deuceCardStyle(deuceMode === opt.value)}
              onClick={() => setDeuceMode(opt.value)}
            >
              <div style={styles.deuceLabel}>{opt.label}</div>
              <div style={styles.deuceDesc}>{opt.desc}</div>
            </div>
          ))}
        </div>

        <div style={styles.divider} />

        {/* ── Tiebreak toggles ── */}
        <div style={styles.sectionLabel}>Tiebreak rules</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={styles.toggle}>
            <div>
              <div style={styles.toggleLabel}>Tiebreak at 6-6</div>
              <div style={styles.toggleDesc}>First to 7 points, win by 2</div>
            </div>
            <input
              type="checkbox"
              checked={tiebreak}
              onChange={(e) => setTiebreak(e.target.checked)}
              style={{ transform: "scale(1.4)", accentColor: ORANGE }}
              aria-label="Tiebreak at 6-6"
            />
          </div>

          <div style={{ ...styles.toggle, opacity: sets === 1 ? 0.45 : 1 }}>
            <div>
              <div style={styles.toggleLabel}>Super tiebreak — final set</div>
              <div style={styles.toggleDesc}>
                {sets === 1
                  ? "Not applicable for 1 set matches"
                  : "Final set replaced by first to 10, win by 2"}
              </div>
            </div>
            <input
              type="checkbox"
              checked={sets === 1 ? false : superTiebreak}
              onChange={(e) => setSuperTiebreak(e.target.checked)}
              disabled={sets === 1}
              style={{ transform: "scale(1.4)", accentColor: ORANGE }}
              aria-label="Super tiebreak final set"
            />
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* ── Start ── */}
        <button
          style={{ ...styles.startBtn, opacity: canStart ? 1 : 0.4 }}
          onClick={startMatch}
          disabled={!canStart}
        >
          Start match →
        </button>

      </div>
    </div>
  );
}