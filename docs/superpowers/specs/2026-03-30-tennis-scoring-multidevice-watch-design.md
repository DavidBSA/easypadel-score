# Tennis Scoring — Multi-device & Watch

**Date:** 2026-03-30
**Status:** Approved
**Formats in scope:** SINGLE (tennis) only. MIXED and TEAM Americano unchanged.

---

## Problem

Match rules for SINGLE format (`sets`, `deuceMode`, `tiebreak`, `superTiebreak`) are stored only in `localStorage` at session creation time. This means:

- A second player joining on their own device cannot load the tennis scoring UI (no rules available).
- The watch cannot score a SINGLE format match (rules are inaccessible; watch currently shows "unsupported" screen).

---

## Solution Overview

1. Persist match rules to the database at session creation.
2. Player page falls back to DB rules when localStorage is empty.
3. Watch page gains a full point-by-point tennis engine for SINGLE format.

---

## Section 1 — Data Layer

### Schema change

Add `matchRules Json?` to the `Session` model in `prisma/schema.prisma`:

```prisma
model Session {
  ...
  matchRules  Json?   // only populated for SINGLE format
  ...
}
```

The field is nullable — MIXED and TEAM sessions leave it `null`.

### Session creation API (`app/api/sessions/route.ts`)

Accept `matchRules` in the POST body for SINGLE format and write it to the DB:

```json
{
  "format": "SINGLE",
  "matchRules": {
    "sets": 3,
    "deuceMode": "star",
    "tiebreak": true,
    "superTiebreak": true
  }
}
```

### Session creation page (`app/session/new/page.tsx`)

For SINGLE format, include `matchRules` in the API payload in addition to the existing `localStorage` write. The localStorage write stays as a fast-path cache.

### SSE stream

No changes needed. The stream returns the full session object, so `matchRules` is automatically included once it exists on the model.

---

## Section 2 — Player Page (Multi-device)

**File:** `app/session/[code]/player/page.tsx`

When `eps_match_rules_${code}` is absent from localStorage (i.e. a second device joining late), fall back to `session.matchRules` fetched from the session API. The existing scoring UI and submission flow are unchanged.

Priority order:
1. localStorage (fast, available immediately)
2. `session.matchRules` from the API response (populated once SSE data arrives)

No structural changes to the multi-device scoring flow. The existing conflict detection (first submission auto-confirms, second checks agreement, conflict flags for organiser) handles all cases.

---

## Section 3 — Watch Page Tennis Engine

**File:** `app/watch/[code]/page.tsx`

### Format routing

When `session.format === "SINGLE"`:
- Remove the "unsupported" screen.
- Use the tennis engine and tennis-specific screens below.
- `session.matchRules` provides all rules.

When `session.format === "MIXED"` or `"TEAM"`:
- Existing Americano scoring unchanged.

### Tennis state

Port the `TSnap` state machine from `app/session/[code]/organiser/page.tsx`. Local React state (mirrored in refs for tap handlers):

```typescript
type TennisState = {
  pA: number;          // 0–3 (maps to 0/15/30/40)
  pB: number;
  adTeam: "A" | "B" | null;
  gamesA: number;
  gamesB: number;
  setsA: number;
  setsB: number;
  setIndex: number;
  isTiebreak: boolean;
  tbA: number;         // tiebreak points
  tbB: number;
  matchOver: boolean;
};
```

Same `addTennisPoint(team)` function as organiser page. Handles all deuce modes (star/golden/traditional), tiebreak at 6-6, super tiebreak for final set.

### New screen types

Added to `WatchScreen`:

| Screen | Trigger |
|---|---|
| `"server-picker"` | Before game 1 and game 2 of each set — blocks scoring until server is chosen |
| `"tennis-scoring"` | Active tennis game — point-by-point tap |
| `"tennis-complete"` | Match over |

Existing screens `"waiting"`, `"leaderboard"`, `"loading"` work unchanged for SINGLE. `"serve"` screen is repurposed for tennis serve info (see below).

### Server picker screen

Appears before game 1 and game 2 of each set. Once both are set, logic auto-rotates for the remainder of the set.

**Display:** "Who is serving?" + two large tappable name buttons showing the two players on the currently-serving team.

**State tracked:**
- `game1ServerId: string | null` — set when user picks game 1 server
- `game2ServerId: string | null` — set when user picks game 2 server
- `currentServerId: string` — derived from game 1/2 choice + game count, auto-advances on game completion

**Serve rotation:**
Game 1 server → game 2 server → partner of game 1 → partner of game 2 → repeat.
At the start of each new set, the team that received in the final game of the previous set serves first. Games 1 and 2 of the new set require the picker again.

**Tiebreak serving:**
No picker needed — server entering the tiebreak is already known. Serve rotates every 2 points during tiebreak; the serve helper screen reflects this.

### Tennis scoring screen layout

Score strip layout (C from visual review):

```
┌─────────────────────────────────┐
│  You & David    ●               │  ← orange bg, red dot = serving
│         30                      │  ← current point (or DEUCE / AD / tiebreak count)
├── 3 ── Set 2 · games ── 4 ──────┤  ← thin strip: your games | label | opp games
│  Declan & Trent                 │  ← grey bg
│         15                      │
└─────────────────────────────────┘
```

**Point display mapping:**

| Internal | Display (normal) | Display (tiebreak) |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 15 | 1 |
| 2 | 30 | 2 |
| 3 | 40 | 3 (etc.) |

**Deuce / Advantage display (text labels — option A from visual review):**

- At deuce: both halves show `DEUCE` in place of point number.
- Advantage: advantage half shows `AD`, other half shows `—`. Advantage half gets a brighter orange background.

**Serve dot (●):** Red dot next to the serving team's name. Moves on every game completion. Same `ServeDot` component already used in Americano scoring.

**Gestures:**
- Tap top half → point to your team
- Tap bottom half → point to opponents
- Long-press (500ms) → undo last point (see note below)
- Swipe right → serve helper screen
- Swipe up → leaderboard screen

**Undo for tennis:** The Americano undo simply decrements a counter. Tennis undo must revert the entire `TennisState` snapshot because a single point can trigger a game win, set win, or match end. Implementation: maintain a `tennisHistory: TennisState[]` stack (ref). Each `addTennisPoint` call pushes the pre-tap state onto the stack. Long-press pops the stack and restores the previous snapshot. Stack is capped at 10 entries.

### Serve helper screen (tennis)

Swipe right from tennis-scoring. Shows:
- Current server name
- Next game's server name
- Game number in set (e.g. "Game 4 of Set 2")
- During tiebreak: shows point-based rotation ("Serving: X · changes in 1 pt")

### Tennis complete screen

```
┌─────────────────────────────────┐
│           ✓                     │
│       You won!                  │
│  ─────────────────────────────  │
│           2–1                   │
│           sets                  │
│  ─────────────────────────────  │
│  [ Done ]                       │
└─────────────────────────────────┘
```

Sets only — no per-set breakdown on watch (full detail available on organiser/player mobile views). "Done" button returns to waiting screen.

### Submission

When `matchOver` is true, single API call:

```json
POST /api/matches/{id}/score
{ "pointsA": 2, "pointsB": 1, "deviceId": "...", "isPlayerSubmission": true }
```

Same endpoint and payload shape as Americano and existing SINGLE player submission. `pointsA`/`pointsB` = sets won.

---

## Section 4 — Unchanged

- `/api/matches/[id]/score` — no changes
- `/api/sessions/[code]/stream` — no changes (returns full session including `matchRules`)
- Organiser page — no changes
- MIXED / TEAM Americano watch scoring — no changes
- Leaderboard screen — no changes (sets won feed into leaderboard the same way)

---

## Files changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `matchRules Json?` to `Session` |
| `app/api/sessions/route.ts` | Accept and persist `matchRules` for SINGLE |
| `app/session/new/page.tsx` | Include `matchRules` in API payload |
| `app/session/[code]/player/page.tsx` | Fall back to `session.matchRules` when localStorage empty |
| `app/watch/[code]/page.tsx` | Full tennis engine, new screens, serve tracker |
| DB migration | `prisma migrate dev --name add-session-match-rules` |
