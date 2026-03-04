import Link from "next/link";

const NAVY = "#0F1E2E";
const TEAL = "#00A8A8";
const WHITE = "#FFFFFF";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: NAVY,
        color: WHITE,
        fontFamily: "Arial",
        display: "flex",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            letterSpacing: 1,
          }}
        >
          EPS
        </div>

        <h1 style={{ fontSize: "2.2rem", margin: 0, fontWeight: 900 }}>
          Easy Padel Score
        </h1>

        <div style={{ opacity: 0.78, fontSize: 13, marginBottom: 10 }}>
          Simple scoring for matches and tournaments
        </div>

        <div style={{ width: "100%", display: "grid", gap: 12 }}>
          <Link href="/match/setup" style={primaryLink}>
            Standard Match
          </Link>

          <Link href="/americano/mixed" style={secondaryLink}>
            Mixed Americano
          </Link>

          <Link href="/americano/team" style={secondaryLink}>
            Team Americano
          </Link>
        </div>

        <div style={{ opacity: 0.6, fontSize: 12, marginTop: 10 }}>
          Next up, Americano generator and standings
        </div>
      </div>
    </main>
  );
}

const primaryLink: React.CSSProperties = {
  padding: "16px 18px",
  fontSize: 17,
  borderRadius: 14,
  border: "none",
  background: TEAL,
  color: WHITE,
  cursor: "pointer",
  fontWeight: 900,
  textDecoration: "none",
  display: "block",
};

const secondaryLink: React.CSSProperties = {
  padding: "14px 18px",
  fontSize: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: WHITE,
  cursor: "pointer",
  fontWeight: 900,
  textDecoration: "none",
  display: "block",
};