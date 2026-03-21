"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const BLACK = "#000000";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";
const GREEN = "#00C851";

const STORAGE_SESSION_KEY = "eps_session_active";

type AmericanoSession = { code: string };
type ResumeSession = {
  code: string;
  isOrganiser: boolean;
  playerName: string | null;
};

function safeParseJSON<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function findResumeSessions(): ResumeSession[] {
  const results: ResumeSession[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("eps_join_")) continue;
      const code = key.replace("eps_join_", "").toUpperCase();
      if (code.length !== 4) continue;
      const joinData = safeParseJSON<{ deviceId?: string; isOrganiser?: boolean } | null>(
        localStorage.getItem(key), null
      );
      if (!joinData?.deviceId) continue;
      const isOrganiser = joinData.isOrganiser === true;
      let playerName: string | null = null;
      if (!isOrganiser) {
        const playerData = safeParseJSON<{ id?: string; name?: string } | null>(
          localStorage.getItem(`eps_player_${code}`), null
        );
        playerName = playerData?.name ?? null;
      }
      results.push({ code, isOrganiser, playerName });
    }
  } catch { /* ignore */ }
  return results;
}

const USP_ITEMS = [
  { icon: "🎾", text: "Mixed, Team or Single format" },
  { icon: "📲", text: "Invite friends via link or QR code" },
  { icon: "📱", text: "Every player scores from their own phone" },
  { icon: "📊", text: "Live leaderboard updates in real time" },
  { icon: "⚡", text: "Auto match progression — courts assigned and queues managed automatically" },
];

export default function HomePage() {
  const router = useRouter();
  const [hasLocalSession, setHasLocalSession] = useState(false);
  const [resumeSessions, setResumeSessions] = useState<ResumeSession[]>([]);

  useEffect(() => {
    const s = safeParseJSON<AmericanoSession | null>(
      localStorage.getItem(STORAGE_SESSION_KEY), null
    );
    setHasLocalSession(Boolean(s?.code));
    setResumeSessions(findResumeSessions());
  }, []);

  function clearResume(code: string) {
    localStorage.removeItem(`eps_join_${code}`);
    localStorage.removeItem(`eps_player_${code}`);
    localStorage.removeItem(`eps_pin_${code}`);
    setResumeSessions((prev) => prev.filter((s) => s.code !== code));
  }

  const st: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: BLACK,
      color: WHITE,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 400,
      display: "grid",
      gap: 12,
      textAlign: "center",
    },
    logoWrap: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 8,
    },
    appName: {
      fontSize: 26,
      fontWeight: 1000,
      letterSpacing: 0.6,
      color: WHITE,
    },
    subtitle: {
      fontSize: 13,
      color: WARM_WHITE,
      opacity: 0.55,
      marginTop: -4,
      fontWeight: 800,
      letterSpacing: 0.3,
    },
    divider: {
      height: 1,
      background: "rgba(255,255,255,0.18)",
      margin: "4px 0",
    },
    btnPrimary: {
      borderRadius: 18,
      padding: 0,
      fontSize: 16,
      fontWeight: 1000,
      cursor: "pointer",
      border: "none",
      background: ORANGE,
      color: WHITE,
      width: "100%",
      textAlign: "left" as const,
    },
    btnGhost: {
      borderRadius: 18,
      padding: 0,
      fontSize: 16,
      fontWeight: 950,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.05)",
      color: WARM_WHITE,
      width: "100%",
      textAlign: "left" as const,
    },
    btnInner: {
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column" as const,
      gap: 3,
    },
    btnTitle: {
      fontSize: 17,
      fontWeight: 1000,
      letterSpacing: 0.2,
    },
    btnSub: {
      fontSize: 12,
      fontWeight: 800,
      opacity: 0.65,
      letterSpacing: 0.2,
    },
    sessionBadge: {
      display: "inline-block",
      marginLeft: 8,
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 11,
      fontWeight: 1000,
      border: "1px solid rgba(255,107,0,0.45)",
      background: "rgba(255,107,0,0.15)",
      color: ORANGE,
      verticalAlign: "middle",
    },
    helpRow: {
      display: "flex",
      justifyContent: "center",
      paddingTop: 4,
    },
    btnHelp: {
      borderRadius: 999,
      padding: "8px 20px",
      fontSize: 12,
      fontWeight: 1000,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.35)",
      background: "rgba(255,255,255,0.07)",
      color: "rgba(255,255,255,0.75)",
      letterSpacing: 0.8,
    },
    resumeCard: {
      borderRadius: 18,
      padding: 0,
      border: `1px solid ${GREEN}40`,
      background: `${GREEN}0D`,
      overflow: "hidden",
    },
    resumeInner: {
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    resumeLeft: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "flex-start",
      gap: 3,
      flex: 1,
      minWidth: 0,
    },
    resumeLabel: {
      fontSize: 11,
      fontWeight: 1000,
      letterSpacing: 1.2,
      opacity: 0.55,
      textTransform: "uppercase" as const,
    },
    resumeCode: {
      fontSize: 20,
      fontWeight: 1100,
      color: GREEN,
      letterSpacing: 2,
    },
    resumeWho: {
      fontSize: 12,
      fontWeight: 900,
      opacity: 0.65,
    },
    resumeButtons: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 6,
      flexShrink: 0,
    },
    resumeBtn: {
      borderRadius: 12,
      padding: "9px 16px",
      fontSize: 13,
      fontWeight: 1000,
      cursor: "pointer",
      border: "none",
      background: GREEN,
      color: WHITE,
      whiteSpace: "nowrap" as const,
    },
    resumeDismiss: {
      borderRadius: 12,
      padding: "7px 16px",
      fontSize: 12,
      fontWeight: 900,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "transparent",
      color: "rgba(255,255,255,0.35)",
      whiteSpace: "nowrap" as const,
    },
  };

  return (
    <div style={st.page}>
      <div style={st.card}>

        {/* Logo */}
        <div style={st.logoWrap}>
          <Image
            src="/eps-logo.png"
            alt="EasyPadelScore"
            width={120}
            height={70}
            priority
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* Title */}
        <div>
          <div style={st.appName}>EasyPadelScore</div>
          <div style={st.subtitle}>Fast scoring for casual padel</div>
        </div>

        <div style={st.divider} />

        {/* ── Resume session banners ── */}
        {resumeSessions.map((s) => (
          <div key={s.code} style={st.resumeCard}>
            <div style={st.resumeInner}>
              <div style={st.resumeLeft}>
                <div style={st.resumeLabel}>Resume session</div>
                <div style={st.resumeCode}>{s.code}</div>
                <div style={st.resumeWho}>
                  {s.isOrganiser ? "Organiser" : s.playerName ? `Playing as ${s.playerName}` : "Player"}
                </div>
              </div>
              <div style={st.resumeButtons}>
                <button
                  style={st.resumeBtn}
                  onClick={() =>
                    router.push(
                      s.isOrganiser
                        ? `/session/${s.code}/organiser`
                        : `/session/${s.code}/player`
                    )
                  }
                >
                  Rejoin →
                </button>
                <button style={st.resumeDismiss} onClick={() => clearResume(s.code)}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* ── Start Match ── */}
        <button style={st.btnPrimary} onClick={() => router.push("/match/setup")}>
          <div style={st.btnInner}>
            <div style={st.btnTitle}>Start Match</div>
            <div style={st.btnSub}>One device · no sign-up needed</div>
          </div>
        </button>

        <div style={st.divider} />

        {/* ── Create Session — hero block ── */}
        <button
          style={{
            ...st.btnPrimary,
            background: "linear-gradient(135deg, #FF6B00 0%, #E05500 100%)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 4px 24px rgba(255,107,0,0.35)",
          }}
          onClick={() => router.push("/session/new")}
        >
          <div style={{ ...st.btnInner, gap: 0, padding: "18px 18px 16px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ ...st.btnTitle, fontSize: 19 }}>Create Session</div>
              <div style={{ fontSize: 11, fontWeight: 1000, background: "rgba(0,0,0,0.20)", borderRadius: 999, padding: "4px 10px", letterSpacing: 0.5 }}>
                MULTI-DEVICE
              </div>
            </div>

            {/* Tagline */}
            <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.85, marginBottom: 14, lineHeight: 1.4 }}>
              Run a full session from your phone — everyone plays, everyone scores.
            </div>

            {/* USP list */}
            <div style={{ display: "grid", gap: 7 }}>
              {USP_ITEMS.map((item) => (
                <div key={item.text} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" as const }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.90, lineHeight: 1.3 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </button>

        {/* ── Join Session ── */}
        <button style={st.btnGhost} onClick={() => router.push("/join")}>
          <div style={st.btnInner}>
            <div style={{ ...st.btnTitle, fontSize: 16 }}>
              Join Session
              {hasLocalSession && <span style={st.sessionBadge}>Session on device</span>}
            </div>
            <div style={st.btnSub}>Enter code · always free</div>
          </div>
        </button>

        {/* Help pill */}
        <div style={st.helpRow}>
          <button style={st.btnHelp} onClick={() => router.push("/instructions")}>
            HOW TO USE THE APP
          </button>
        </div>

      </div>
    </div>
  );
}