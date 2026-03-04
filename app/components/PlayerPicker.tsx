"use client";

import { useMemo, useState } from "react";

type Props = {
  label?: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (next: string) => void;
};

export default function PlayerPicker(props: Props) {
  const { label, value, options, placeholder, onChange } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    userSelect: "none",
    fontSize: 16,
    lineHeight: "16px",
  };

  const pillActiveStyle: React.CSSProperties = {
    ...pillStyle,
    border: "1px solid rgba(77,163,255,0.8)",
    boxShadow: "0 0 0 2px rgba(77,163,255,0.18)",
    background: "rgba(77,163,255,0.12)",
  };

  const panelStyle: React.CSSProperties = {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.96)",
    maxWidth: 520,
    marginLeft: "auto",
    marginRight: "auto",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginTop: 12,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 16,
    outline: "none",
  };

  const smallBtnStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontSize: 14,
  };

  return (
    <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>
      {label ? (
        <div style={{ textAlign: "left", color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>
          {label}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={open ? pillActiveStyle : pillStyle}
        >
          {value ? value : placeholder ?? "Select player"}
        </button>

        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            style={smallBtnStyle}
          >
            Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div style={panelStyle}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players"
              style={inputStyle}
            />
            <button type="button" onClick={() => setOpen(false)} style={smallBtnStyle}>
              Close
            </button>
          </div>

          <div style={gridStyle}>
            {filtered.map((name) => {
              const active = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    setQuery("");
                  }}
                  style={active ? pillActiveStyle : pillStyle}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div style={{ marginTop: 12, color: "rgba(255,255,255,0.75)" }}>
              No players found
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}