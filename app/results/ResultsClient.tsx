"use client";

import React, { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

export default function ResultsClient() {
  const router = useRouter();
  const params = useSearchParams();

  const winner = useMemo(() => params.get("winner") ?? "", [params]);

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
      borderRadius: 16,
      padding: 16,
      marginTop: 20,
    },
    title: { fontSize: 22, fontWeight: 900, marginBottom: 10 },
    text: { opacity: 0.9, marginBottom: 14 },
    btn: {
      width: "100%",
      background: TEAL,
      color: NAVY,
      border: "none",
      borderRadius: 14,
      padding: "16px 14px",
      fontSize: 18,
      fontWeight: 900,
      cursor: "pointer",
    },
    btnSecondary: {
      width: "100%",
      background: "rgba(255,255,255,0.10)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: 14,
      padding: "14px 14px",
      fontSize: 16,
      fontWeight: 900,
      cursor: "pointer",
      marginTop: 10,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.title}>Match Results</div>
        <div style={styles.text}>{winner ? `Winner: Team ${winner}` : "Results loaded."}</div>

        <button style={styles.btn} onClick={() => router.push("/match/setup")}>
          Start new match
        </button>

        <button style={styles.btnSecondary} onClick={() => router.push("/")}>
          Home
        </button>
      </div>
    </div>
  );
}