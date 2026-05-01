"use client";

import React from "react";
import { useRouter } from "next/navigation";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const sections = [
  {
    title: "Getting started",
    items: [
      {
        heading: "Quick Match",
        body: "One device, one organiser. Tap Start Match on the home screen, choose your format and settings, add players and go. No sign-up needed.",
      },
      {
        heading: "Create Session",
        body: "Multi-device. The organiser creates a session and shares a 4-letter code. Players join on their own devices by visiting the app and tapping Join Session.",
      },
    ],
  },
  {
    title: "As an organiser",
    items: [
      {
        heading: "Creating a session",
        body: "Tap Create Session, choose your format (Mixed Americano, Team Americano, or Single Match), set courts and points per match, then share the code with players.",
      },
      {
        heading: "Lobby",
        body: "Wait for players to join. You can also add players manually. For Team Americano, players are paired in join order. Once everyone is in, tap Lock & Start to generate the full match queue.",
      },
      {
        heading: "During play",
        body: "The organiser screen shows live court status and the match queue. You can manually enter scores from the court card if needed. Scores submitted by players confirm automatically.",
      },
      {
        heading: "Results",
        body: "Tap the green 'done' pill to view all completed match scores. You can edit any score here if needed.",
      },
    ],
  },
  {
    title: "As a player",
    items: [
      {
        heading: "Joining a session",
        body: "Tap Join Session on the home screen, enter the 4-letter code, type your name and tap Join. You'll be taken to your player view automatically.",
      },
      {
        heading: "Your player screen",
        body: "Once the organiser starts the session, your court and opponents will appear. You'll also see your upcoming scheduled matches below.",
      },
      {
        heading: "Submitting a score",
        body: "After your match, enter your team's points. The opponents' score is calculated automatically from the total. Tap Submit — the score confirms instantly with no organiser needed.",
      },
      {
        heading: "Leaderboard",
        body: "Tap the 🏅 button at the top right of your player screen to toggle the live standings at any time.",
      },
    ],
  },
  {
    title: "Formats",
    items: [
      {
        heading: "Mixed Americano",
        body: "Partners rotate every match. Points are tracked individually. The full match queue is generated at the start so every player knows their schedule.",
      },
      {
        heading: "Team Americano",
        body: "Fixed partners throughout. Teams rotate opponents. Players join in pairs — first two names become Team 1, next two become Team 2, and so on.",
      },
      {
        heading: "Single Match",
        body: "One match, one court, tennis-style scoring with sets, games and points. Full tiebreak and deuce rule support. Organiser scores live on their device.",
      },
    ],
  },
  {
    title: "Apple Watch",
    items: [
      {
        heading: "Apple Watch scoring",
        body: "Account holders can score matches directly from their wrist. Two ways to get there:",
      },
      {
        heading: "Web Watch",
        body: "Visit easypadelscore.com/watch/[code] from your Watch's browser. Available right now — no app needed.",
      },
      {
        heading: "Native Watch app",
        body: "Download the EasyPadelScore iOS app. The Apple Watch companion installs automatically alongside it. Enter your session code on the Watch and score without touching your device.",
      },
    ],
  },
];

export default function InstructionsPage() {
  const router = useRouter();

  const st: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" },
    card: { width: "100%", maxWidth: 560, marginTop: 12, paddingBottom: 40 },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 1000, color: WHITE },
    sub: { fontSize: 13, color: WARM_WHITE, opacity: 0.55, marginTop: 4 },
    btn: { borderRadius: 14, padding: "10px 14px", fontSize: 13, fontWeight: 1000, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: WHITE, whiteSpace: "nowrap" as const },
    sectionLabel: { fontSize: 11, fontWeight: 1000, letterSpacing: 1.4, opacity: 0.4, textTransform: "uppercase" as const, marginTop: 28, marginBottom: 10 },
    itemCard: { borderRadius: 14, padding: "14px 16px", background: NAVY, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 },
    itemHeading: { fontSize: 15, fontWeight: 1000, color: WHITE, marginBottom: 5 },
    itemBody: { fontSize: 13, color: WARM_WHITE, opacity: 0.7, lineHeight: 1.6 },
    divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" },
    betaBanner: { borderRadius: 14, padding: "12px 16px", background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.25)", fontSize: 13, color: WARM_WHITE, lineHeight: 1.6, marginBottom: 20, textAlign: "center" as const },
    footer: { fontSize: 12, color: WARM_WHITE, opacity: 0.35, textAlign: "center" as const, marginTop: 12, lineHeight: 1.6 },
  };

  return (
    <div style={st.page}>
      <div style={st.card}>

        <div style={st.header}>
          <div>
            <div style={st.title}>How to use EPS</div>
          </div>
          <button style={st.btn} onClick={() => router.push("/")}>← Home</button>
        </div>

        {sections.map((section) => (
          <div key={section.title}>
            <div style={st.sectionLabel}>{section.title}</div>
            {section.items.map((item) => (
              <div key={item.heading} style={st.itemCard}>
                <div style={st.itemHeading}>{item.heading}</div>
                <div style={st.itemBody}>{item.body}</div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ ...st.divider, marginTop: 32 }} />
        <div style={st.footer}>EasyPadelScore · Beta · Built for casual padel</div>

      </div>
    </div>
  );
}