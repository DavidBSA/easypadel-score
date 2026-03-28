"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const GREEN = "#00C851";
const RED = "#FF4040";

type WatchScreen = "loading" | "waiting" | "scoring" | "serve" | "complete" | "leaderboard" | "unsupported";

type MatchInfo = {
  matchId: string;
  courtNumber: number;
  myTeam: "A" | "B";
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  pointsA: number;
  pointsB: number;
  pointsPerMatch: number;
  servesPerRotation: number;
  firstServeTeam: "A" | "B";
};

type PlayerInfo = { id: string; name: string };
type LeaderRow = { id: string; name: string; diff: number; pointsFor: number };

type SMatch = {
  id: string; queuePosition: number; courtNumber: number | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE";
  teamAPlayer1: string; teamAPlayer2: string; teamBPlayer1: string; teamBPlayer2: string;
  pointsA: number | null; pointsB: number | null;
};
type SSession = {
  code: string; status: string; courts: number; pointsPerMatch: number;
  servesPerRotation: number | null;
  format?: string;
  players: { id: string; name: string; isActive: boolean }[];
  matches: SMatch[];
};

function getCurrentServer(
  firstServeTeam: "A" | "B",
  totalPoints: number,
  spr: number,
  teamANames: [string, string],
  teamBNames: [string, string]
): { name: string; nextName: string; ptsLeft: number } {
  const order = firstServeTeam === "A"
    ? [teamANames[0], teamBNames[0], teamANames[1], teamBNames[1]]
    : [teamBNames[0], teamANames[0], teamBNames[1], teamANames[1]];
  const pos = Math.floor(totalPoints / spr) % 4;
  const nextPos = (pos + 1) % 4;
  const ptsLeft = spr - (totalPoints % spr);
  return { name: order[pos], nextName: order[nextPos], ptsLeft };
}

function buildLeaderboard(session: SSession): LeaderRow[] {
  const map = new Map<string, LeaderRow>();
  for (const p of session.players) map.set(p.id, { id: p.id, name: p.name, diff: 0, pointsFor: 0 });
  for (const m of session.matches) {
    if (m.status !== "COMPLETE" || m.pointsA === null || m.pointsB === null) continue;
    for (const id of [m.teamAPlayer1, m.teamAPlayer2]) {
      const r = map.get(id); if (r) { r.pointsFor += m.pointsA; r.diff += m.pointsA - m.pointsB; }
    }
    for (const id of [m.teamBPlayer1, m.teamBPlayer2]) {
      const r = map.get(id); if (r) { r.pointsFor += m.pointsB; r.diff += m.pointsB - m.pointsA; }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.diff - a.diff || b.pointsFor - a.pointsFor);
}

// ── Pulse animation injected once ──────────────────────────────────────────
const PULSE_CSS = `@keyframes eps-pulse{0%,100%{opacity:0.4}50%{opacity:1}}`;

function WatchContent({ code }: { code: string }) {
  const searchParams = useSearchParams();
  const pid = searchParams.get("pid") ?? "";

  const [screen, setScreen] = useState<WatchScreen>("loading");
  const [prevScreen, setPrevScreen] = useState<WatchScreen>("scoring");
  const [session, setSession] = useState<SSession | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [localA, setLocalA] = useState(0);
  const [localB, setLocalB] = useState(0);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const screenRef = useRef<WatchScreen>("loading");
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs mirror localA/localB so addPoint/undoPoint never read stale closure values
  const localARef = useRef(0);
  const localBRef = useRef(0);
  const matchRef = useRef<MatchInfo | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const lastTapTeamRef = useRef<"A" | "B">("A");
  const touchStartRef = useRef({ x: 0, y: 0 });
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  function goToScreen(s: WatchScreen) { screenRef.current = s; setScreen(s); }

  useEffect(() => {
    const btn = document.querySelector('[data-bug-report-button]');
    if (btn) (btn as HTMLElement).style.display = 'none';
    return () => {
      if (btn) (btn as HTMLElement).style.display = '';
    };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PULSE_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    let tag = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const created = !tag;
    if (!tag) { tag = document.createElement("meta"); tag.name = "viewport"; }
    tag.content = "width=320, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
    if (created) document.head.appendChild(tag);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`eps_join_${code}`);
      if (stored) {
        const { deviceId: did } = JSON.parse(stored);
        if (did) { setDeviceId(did); deviceIdRef.current = did; }
      }
    } catch {}
  }, [code]);

  const processSession = useCallback((data: SSession) => {
    if (data.format && data.format !== "AMERICANO" && data.format !== "TEAM_AMERICANO") {
      goToScreen("unsupported");
      return;
    }

    setSession(data);
    setPlayers(data.players.map(p => ({ id: p.id, name: p.name })));
    setLeaderboard(buildLeaderboard(data));

    const player = data.players.find(p => p.id === pid);
    if (!player) { setPageError("Player not found. Check your link."); return; }

    const activeMatch = data.matches.find(
      m => m.status === "IN_PROGRESS" &&
        [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].includes(pid)
    );

    if (activeMatch) {
      const myTeam: "A" | "B" = [activeMatch.teamAPlayer1, activeMatch.teamAPlayer2].includes(pid) ? "A" : "B";
      const newMatch: MatchInfo = {
        matchId: activeMatch.id,
        courtNumber: activeMatch.courtNumber ?? 1,
        myTeam,
        teamAPlayerIds: [activeMatch.teamAPlayer1, activeMatch.teamAPlayer2],
        teamBPlayerIds: [activeMatch.teamBPlayer1, activeMatch.teamBPlayer2],
        pointsA: activeMatch.pointsA ?? 0,
        pointsB: activeMatch.pointsB ?? 0,
        pointsPerMatch: data.pointsPerMatch,
        servesPerRotation: data.servesPerRotation ?? 4,
        firstServeTeam: "A",
      };

      matchRef.current = newMatch;
      setMatch(prev => {
        if (!prev || prev.matchId !== activeMatch.id) {
          // New match — initialise local score from SSE data
          localARef.current = newMatch.pointsA;
          localBRef.current = newMatch.pointsB;
          setLocalA(newMatch.pointsA);
          setLocalB(newMatch.pointsB);
        }
        return newMatch;
      });

      const cur = screenRef.current;
      if (!initializedRef.current || cur === "loading" || cur === "waiting") {
        const total = (activeMatch.pointsA ?? 0) + (activeMatch.pointsB ?? 0);
        goToScreen(total >= data.pointsPerMatch ? "complete" : "scoring");
      }
    } else {
      matchRef.current = null;
      setMatch(null);
      if (!initializedRef.current || screenRef.current === "loading") {
        goToScreen("waiting");
      } else if (screenRef.current === "scoring" || screenRef.current === "serve") {
        goToScreen("waiting");
      }
    }

    initializedRef.current = true;
  }, [pid]);

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`/api/sessions/${code}/stream`);
    esRef.current = es;
    es.onmessage = (e) => {
      try { processSession(JSON.parse(e.data)); setReconnecting(false); } catch {}
    };
    es.onerror = () => {
      es.close(); setReconnecting(true);
      retryRef.current = setTimeout(connect, 3000);
    };
  }, [code, processSession]);

  useEffect(() => {
    fetch(`/api/sessions/${code}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(processSession)
      .catch(() => setPageError("Session not found."));
    connect();
    return () => { esRef.current?.close(); if (retryRef.current) clearTimeout(retryRef.current); };
  }, [code, connect, processSession]);

  useEffect(() => {
    if (screen === "complete" && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [screen]);

  const nameMap = Object.fromEntries(players.map(p => [p.id, p.name]));

  function addPoint(team: "A" | "B") {
    const m = matchRef.current;
    if (!m) return;

    lastTapTeamRef.current = team;

    // Use refs so rapid taps always increment from the true current value
    const newA = team === "A" ? localARef.current + 1 : localARef.current;
    const newB = team === "B" ? localBRef.current + 1 : localBRef.current;
    localARef.current = newA;
    localBRef.current = newB;
    setLocalA(newA);
    setLocalB(newB);

    if (newA + newB >= m.pointsPerMatch) {
      goToScreen("complete");
      // One API call with the final score
      const did = deviceIdRef.current;
      if (did) {
        fetch(`/api/matches/${m.matchId}/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pointsA: newA, pointsB: newB, deviceId: did, isPlayerSubmission: true }),
        }).catch(() => {});
      }
    }
  }

  function undoPoint() {
    if (!matchRef.current) return;
    const lastTeam = lastTapTeamRef.current;
    const newA = lastTeam === "A" ? Math.max(0, localARef.current - 1) : localARef.current;
    const newB = lastTeam === "B" ? Math.max(0, localBRef.current - 1) : localBRef.current;
    localARef.current = newA;
    localBRef.current = newB;
    setLocalA(newA);
    setLocalB(newB);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const cur = screenRef.current;

    if (Math.abs(dy) > 60 && Math.abs(dx) < 40) {
      if (dy < -60 && (cur === "scoring" || cur === "waiting")) {
        e.preventDefault(); setPrevScreen(cur); goToScreen("leaderboard"); return;
      }
      if (dy > 60 && cur === "leaderboard") {
        e.preventDefault(); goToScreen(prevScreen); return;
      }
    }
    if (Math.abs(dx) > 50 && Math.abs(dy) < 30) {
      if (dx > 50 && cur === "scoring") { e.preventDefault(); goToScreen("serve"); return; }
      if (dx < -50 && cur === "serve") { e.preventDefault(); goToScreen("scoring"); return; }
    }
  }

  function onPressStart() { longPressRef.current = setTimeout(undoPoint, 500); }
  function onPressEnd() { if (longPressRef.current) clearTimeout(longPressRef.current); }

  const myTeam = match?.myTeam ?? "A";
  const myScore = myTeam === "A" ? localA : localB;
  const theirScore = myTeam === "A" ? localB : localA;

  const myIds = match ? (myTeam === "A" ? match.teamAPlayerIds : match.teamBPlayerIds) : [];
  const oppIds = match ? (myTeam === "A" ? match.teamBPlayerIds : match.teamAPlayerIds) : [];
  const partnerId = myIds.find(id => id !== pid) ?? "";
  const partnerName = nameMap[partnerId] ?? "Partner";
  const oppName1 = nameMap[oppIds[0]] ?? "Opp 1";
  const oppName2 = nameMap[oppIds[1]] ?? "Opp 2";

  const serveInfo = (() => {
    if (!match) return null;
    const tAN: [string, string] = [nameMap[match.teamAPlayerIds[0]] ?? "A1", nameMap[match.teamAPlayerIds[1]] ?? "A2"];
    const tBN: [string, string] = [nameMap[match.teamBPlayerIds[0]] ?? "B1", nameMap[match.teamBPlayerIds[1]] ?? "B2"];
    return getCurrentServer(match.firstServeTeam, localA + localB, match.servesPerRotation, tAN, tBN);
  })();

  const isMyTeamServing = (() => {
    if (!match || !serveInfo) return false;
    const myNames = myIds.map(id => nameMap[id]);
    return myNames.includes(serveInfo.name);
  })();

  const completedCount = session?.matches.filter(m => m.status === "COMPLETE").length ?? 0;
  const courts = session?.courts ?? 1;
  const roundNumber = Math.floor(completedCount / courts) + 1;

  const nextQueuedMatch = session?.matches.find(
    m => m.status === "PENDING" && [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].includes(pid)
  );

  const wrap: React.CSSProperties = {
    minHeight: "100vh", background: NAVY, color: WHITE,
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    maxWidth: 320, margin: "0 auto", display: "flex", flexDirection: "column",
    userSelect: "none", WebkitUserSelect: "none", touchAction: "pan-y", overflowX: "hidden",
  };

  const divider = <div style={{ height: 1, background: "#333333", margin: "8px 0" }} />;

  function SecTitle({ text }: { text: string }) {
    return <div style={{ fontSize: 14, color: ORANGE, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 600 }}>{text}</div>;
  }

  const ServeDot = () => (
    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: RED, marginLeft: 5, verticalAlign: "middle" }} />
  );

  if (pageError) {
    return (
      <div style={{ ...wrap, alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888888", fontSize: 14, textAlign: "center", padding: 20 }}>{pageError}</div>
      </div>
    );
  }

  // ── SCREEN: loading ──────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <div style={{ ...wrap, alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888888", fontSize: 14, animation: "eps-pulse 1.5s ease-in-out infinite" }}>Connecting...</div>
      </div>
    );
  }

  // ── SCREEN: unsupported ──────────────────────────────────────────────────
  if (screen === "unsupported") {
    return (
      <div style={{ ...wrap, alignItems: "center", justifyContent: "center" }}>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <SecTitle text="WATCH SCORING" />
          {divider}
          <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", lineHeight: 1.5 }}>
            Single Match format uses the player view for scoring.
          </div>
          {divider}
          <div style={{ fontSize: 11, color: "#666", textAlign: "center" }}>
            Open the player view on your phone to score.
          </div>
        </div>
      </div>
    );
  }

  // ── SCREEN: leaderboard ──────────────────────────────────────────────────
  if (screen === "leaderboard") {
    return (
      <div style={wrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {reconnecting && <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: "4px 0" }}>Reconnecting...</div>}
        <div style={{ padding: 16 }}>
          <SecTitle text={`STANDINGS · R${roundNumber}`} />
          {divider}
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>
            {leaderboard.slice(0, 8).map((row, idx) => {
              const isMe = row.id === pid;
              return (
                <div key={row.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "4px 0", color: isMe ? ORANGE : "#dddddd", fontWeight: isMe ? 500 : 400 }}>
                  <span>{idx + 1}. {isMe ? "You" : row.name}</span>
                  <span>{row.diff > 0 ? "+" + row.diff : row.diff}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, fontSize: 10, color: "#444", textAlign: "center" }}>swipe down to go back</div>
        </div>
      </div>
    );
  }

  // ── SCREEN: waiting ──────────────────────────────────────────────────────
  if (screen === "waiting") {
    const waitMins = nextQueuedMatch ? 15 : null;
    return (
      <div style={wrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {reconnecting && <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: "4px 0" }}>Reconnecting...</div>}
        <div style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <SecTitle text={`ROUND ${roundNumber}`} />
          {divider}
          {nextQueuedMatch ? (
            <>
              <div style={{ fontSize: 13, color: "#aaa" }}>
                {nextQueuedMatch.courtNumber ? `Court ${nextQueuedMatch.courtNumber}` : "Court TBD"}{waitMins ? ` · ~${waitMins} min` : ""}
              </div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>vs</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: WHITE, textAlign: "center" }}>
                {(() => {
                  const isMyTeamA = [nextQueuedMatch.teamAPlayer1, nextQueuedMatch.teamAPlayer2].includes(pid);
                  const o1 = isMyTeamA ? nameMap[nextQueuedMatch.teamBPlayer1] : nameMap[nextQueuedMatch.teamAPlayer1];
                  const o2 = isMyTeamA ? nameMap[nextQueuedMatch.teamBPlayer2] : nameMap[nextQueuedMatch.teamAPlayer2];
                  return `${o1 ?? "?"} & ${o2 ?? "?"}`;
                })()}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "#aaa", textAlign: "center" }}>Waiting for next match</div>
          )}
          {divider}
          <div style={{ background: "rgba(0,200,81,0.15)", border: "1px solid rgba(0,200,81,0.4)", borderRadius: 20, padding: "3px 10px", fontSize: 13, color: GREEN }}>
            Waiting...
          </div>
        </div>
      </div>
    );
  }

  // ── SCREEN: complete ─────────────────────────────────────────────────────
  if (screen === "complete") {
    const won = myScore > theirScore;
    const isDraw = myScore === theirScore;
    return (
      <div style={{ ...wrap, alignItems: "center", justifyContent: "center" }}>
        {reconnecting && <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: "4px 0" }}>Reconnecting...</div>}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
          <div style={{ fontSize: 20, color: GREEN, textAlign: "center", marginBottom: 2 }}>✓</div>
          <div style={{ fontSize: 13, color: won ? GREEN : isDraw ? "#aaa" : "#aaa", fontWeight: 500 }}>
            {won ? "You won!" : isDraw ? "Draw" : "You lost"}
          </div>
          {divider}
          <div style={{ fontSize: 32, fontWeight: 500, color: WHITE, textAlign: "center", margin: "5px 0" }}>
            {myScore}–{theirScore}
          </div>
          {divider}
          <button
            onClick={() => goToScreen("waiting")}
            style={{ background: ORANGE, color: WHITE, border: "none", borderRadius: 10, padding: 7, fontSize: 15, fontWeight: 500, width: "100%", cursor: "pointer", minHeight: 44 }}
          >
            Next match
          </button>
        </div>
      </div>
    );
  }

  // ── SCREEN: serve ────────────────────────────────────────────────────────
  if (screen === "serve") {
    return (
      <div style={wrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {reconnecting && <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: "4px 0" }}>Reconnecting...</div>}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <SecTitle text="SERVING NOW" />
          {divider}
          <div style={{ fontSize: 20, fontWeight: 500, color: WHITE, textAlign: "center", margin: "5px 0" }}>
            {serveInfo?.name ?? "—"}
          </div>
          <div style={{ fontSize: 13, color: "#777" }}>Next: {serveInfo?.nextName ?? "—"}</div>
          <div style={{ fontSize: 13, color: "#777", marginTop: 2 }}>{serveInfo?.ptsLeft ?? 0} pts left this rotation</div>
          {divider}
          <div style={{ fontSize: 10, color: "#444" }}>swipe left to score</div>
        </div>
      </div>
    );
  }

  // ── SCREEN: scoring ──────────────────────────────────────────────────────
  const myTopTeam = myTeam;
  const oppTeam = myTeam === "A" ? "B" : "A";

  return (
    <div
      style={{ ...wrap, padding: 0, gap: 3 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {reconnecting && <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>Reconnecting...</div>}

      {/* Your team — top */}
      <div
        style={{ flex: 1, background: "rgba(255,107,0,0.18)", borderRadius: "14px 14px 4px 4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 44, cursor: "pointer" }}
        onClick={() => addPoint(myTopTeam)}
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onTouchStart={(e) => { onTouchStart(e); onPressStart(); }}
        onTouchEnd={(e) => { onPressEnd(); onTouchEnd(e); }}
      >
        <div style={{ fontSize: 13, color: ORANGE, fontWeight: 500 }}>
          You &amp; {partnerName}
          {isMyTeamServing && <ServeDot />}
        </div>
        <div style={{ fontSize: 48, fontWeight: 600, color: WHITE, lineHeight: 1.2 }}>{myScore}</div>
      </div>

      {/* Opponents — bottom */}
      <div
        style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: "4px 4px 14px 14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 44, cursor: "pointer" }}
        onClick={() => addPoint(oppTeam)}
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onTouchStart={(e) => { onTouchStart(e); onPressStart(); }}
        onTouchEnd={(e) => { onPressEnd(); onTouchEnd(e); }}
      >
        <div style={{ fontSize: 13, color: "#aaa" }}>
          {oppName1} &amp; {oppName2}
          {!isMyTeamServing && <ServeDot />}
        </div>
        <div style={{ fontSize: 48, fontWeight: 600, color: "#cccccc", lineHeight: 1.2 }}>{theirScore}</div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  const params = useParams();
  const code = (Array.isArray(params?.code) ? params.code[0] : params?.code ?? "") as string;

  return (
    <Suspense>
      <WatchContent code={code} />
    </Suspense>
  );
}
