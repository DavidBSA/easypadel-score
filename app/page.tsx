"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const STORAGE_SESSION_KEY = "eps_session_active";

type AmericanoSession = { code: string };

function safeParseJSON<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function HomePage() {
  const router = useRouter();
  const [hasLocalSession, setHasLocalSession] = useState(false);

  useEffect(() => {
    const s = safeParseJSON<AmericanoSession | null>(
      localStorage.getItem(STORAGE_SESSION_KEY),
      null
    );
    setHasLocalSession(Boolean(s?.code));
  }, []);

  const styles: Record<string, React.CSSProperties> = {
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
      opacity: 0.65,
      marginTop: -6,
      fontWeight: 800,
      letterSpacing: 0.3,
    },
    divider: {
      height: 1,
      background: "rgba(255,255,255,0.08)",
      margin: "4px 0",
    },
    btnPrimary: {
      borderRadius: 18,
      padding: "20px 16px",
      fontSize: 18,
      fontWeight: 1000,
      cursor: "pointer",
      border: "none",
      background: ORANGE,
      color: WHITE,
      width: "100%",
      letterSpacing: 0.3,
    },
    btnSecondary: {
      borderRadius: 18,
      padding: "20px 16px",
      fontSize: 18,
      fontWeight: 1000,
      cursor: "pointer",
      border: `1px solid rgba(255,107,0,0.35)`,
      background: "rgba(255,107,0,0.10)",
      color: WHITE,
      width: "100%",
      letterSpacing: 0.3,
    },
    btnGhost: {
      borderRadius: 18,
      padding: "18px 16px",
      fontSize: 16,
      fontWeight: 950,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.05)",
      color: WARM_WHITE,
      width: "100%",
    },
    badge: {
      display: "inline-block",
      marginLeft: 8,
      borderRadius: 999,
      padding: "5px 10px",
      fontSize: 11,
      fontWeight: 1000,
      border: "1px solid rgba(255,107,0,0.45)",
      background: "rgba(255,107,0,0.15)",
      color: ORANGE,
      verticalAlign: "middle",
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: 1000,
      letterSpacing: 1.5,
      opacity: 0.4,
      textTransform: "uppercase" as const,
      textAlign: "left" as const,
      paddingLeft: 4,
      marginBottom: -4,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logoWrap}>
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
          <div style={styles.appName}>EasyPadelScore</div>
          <div style={styles.subtitle}>Fast scoring for casual padel</div>
        </div>

        <div style={styles.divider} />

        {/* Single match */}
        <div style={styles.sectionLabel}>Single match</div>
        <button style={styles.btnPrimary} onClick={() => router.push("/match/setup")}>
          Start Match
        </button>

        {/* Americano */}
        <div style={styles.sectionLabel}>Americano tournament</div>
        <button style={styles.btnSecondary} onClick={() => router.push("/americano")}>
          Mixed Americano
        </button>
        <button style={styles.btnSecondary} onClick={() => router.push("/americano/team")}>
          Team Americano
        </button>

        <div style={styles.divider} />

        {/* Multi-device session */}
        <div style={styles.sectionLabel}>Multi-device session</div>
        <button style={styles.btnPrimary} onClick={() => router.push("/session/new")}>
          Create Session
        </button>
        <button
          style={styles.btnGhost}
          onClick={() => router.push("/join")}
        >
          Join Session
          {hasLocalSession && (
            <span style={styles.badge}>Session on device</span>
          )}
        </button>

      </div>
    </div>
  );
}