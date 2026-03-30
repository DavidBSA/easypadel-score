# EasyPadelScore — Claude Context

## Project

Padel/tennis session scoring web app. Players create sessions, others join via link, scores are tracked live. Includes an Apple Watch-optimised scoring interface.

**URL:** easypadelscore.com
**Stack:** Next.js App Router, React 19, TypeScript, Prisma v7, PostgreSQL (Railway), Resend (email)
**Styles:** Inline `CSSProperties` only — no Tailwind. Colours: `NAVY=#0D1B2A`, `WHITE=#FFFFFF`, `ORANGE=#FF6B00`, `GREEN=#00C851`, `RED=#FF4040`
**Auth:** 6-digit OTP email (Resend), 60-day sessions
**DB:** Railway PostgreSQL. Single squashed baseline migration as of 2026-03-30.

## Session Formats

- **SINGLE** — tennis scoring (sets, deuce modes, tiebreak, super tiebreak). Match rules stored in `Session.matchRules` (Json).
- **MIXED** / **TEAM** — Americano padel scoring (points per match, serves per rotation).

## Key Files

| File | Purpose |
|---|---|
| `app/session/new/page.tsx` | Session creation UI |
| `app/session/[code]/organiser/page.tsx` | Organiser scoring view |
| `app/session/[code]/player/page.tsx` | Player scoring view |
| `app/watch/[code]/page.tsx` | Apple Watch scoring UI |
| `app/api/sessions/route.ts` | Session creation API |
| `app/api/sessions/[code]/stream/route.ts` | SSE stream (live updates) |
| `app/api/matches/[id]/score/route.ts` | Score submission API |
| `prisma/schema.prisma` | DB schema |

## Completed Features (as of 2026-03-30)

- [x] Stage 1: Basic session/match/scoring flow (Americano)
- [x] Stage 2: Bug reports + Resend API integration
- [x] Stage 3a: Account + magic link auth
- [x] Stage 3b: Session creation gate + account status UI
- [x] Stage 3c: OTP auth (6-digit code, 60-day sessions)
- [x] Stage 4: Watch interface + "Open on Watch" button
- [x] Stage 5: Watch page bug fixes (local-only scoring, viewport, fonts)
- [x] Tennis scoring — multi-device + Apple Watch:
  - `matchRules Json?` persisted to DB on session creation
  - Player page falls back to DB rules on second device
  - Watch page: full tennis engine (sets, deuce modes, tiebreak, super tiebreak)
  - Watch page: server picker screen, tennis scoring screen, tennis complete screen
  - Star point deciding-point bug fixed in organiser + watch

## Dev Notes

- No automated test suite — manual verification only.
- `addTennisPoint` is the shared tennis state machine (organiser + watch). Keep in sync if modified.
- `getScoreDisplay` on the watch differs from organiser: returns `"DEUCE"/"DEUCE"` and `"AD"/"—"` (text labels) instead of `"40"/"40"`.
- Test account: `davidbellsa@gmail.com`, VIBORA package.
