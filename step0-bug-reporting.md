# Step 0 — Bug Reporting System

You are working on EasyPadelScore, a Next.js App Router app (React 19, TypeScript, Prisma v7, PostgreSQL) deployed on Railway at easypadelscore.com. Styling is inline CSSProperties only — no Tailwind. Colours: BLACK=#000000, NAVY=#0D1B2A, WHITE=#FFFFFF, ORANGE=#FF6B00, WARM_WHITE=#F5F5F5, GREEN=#00C851, RED=#FF4040.

Build a full bug reporting system across 6 files. Complete them in order, one at a time, waiting for confirmation before proceeding to the next.

---

## FILE 1 — prisma/schema.prisma

Add the following model to the EXISTING schema (do not replace the file — append this model only):

```prisma
model BugReport {
  id          String    @id @default(cuid())
  pageUrl     String
  sessionCode String?
  userNote    String?
  status      String    @default("OPEN")
  createdAt   DateTime  @default(now())
  resolvedAt  DateTime?
}
```

After showing the model addition, instruct the user to run these two commands in PowerShell from the project root:

```
npx prisma migrate dev --name add_bug_report
npx prisma generate
```

---

## FILE 2 — app/api/bugs/route.ts

POST endpoint. Accepts JSON body: `{ pageUrl, sessionCode?, userNote? }`

- Saves a new BugReport to the DB with status "OPEN"
- Sends an email via Resend using a direct fetch call (no npm package):
  - URL: `POST https://api.resend.com/emails`
  - Header: `Authorization: Bearer ${process.env.RESEND_API_KEY}`
  - Header: `Content-Type: application/json`
  - Body:
    ```json
    {
      "from": "EasyPadelScore <bugs@easypadelscore.com>",
      "to": ["davidbellsa@gmail.com"],
      "subject": "🐛 New Bug Report — EasyPadelScore",
      "html": "<h2>New Bug Report</h2><p><b>Page:</b> {pageUrl}</p><p><b>Session:</b> {sessionCode ?? 'N/A'}</p><p><b>Note:</b> {userNote ?? 'None'}</p><p><b>Time:</b> {new Date().toISOString()}</p>"
    }
    ```
- Returns `{ id }` of the created report on success
- Returns 400 if pageUrl is missing
- Returns 500 with `{ error }` on failure — catch errors, do not throw
- Import prisma from `lib/prisma` — path: `../../../lib/prisma`

---

## FILE 3 — app/api/bugs/[id]/resolve/route.ts

PATCH endpoint. Accepts JSON body: `{ adminPin }`

- Validates `adminPin === process.env.ADMIN_PIN` — return 403 if mismatch
- Updates BugReport by id: set `status = "RESOLVED"`, `resolvedAt = new Date()`
- Returns `{ success: true }`
- Params must be awaited: `const { id } = await params`

---

## FILE 4 — components/BugReportButton.tsx

`"use client"` floating bug report button and modal. No external dependencies.

### Button
- Fixed position, bottom-right corner: `bottom: 20, right: 20, zIndex: 9999`
- Style: 48x48px circle, background ORANGE, color WHITE, fontSize 20, borderRadius 999, border none, cursor pointer, boxShadow `"0 4px 16px rgba(0,0,0,0.4)"`
- Content: `"🐛"`
- On click: opens modal

### Modal overlay
- Fixed, full screen, background `"rgba(0,0,0,0.7)"`, zIndex 10000, display flex, alignItems center, justifyContent center

### Modal card
- Background NAVY, borderRadius 20, padding 24, width "90%", maxWidth 400, border `"1px solid rgba(255,255,255,0.1)"`
- Title: "Report a Bug", fontSize 18, fontWeight 1000, color WHITE, marginBottom 16

### Modal content
- Two read-only info lines (dim text, not inputs):
  - **Page:** current `window.location.href` — captured via `useEffect` on mount
  - **Session:** 4-character code extracted from URL path after `/session/` — show "N/A" if not present
- One textarea for optional note:
  - Placeholder: `"Describe what went wrong (optional)"`
  - rows 4, full width, background `"rgba(255,255,255,0.07)"`, color WHITE
  - border `"1px solid rgba(255,255,255,0.14)"`, borderRadius 12, padding 12
  - fontSize 14, outline none, resize vertical, fontFamily inherit

### Buttons
- Row with two buttons: "Cancel" (grey style) and "Send Report" (ORANGE style)
- On submit: POST to `/api/bugs` with `{ pageUrl, sessionCode, userNote }`
- Button states: idle → "Sending…" (loading) → "✓ Report sent — thanks!" (success, auto-close after 2s)
- On error: show `"Something went wrong. Try again."` in red below buttons

### State
- `isOpen`, `note`, `status` ("idle" | "sending" | "success" | "error"), `pageUrl`, `sessionCode`
- Capture `pageUrl` and `sessionCode` in a `useEffect` on mount

---

## FILE 5 — app/layout.tsx

Read the existing file first before making any changes. Then:

- Import `BugReportButton` from `"@/components/BugReportButton"`
- Render `<BugReportButton />` just before the closing `</body>` tag
- Do not change anything else in the file

---

## FILE 6a — app/admin/bugs/page.tsx

`"use client"` PIN-gated admin dashboard.

### PIN gate
- On load: show a full-page centered card (NAVY background) with a PIN input and "Enter" button
- On submit: fetch `GET /api/admin/bugs?adminPin={pin}`
- If 403: show "Incorrect PIN" error
- If 200: store pin in state and show the dashboard

### Dashboard
- Title: "Bug Reports" with a count badge
- Filter buttons: ALL / OPEN / RESOLVED
- Refresh button top-right

### Bug report cards
Each report shows:
- Status pill: OPEN = ORANGE border/background, RESOLVED = GREEN border/background
- Page URL (truncated if long)
- Session code (or "N/A")
- User note (or "None")
- `createdAt` formatted as local date string
- If status is OPEN: "Mark Resolved" button → PATCH `/api/bugs/{id}/resolve` with `{ adminPin }` → refresh list

### Empty state
Show `"No reports yet."` when list is empty.

---

## FILE 6b — app/api/admin/bugs/route.ts

GET endpoint:

- Read `adminPin` from query params: `url.searchParams.get("adminPin")`
- Validate against `process.env.ADMIN_PIN` — return 403 if wrong
- Return all BugReports ordered by `createdAt` descending
- Import prisma from `lib/prisma` — path: `../../../../lib/prisma`

---

## Environment Variables

After all files are complete, instruct the user to add these to their Railway environment variables dashboard:

```
RESEND_API_KEY=<Resend API key from resend.com dashboard>
ADMIN_PIN=<4–6 digit PIN of your choice>
```

Also remind the user:

> Resend requires domain verification before emails can be sent from a custom domain address. The `from` address `bugs@easypadelscore.com` will not work until `easypadelscore.com` is verified in the Resend dashboard via DNS records. For testing before domain verification is complete, temporarily change the `from` address to `onboarding@resend.dev` (Resend's sandbox sender).

---

## Rules

- Inline CSSProperties only — no Tailwind, no CSS modules
- Full file replacements only — no partial diffs or fragments
- One file at a time — wait for "done" confirmation before the next file
- Do not touch any files under `app/americano/` (System 1 — legacy, do not modify)
- All API route handlers that use dynamic params must await them: `const { id } = await params`
