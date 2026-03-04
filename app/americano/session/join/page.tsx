"use client";

import React from "react";
import { useRouter } from "next/navigation";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

export default function JoinSessionPage() {
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
      maxWidth: 560,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 18,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      marginTop: 12,
    },
    title: { fontSize: 22, fontWeight: 950 },
    subtitle: { opacity: 0.85, fontSize: 13, marginTop: 6, lineHeight: 1.3 },
    btn: {
      width: "100%",
      marginTop: 14,
      borderRadius: 16,
      padding: "16px 14px",
      fontSize: 18,
      fontWeight: 950,
      cursor: "pointer",
      border: "none",
      background: TEAL,
      color: NAVY,
    },
    btnSecondary: {
      width: "100%",
      marginTop: 10,
      borderRadius: 16,
      padding: "14px 14px",
      fontSize: 16,
      fontWeight: 950,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.10)",
      color: WHITE,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.title}>Join Session</div>
        <div style={styles.subtitle}>
          Coming soon. This will allow other devices to join with a code and view leaderboard and courts in real time.
        </div>

        <button style={styles.btn} onClick={() => router.push("/")}>
          Back to Home
        </button>

        <button style={styles.btnSecondary} onClick={() => router.push("/americano")}>
          Create Americano session
        </button>
      </div>
    </div>
  );
}