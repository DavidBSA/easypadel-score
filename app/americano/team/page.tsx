"use client";

import React from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

export default function TeamAmericanoPage() {
  const router = useRouter();

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
      maxWidth: 680,
      background: NAVY,
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20,
      padding: 18,
      boxShadow: "0 12px 40px rgba(0,0,0,0.50)",
      marginTop: 12,
    },
    titleRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    title: { fontSize: 22, fontWeight: 1000 },
    subtitle: {
      color: WARM_WHITE,
      opacity: 0.6,
      fontSize: 13,
      marginTop: 5,
      lineHeight: 1.35,
    },
    btn: {
      borderRadius: 14,
      padding: "14px 14px",
      fontSize: 15,
      fontWeight: 950,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.07)",
      color: WHITE,
      whiteSpace: "nowrap" as const,
    },
    divider: {
      height: 1,
      background: "rgba(255,255,255,0.07)",
      margin: "20px 0",
    },
    comingSoonBox: {
      borderRadius: 16,
      padding: 24,
      background: "rgba(255,107,0,0.07)",
      border: "1px solid rgba(255,107,0,0.20)",
      textAlign: "center" as const,
      display: "grid",
      gap: 10,
    },
    comingSoonLabel: {
      fontSize: 11,
      fontWeight: 1000,
      letterSpacing: 1.4,
      opacity: 0.45,
      textTransform: "uppercase" as const,
    },
    comingSoonTitle: {
      fontSize: 20,
      fontWeight: 1000,
      color: ORANGE,
    },
    comingSoonText: {
      fontSize: 14,
      color: WARM_WHITE,
      opacity: 0.65,
      lineHeight: 1.5,
    },
    featureList: {
      marginTop: 8,
      display: "grid",
      gap: 8,
      textAlign: "left" as const,
    },
    featureItem: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      fontSize: 14,
      color: WARM_WHITE,
      opacity: 0.75,
      lineHeight: 1.4,
    },
    featureDot: {
      color: ORANGE,
      fontWeight: 1000,
      marginTop: 1,
      flexShrink: 0,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.titleRow}>
          <div>
            <div style={styles.title}>Team Americano</div>
            <div style={styles.subtitle}>Fixed partners · Rotating opponents</div>
          </div>
          <button style={styles.btn} onClick={() => router.push("/")}>
            Home
          </button>
        </div>

        <div style={styles.divider} />

        {/* Coming soon */}
        <div style={styles.comingSoonBox}>
          <div style={styles.comingSoonLabel}>Coming soon</div>
          <div style={styles.comingSoonTitle}>Team Americano</div>
          <div style={styles.comingSoonText}>
            Fixed partner pairs rotate through opponents across multiple rounds.
            Full scheduling, leaderboards and sit-out management included.
          </div>

          <div style={styles.featureList}>
            {[
              "Fixed partner pairs — teams stay together all session",
              "Smart opponent rotation — minimise repeat match-ups",
              "Sit-out rotation when player count exceeds court slots",
              "Points-based leaderboard per team and per player",
              "Same session code and multi-device support as Mixed Americano",
            ].map((f, i) => (
              <div key={i} style={styles.featureItem}>
                <span style={styles.featureDot}>›</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.divider} />

        <button
          style={{ ...styles.btn, width: "100%", textAlign: "center" as const }}
          onClick={() => router.push("/americano")}
        >
          Switch to Mixed Americano →
        </button>

      </div>
    </div>
  );
}