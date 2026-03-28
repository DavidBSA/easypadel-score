"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const GREEN = "#00C851";
const RED = "#FF4040";

type Status = "idle" | "sending" | "sent" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That link is invalid.",
  used: "That link has already been used. Request a new one.",
  expired: "That link has expired. Request a new one.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const urlError = searchParams.get("error");

  async function handleSubmit() {
    if (!email.includes("@")) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }
      setStatus("sent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BLACK,
        color: WHITE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 20,
        padding: 24,
      }}
    >
      <div
        style={{
          background: NAVY,
          borderRadius: 20,
          padding: 32,
          width: "90%",
          maxWidth: 420,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 1000, textAlign: "center", marginBottom: 4 }}>
          EasyPadelScore
        </div>
        <div
          style={{
            fontSize: 13,
            opacity: 0.5,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          Sign in or create an account
        </div>

        {urlError && ERROR_MESSAGES[urlError] && (
          <div
            style={{
              background: "rgba(255,64,64,0.1)",
              border: "1px solid rgba(255,64,64,0.3)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13,
              color: RED,
              marginBottom: 20,
            }}
          >
            {ERROR_MESSAGES[urlError]}
          </div>
        )}

        {status === "sent" ? (
          <div
            style={{
              background: "rgba(0,200,81,0.1)",
              border: "1px solid rgba(0,200,81,0.3)",
              borderRadius: 12,
              padding: "16px 20px",
              fontSize: 14,
              color: GREEN,
              lineHeight: 1.6,
            }}
          >
            Check your email — a sign in link is on its way. The link expires in 15 minutes.
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.07)",
                color: WHITE,
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 16,
                outline: "none",
                fontWeight: 900,
                boxSizing: "border-box",
              }}
            />
            {status === "error" && (
              <div style={{ color: RED, fontSize: 13, marginTop: 8 }}>{errorMsg}</div>
            )}
            <button
              onClick={handleSubmit}
              disabled={status === "sending"}
              style={{
                width: "100%",
                marginTop: 12,
                background: ORANGE,
                color: WHITE,
                borderRadius: 14,
                padding: "14px",
                fontSize: 16,
                fontWeight: 1000,
                border: "none",
                cursor: status === "sending" ? "default" : "pointer",
                opacity: status === "sending" ? 0.7 : 1,
              }}
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
          </>
        )}
      </div>

      <Link
        href="/"
        style={{
          color: ORANGE,
          fontSize: 13,
          fontWeight: 900,
          textDecoration: "none",
        }}
      >
        ← Back to home
      </Link>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
