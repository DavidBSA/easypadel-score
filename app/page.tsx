"use client";

import React from "react";
import { useRouter } from "next/navigation";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

export default function HomePage() {
  const router = useRouter();

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: NAVY,
      color: WHITE,
      padding: 16,
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
    },
    card: {
      width: "100%",
      maxWidth: 520,
      marginTop: 18,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 18,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    },
    logoRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 10,
    },
    title: { fontSize: 22, fontWeight: 950, letterSpacing: 0.2 },
    subtitle: { opacity: 0.85, fontSize: 13, marginTop: 6, lineHeight: 1.3 },
    buttonStack: { display: "grid", gap: 10, marginTop: 16 },
    btnPrimary: {
      width: "100%",
      background: TEAL,
      color: NAVY,
      border: "none",
      borderRadius: 16,
      padding: "18px 14px",
      fontSize: 18,
      fontWeight: 950,
      cursor: "pointer",
    },
    btnSecondary: {
      width: "100%",
      background: "rgba(255,255,255,0.10)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: 16,
      padding: "18px 14px",
      fontSize: 18,
      fontWeight: 950,
      cursor: "pointer",
    },
    tiny: { opacity: 0.75, fontSize: 12, marginTop: 14, textAlign: "center" },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div>
            <div style={styles.title}>EasyPadelScore</div>
            <div style={styles.subtitle}>
              Fast setup. Big buttons. Court readable scoring.
            </div>
          </div>
        </div>

        <div style={styles.buttonStack}>
          <button style={styles.btnPrimary} onClick={() => router.push("/match/setup")}>
            Standard Match
          </button>

          <button style={styles.btnSecondary} onClick={() => router.push("/americano")}>
            Americano Session
          </button>

          <button style={styles.btnSecondary} onClick={() => router.push("/session/join")}>
            Join Session
          </button>
        </div>

        <div style={styles.tiny}>Offline first. Built for casual play and clubs.</div>
      </div>
    </div>
  );
}