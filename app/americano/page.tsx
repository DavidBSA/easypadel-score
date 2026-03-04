import Link from "next/link";

const NAVY = "#0F1E2E";
const WHITE = "#FFFFFF";
const TEAL = "#00A8A8";

export default function MixedAmericanoPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: NAVY,
        color: WHITE,
        fontFamily: "Arial",
        padding: 20,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <Link href="/" style={{ color: WHITE }}>
          ← Home
        </Link>

        <h1 style={{ fontSize: "1.9rem", fontWeight: 900, marginTop: 14 }}>
          Mixed Americano
        </h1>

        <div style={{ opacity: 0.75, marginTop: 8 }}>
          Setup screen and schedule generator is next
        </div>

        <div style={{ marginTop: 16, color: TEAL, fontWeight: 900 }}>
          Coming next
        </div>
      </div>
    </main>
  );
}