"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

const STORAGE_SESSION_KEY = "eps_session_active";

type AmericanoSession = {
  code: string;
};

function safeParseJSON<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeCode(v: string) {
  return v.trim().toUpperCase().replace(/\s+/g, "");
}

export default function HomePage() {
  const router = useRouter();

  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [hasLocalSession, setHasLocalSession] = useState(false);

  useEffect(() => {
    const s = safeParseJSON<AmericanoSession | null>(localStorage.getItem(STORAGE_SESSION_KEY), null);
    setHasLocalSession(Boolean(s?.code));
  }, []);

  const cleanCode = useMemo(() => normalizeCode(code), [code]);

  function startMatch() {
    router.push("/match/setup");
  }

  function startAmericano() {
    router.push("/americano");
  }

  function toggleJoin() {
    setError("");
    setJoinOpen((v) => !v);
  }

  function joinSession() {
    setError("");

    // For now we are still single device source of truth
    // So join is a friendly gateway that routes to the local session if present.
    const local = safeParseJSON<AmericanoSession | null>(localStorage.getItem(STORAGE_SESSION_KEY), null);

    if (!cleanCode) {
      setError("Enter a session code.");
      return;
    }

    if (!local?.code) {
      setError("No session found on this device. Create one first.");
      return;
    }

    if (normalizeCode(local.code) !== cleanCode) {
      setError("This device does not have that session yet.");
      return;
    }

    router.push("/americano/session");
  }

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
      gap: 14,
      textAlign: "center",
    },
    logoWrap: { display: "flex", justifyContent: "center", marginBottom: 4 },
    title: { fontSize: 28, fontWeight: 950, letterSpacing: 0.4 },
    subtitle: { fontSize: 13, opacity: 0.75, marginTop: -8, fontWeight: 800 },
    btn: {
      borderRadius: 18,
      padding: "18px 16px",
      fontSize: 18,
      fontWeight: 1000,
      cursor: "pointer",
      border: "none",
      background: TEAL,
      color: NAVY,
      width: "100%",
    },
    btnSecondary: {
      borderRadius: 18,
      padding: "18px 16px",
      fontSize: 18,
      fontWeight: 1000,
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
      width: "100%",
    },
    joinCard: {
      marginTop: 6,
      borderRadius: 18,
      padding: 12,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      display: "grid",
      gap: 10,
      textAlign: "left",
    },
    row: { display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 },
    input: {
      width: "100%",
      background: "rgba(255,255,255,0.08)",
      color: WHITE,
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: 14,
      padding: "14px 12px",
      fontSize: 16,
      outline: "none",
      fontWeight: 950,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    smallBtn: {
      borderRadius: 14,
      padding: "14px 12px",
      fontSize: 16,
      fontWeight: 1000,
      cursor: "pointer",
      border: "none",
      background: TEAL,
      color: NAVY,
      width: "100%",
    },
    hint: { fontSize: 12, opacity: 0.8, fontWeight: 800, lineHeight: 1.35 },
    error: {
      borderRadius: 14,
      padding: 10,
      background: "rgba(255,64,64,0.12)",
      border: "1px solid rgba(255,64,64,0.30)",
      fontWeight: 900,
      fontSize: 12,
    },
    badge: {
      display: "inline-block",
      marginLeft: 8,
      borderRadius: 999,
      padding: "6px 10px",
      fontSize: 11,
      fontWeight: 1000,
      border: "1px solid rgba(0,168,168,0.40)",
      background: "rgba(0,168,168,0.12)",
      color: WHITE,
      verticalAlign: "middle",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <Image src="/logo.svg" alt="EasyPadelScore" width={110} height={110} priority />
        </div>

        <div>
          <div style={styles.title}>EasyPadelScore</div>
          <div style={styles.subtitle}>Fast scoring for casual padel</div>
        </div>

        <button style={styles.btn} onClick={startMatch}>
          Start Match
        </button>

        <button style={styles.btnSecondary} onClick={startAmericano}>
          Start Americano
        </button>

        <button style={styles.btnSecondary} onClick={toggleJoin}>
          Join Americano Session
          {hasLocalSession ? <span style={styles.badge}>Session on device</span> : null}
        </button>

        {joinOpen ? (
          <div style={styles.joinCard}>
            <div style={{ fontWeight: 1000 }}>Enter session code</div>
            <div style={styles.row}>
              <input
                style={styles.input}
                value={code}
                placeholder="ABCD"
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinSession();
                }}
              />
              <button style={styles.smallBtn} onClick={joinSession}>
                Join
              </button>
            </div>

            <div style={styles.hint}>
              Offline for now, this checks for a matching session saved on this device. Multi device joining comes later.
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}