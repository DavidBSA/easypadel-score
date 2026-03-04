import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0F1E2E",
        color: "#FFFFFF",
        fontFamily: "Arial",
        textAlign: "center",
        padding: 20,
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: 14 }}>
        Easy Padel Score
      </h1>

      <p style={{ marginBottom: 28, opacity: 0.8 }}>
        Simple scoring for Padel matches
      </p>

      <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 320 }}>
        <Link href="/match" style={primaryLink}>
          Start Match
        </Link>

        <Link href="/players" style={secondaryLink}>
          Players
        </Link>

        <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
          Americano mode is next
        </div>
      </div>
    </main>
  );
}

const primaryLink: React.CSSProperties = {
  padding: "16px 32px",
  fontSize: 18,
  borderRadius: 12,
  border: "none",
  background: "#00A8A8",
  color: "#FFFFFF",
  cursor: "pointer",
  fontWeight: 800,
  textDecoration: "none",
  display: "inlineBlock",
};

const secondaryLink: React.CSSProperties = {
  padding: "14px 32px",
  fontSize: 16,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: "#FFFFFF",
  cursor: "pointer",
  fontWeight: 800,
  textDecoration: "none",
  display: "inlineBlock",
};