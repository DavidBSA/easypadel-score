"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main style={{ textAlign: "center", padding: "40px" }}>
      <h1>Easy Padel Score</h1>

      <div style={{ marginTop: "40px" }}>

        <button
          style={{
            display: "block",
            margin: "10px auto",
            padding: "15px 30px",
            fontSize: "18px",
          }}
          onClick={() => router.push("/players?mode=standard")}
        >
          Start Standard Match
        </button>

        <button
          style={{
            display: "block",
            margin: "10px auto",
            padding: "15px 30px",
            fontSize: "18px",
          }}
          onClick={() => router.push("/players?mode=mixed")}
        >
          Start Mixed Americano
        </button>

        <button
          style={{
            display: "block",
            margin: "10px auto",
            padding: "15px 30px",
            fontSize: "18px",
          }}
          onClick={() => router.push("/players?mode=team")}
        >
          Start Team Americano
        </button>

      </div>
    </main>
  );
}