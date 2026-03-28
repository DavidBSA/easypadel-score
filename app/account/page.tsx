"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const RED = "#FF4040";
const GREEN = "#00C851";
const WARM_WHITE = "#F5F5F5";

type Account = {
  id: string;
  email: string;
  tier: string;
};

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setAccount(data);
        setLoading(false);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BLACK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.4)",
          fontSize: 15,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!account) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BLACK,
        color: WHITE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: NAVY,
          borderRadius: 20,
          padding: 32,
          width: "90%",
          maxWidth: 480,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 1000 }}>My Account</div>
        <div style={{ fontSize: 15, opacity: 0.7, marginTop: 8 }}>{account.email}</div>

        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.07)",
            margin: "24px 0",
          }}
        />

        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            color: ORANGE,
            letterSpacing: 1,
            marginBottom: 10,
          }}
        >
          CURRENT PLAN
        </div>

        <div
          style={{
            display: "inline-block",
            border: `1px solid ${ORANGE}`,
            color: ORANGE,
            borderRadius: 999,
            padding: "4px 14px",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          {account.tier}
        </div>

        {account.tier === "FREE" ? (
          <div>
            <div style={{ fontSize: 14, color: WARM_WHITE, opacity: 0.7, marginBottom: 12 }}>
              Upgrade to create and manage your own sessions.
            </div>
            <button
              onClick={() => alert("Upgrade plans coming soon via the App Store.")}
              style={{
                background: ORANGE,
                color: WHITE,
                border: "none",
                borderRadius: 12,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Upgrade plan
            </button>
          </div>
        ) : (
          <div
            style={{
              background: "rgba(0,200,81,0.1)",
              border: "1px solid rgba(0,200,81,0.3)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              color: GREEN,
            }}
          >
            You can create and manage sessions.
          </div>
        )}

        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.07)",
            margin: "24px 0",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "12px 0",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.07)",
              color: WHITE,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Go to home
          </button>
          <button
            onClick={handleSignOut}
            style={{
              padding: "12px 0",
              borderRadius: 12,
              border: "1px solid rgba(255,64,64,0.35)",
              background: "rgba(255,64,64,0.10)",
              color: RED,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
