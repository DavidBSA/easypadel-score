"use client";

import React, { useEffect, useState } from "react";

const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";

type Status = "idle" | "sending" | "success" | "error";

export default function BugReportFooter() {
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [pageUrl, setPageUrl] = useState("");
  const [sessionCode, setSessionCode] = useState("N/A");
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const url = window.location.href;
    setPageUrl(url);
    const match = url.match(/\/session\/([A-Z0-9]{4})/i);
    setSessionCode(match ? match[1].toUpperCase() : "N/A");
  }, []);

  async function sendReport() {
    setStatus("sending");
    try {
      const r = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl, sessionCode, userNote: note }),
      });
      if (!r.ok) throw new Error("failed");
      setStatus("success");
      setTimeout(() => {
        setIsOpen(false);
        setNote("");
        setStatus("idle");
      }, 2000);
    } catch {
      setStatus("error");
    }
  }

  function openModal() {
    const url = window.location.href;
    setPageUrl(url);
    const match = url.match(/\/session\/([A-Z0-9]{4})/i);
    setSessionCode(match ? match[1].toUpperCase() : "N/A");
    setNote("");
    setStatus("idle");
    setIsOpen(true);
  }

  return (
    <>
      <div style={{ width: "100%", padding: "20px 16px 28px", display: "flex", justifyContent: "center", alignItems: "center", background: "transparent" }}>
        <span
          onClick={openModal}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ fontSize: 13, fontWeight: 900, color: hovered ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)", cursor: "pointer", textDecoration: "none", letterSpacing: 0.2 }}
        >
          🐛 Report a bug
        </span>
      </div>

      {isOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: NAVY, borderRadius: 20, padding: 24, width: "90%", maxWidth: 400, border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 18, fontWeight: 1000, color: WHITE, marginBottom: 16 }}>Report a Bug</div>

            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6, wordBreak: "break-all" as const }}>
              <strong style={{ color: "rgba(255,255,255,0.55)" }}>Page:</strong> {pageUrl}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>
              <strong style={{ color: "rgba(255,255,255,0.55)" }}>Session:</strong> {sessionCode}
            </div>

            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe what went wrong (optional)"
              style={{ width: "100%", background: "rgba(255,255,255,0.07)", color: WHITE, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: 12, fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" as const }}
            />

            {status === "success" && (
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 900, color: "#00C851" }}>✓ Report sent — thanks!</div>
            )}
            {status === "error" && (
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 900, color: "#FF4040" }}>Something went wrong. Try again.</div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setIsOpen(false); setNote(""); setStatus("idle"); }}
                disabled={status === "sending"}
                style={{ borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 900, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE }}
              >
                Cancel
              </button>
              <button
                onClick={sendReport}
                disabled={status === "sending" || status === "success"}
                style={{ borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 1000, cursor: "pointer", border: "none", background: ORANGE, color: WHITE, opacity: status === "sending" ? 0.6 : 1 }}
              >
                {status === "sending" ? "Sending…" : "Send Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
