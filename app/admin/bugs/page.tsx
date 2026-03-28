"use client";

import { useState } from "react";

const ORANGE = "#FF6B00";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const GREEN = "#00C851";
const WARM_WHITE = "#F5F5F5";

type BugReport = {
  id: string;
  pageUrl: string;
  sessionCode: string | null;
  userNote: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

type Filter = "ALL" | "OPEN" | "RESOLVED";

export default function AdminBugsPage() {
  const [pin, setPin] = useState("");
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [pinError, setPinError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(false);

  async function fetchReports(pinToUse: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/bugs?adminPin=${encodeURIComponent(pinToUse)}`);
    setLoading(false);
    if (res.status === 403) {
      setPinError("Incorrect PIN");
      return false;
    }
    const data = await res.json();
    setReports(data);
    return true;
  }

  async function handlePinSubmit() {
    setPinError("");
    const ok = await fetchReports(pin);
    if (ok) setAdminPin(pin);
  }

  async function handleResolve(id: string) {
    await fetch(`/api/bugs/${id}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPin }),
    });
    if (adminPin) fetchReports(adminPin);
  }

  const filtered = reports.filter((r) => filter === "ALL" || r.status === filter);

  if (!adminPin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: NAVY,
            borderRadius: 20,
            padding: 32,
            width: "90%",
            maxWidth: 360,
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ color: WHITE, fontSize: 18, fontWeight: 700 }}>Admin — Bug Reports</div>
          <input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.07)",
              color: WHITE,
              fontSize: 16,
              outline: "none",
            }}
          />
          {pinError && <div style={{ color: "#FF4040", fontSize: 13 }}>{pinError}</div>}
          <button
            onClick={handlePinSubmit}
            style={{
              padding: "12px 0",
              borderRadius: 10,
              border: "none",
              background: ORANGE,
              color: WHITE,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#111", padding: "24px 16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: WHITE, fontSize: 22, fontWeight: 800 }}>Bug Reports</span>
            <span
              style={{
                background: ORANGE,
                color: WHITE,
                borderRadius: 999,
                padding: "2px 10px",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {reports.length}
            </span>
          </div>
          <button
            onClick={() => adminPin && fetchReports(adminPin)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.07)",
              color: WHITE,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["ALL", "OPEN", "RESOLVED"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                border: filter === f ? "none" : "1px solid rgba(255,255,255,0.15)",
                background: filter === f ? ORANGE : "rgba(255,255,255,0.07)",
                color: WHITE,
                fontSize: 13,
                fontWeight: filter === f ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading…</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No reports yet.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((r) => (
            <div
              key={r.id}
              style={{
                background: NAVY,
                borderRadius: 16,
                padding: 18,
                border: `1px solid ${r.status === "OPEN" ? ORANGE : GREEN}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span
                  style={{
                    background: r.status === "OPEN" ? `${ORANGE}22` : `${GREEN}22`,
                    border: `1px solid ${r.status === "OPEN" ? ORANGE : GREEN}`,
                    color: r.status === "OPEN" ? ORANGE : GREEN,
                    borderRadius: 999,
                    padding: "2px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {r.status}
                </span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div style={{ color: WARM_WHITE, fontSize: 13, marginBottom: 4, wordBreak: "break-all" }}>
                <b style={{ color: "rgba(255,255,255,0.5)" }}>Page: </b>
                {r.pageUrl.length > 60 ? r.pageUrl.substring(0, 60) + "…" : r.pageUrl}
              </div>
              <div style={{ color: WARM_WHITE, fontSize: 13, marginBottom: 4 }}>
                <b style={{ color: "rgba(255,255,255,0.5)" }}>Session: </b>
                {r.sessionCode ?? "N/A"}
              </div>
              <div style={{ color: WARM_WHITE, fontSize: 13, marginBottom: r.status === "OPEN" ? 12 : 0 }}>
                <b style={{ color: "rgba(255,255,255,0.5)" }}>Note: </b>
                {r.userNote ?? "None"}
              </div>

              {r.status === "OPEN" && (
                <button
                  onClick={() => handleResolve(r.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: `1px solid ${GREEN}`,
                    background: `${GREEN}22`,
                    color: GREEN,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Mark Resolved
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
