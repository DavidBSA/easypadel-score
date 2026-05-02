"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const RED = "#FF4040";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That link is invalid.",
  used: "That link has already been used. Request a new one.",
  expired: "That link has expired. Request a new one.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlError = searchParams.get("error");
  const next = searchParams.get("next");

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendAvailable, setResendAvailable] = useState(false);
  const [resendConfirm, setResendConfirm] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step === "otp") {
      inputRefs.current[0]?.focus();
      setResendAvailable(false);
      resendTimerRef.current = setTimeout(() => setResendAvailable(true), 30000);
      return () => { if (resendTimerRef.current) clearTimeout(resendTimerRef.current); };
    }
  }, [step]);

  async function handleSendCode() {
    if (!email.includes("@")) return;
    setStatus("sending");
    setErrorMessage("");
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
      setStep("otp");
      setDigits(["", "", "", "", "", ""]);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  async function handleVerify() {
    const otp = digits.join("");
    if (otp.length !== 6) return;
    setStatus("verifying");
    setErrorMessage("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid or expired code");
      }
      router.push(next || "/account");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Incorrect or expired code. Try again.");
      setStatus("error");
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }

  async function handleResend() {
    setResendAvailable(false);
    setResendConfirm(false);
    try {
      await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendConfirm(true);
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      setTimeout(() => setResendConfirm(false), 2000);
    } catch {}
    resendTimerRef.current = setTimeout(() => setResendAvailable(true), 30000);
  }

  function handleDigitChange(idx: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleDigitKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    setTimeout(() => inputRefs.current[focusIdx]?.focus(), 0);
  }

  const allFilled = digits.every(d => d !== "");

  const cardStyle: React.CSSProperties = {
    background: NAVY,
    borderRadius: 20,
    padding: 32,
    width: "90%",
    maxWidth: 420,
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
  };

  return (
    <div style={{ minHeight: "100vh", background: BLACK, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, padding: 24 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 22, fontWeight: 1000, textAlign: "center", marginBottom: 4 }}>
          EasyPadelScore
        </div>
        <div style={{ fontSize: 13, opacity: 0.5, textAlign: "center", marginBottom: 32 }}>
          Sign in or create an account
        </div>

        {urlError && ERROR_MESSAGES[urlError] && (
          <div style={{ background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: RED, marginBottom: 20 }}>
            {ERROR_MESSAGES[urlError]}
          </div>
        )}

        {step === "email" ? (
          <>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
              style={{ width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "14px 16px", fontSize: 16, outline: "none", fontWeight: 900, boxSizing: "border-box" }}
            />
            {status === "error" && (
              <div style={{ color: RED, fontSize: 13, marginTop: 8 }}>{errorMessage}</div>
            )}
            <button
              onClick={handleSendCode}
              disabled={status === "sending"}
              style={{ width: "100%", marginTop: 12, background: ORANGE, color: WHITE, borderRadius: 14, padding: "14px", fontSize: 16, fontWeight: 1000, border: "none", cursor: status === "sending" ? "default" : "pointer", opacity: status === "sending" ? 0.7 : 1 }}
            >
              {status === "sending" ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, opacity: 0.6, textAlign: "center", marginBottom: 4 }}>
              We sent a 6-digit code to {email}
            </div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span
                onClick={() => { setStep("email"); setStatus("idle"); setErrorMessage(""); setDigits(["", "", "", "", "", ""]); }}
                style={{ color: ORANGE, fontSize: 12, cursor: "pointer" }}
              >
                Change email
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, width: "100%" }}>
              {digits.map((d, idx) => (
                <input
                  key={idx}
                  ref={el => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  onPaste={idx === 0 ? handlePaste : undefined}
                  style={{ flex: "1 1 0", minWidth: 0, maxWidth: 48, height: 48, textAlign: "center", fontSize: 22, fontWeight: 900, background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, outline: "none" }}
                />
              ))}
            </div>

            {status === "error" && (
              <div style={{ color: RED, fontSize: 13, marginBottom: 10, textAlign: "center" }}>
                {errorMessage || "Incorrect or expired code. Try again."}
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={!allFilled || status === "verifying"}
              style={{ width: "100%", background: ORANGE, color: WHITE, borderRadius: 14, padding: "14px", fontSize: 16, fontWeight: 1000, border: "none", cursor: allFilled && status !== "verifying" ? "pointer" : "default", opacity: allFilled && status !== "verifying" ? 1 : 0.5 }}
            >
              {status === "verifying" ? "Verifying…" : "Verify code"}
            </button>

            <div style={{ textAlign: "center", marginTop: 16, fontSize: 12 }}>
              {resendConfirm ? (
                <span style={{ color: "#00C851" }}>New code sent</span>
              ) : resendAvailable ? (
                <span onClick={handleResend} style={{ color: ORANGE, cursor: "pointer" }}>Resend code</span>
              ) : (
                <span style={{ color: "rgba(255,255,255,0.25)" }}>Resend available in 30s</span>
              )}
            </div>
          </>
        )}
      </div>

      <Link href="/" style={{ color: ORANGE, fontSize: 13, fontWeight: 900, textDecoration: "none" }}>
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
