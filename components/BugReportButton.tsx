"use client";

import { useState, useEffect } from "react";

const ORANGE = "#FF6B00";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const GREEN = "#00C851";
const RED = "#FF4040";

type Status = "idle" | "sending" | "success" | "error";

export default function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [pageUrl, setPageUrl] = useState("");
  const [sessionCode, setSessionCode] = useState<string | null>(null);

  useEffect(() => {
    const href = window.location.href;
    setPageUrl(href);
    const match = window.location.pathname.match(/\/session\/([^/]+)/);
    setSessionCode(match ? match[1].substring(0, 4) : null);
  }, []);

  async function handleSubmit() {
    setStatus("sending");
    try {
      const res = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl, sessionCode, userNote: note }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      setTimeout(() => {
        setIsOpen(false);
        setStatus("idle");
        setNote("");
      }, 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          width: 48,
          height: 48,
          borderRadius: 999,
          background: ORANGE,
          color: WHITE,
          fontSize: 20,
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        🐛
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: NAVY,
              borderRadius: 20,
              padding: 24,
              width: "90%",
              maxWidth: 400,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 1000,
                color: WHITE,
                marginBottom: 16,
              }}
            >
              Report a Bug
            </div>

            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6 }}>
              <b style={{ color: "rgba(255,255,255,0.7)" }}>Page:</b>{" "}
              {pageUrl}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 16 }}>
              <b style={{ color: "rgba(255,255,255,0.7)" }}>Session:</b>{" "}
              {sessionCode ?? "N/A"}
            </div>

            <textarea
              rows={4}
              placeholder="Describe what went wrong (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.07)",
                color: WHITE,
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />

            {status === "error" && (
              <div style={{ color: RED, fontSize: 13, marginTop: 8 }}>
                Something went wrong. Try again.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => { setIsOpen(false); setStatus("idle"); setNote(""); }}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.08)",
                  color: WHITE,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={status === "sending" || status === "success"}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 12,
                  border: "none",
                  background: status === "success" ? GREEN : ORANGE,
                  color: WHITE,
                  fontSize: 14,
                  cursor: status === "sending" || status === "success" ? "default" : "pointer",
                  fontWeight: 700,
                }}
              >
                {status === "sending"
                  ? "Sending…"
                  : status === "success"
                  ? "✓ Report sent — thanks!"
                  : "Send Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
