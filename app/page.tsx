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
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: "20px" }}>
        Easy Padel Score
      </h1>

      <p style={{ marginBottom: "40px", opacity: 0.8 }}>
        Simple scoring for Padel matches
      </p>

      <Link
        href="/match"
        style={{
          padding: "16px 32px",
          fontSize: "18px",
          borderRadius: "10px",
          border: "none",
          background: "#00A8A8",
          color: "#FFFFFF",
          cursor: "pointer",
          fontWeight: "bold",
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        Start Match
      </Link>
    </main>
  );
}