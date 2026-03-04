"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      display: "grid",
      gap: 24,
      textAlign: "center",
    },
    logoWrap: {
      display: "flex",
      justifyContent: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: 900,
      letterSpacing: 0.4,
    },
    btn: {
      borderRadius: 16,
      padding: "18px 16px",
      fontSize: 18,
      fontWeight: 900,
      cursor: "pointer",
      border: "none",
      background: TEAL,
      color: NAVY,
      width: "100%",
    },
    btnSecondary: {
      borderRadius: 16,
      padding: "18px 16px",
      fontSize: 18,
      fontWeight: 900,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
      width: "100%",
    },
    subtitle: {
      fontSize: 13,
      opacity: 0.7,
      marginTop: -10,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <Image
            src="/logo.svg"
            alt="EasyPadelScore"
            width={120}
            height={120}
            priority
          />
        </div>

        <div>
          <div style={styles.title}>EasyPadelScore</div>
          <div style={styles.subtitle}>Fast scoring for casual padel</div>
        </div>

        <button style={styles.btn} onClick={() => router.push("/match/setup")}>
          Start Match
        </button>

        <button
          style={styles.btnSecondary}
          onClick={() => router.push("/americano")}
        >
          Start Americano
        </button>
      </div>
    </div>
  );
}