# Step 2 — Privacy Policy Page

You are working on EasyPadelScore, a Next.js App Router app (React 19, TypeScript). Styling is inline CSSProperties only — no Tailwind. Colours: BLACK=#000000, NAVY=#0D1B2A, WHITE=#FFFFFF, ORANGE=#FF6B00, WARM_WHITE=#F5F5F5.

Create one new file only. Do not touch any other files.

---

## FILE — app/privacy/page.tsx

A static server component (no `"use client"` needed). Renders the full privacy policy page.

### Layout
- Full page: `minHeight: "100vh"`, `background: BLACK`, `color: WHITE`, `padding: 24`
- Centered content column: `maxWidth: 720`, `margin: "0 auto"`, `paddingBottom: 60`
- Back link at the top: plain text link `"← Home"` that navigates to `/` — style as `color: ORANGE`, `fontWeight: 900`, `fontSize: 14`, `textDecoration: "none"`, `display: "inline-block"`, `marginBottom: 32`, `marginTop: 16`

### Typography
- Page title `"Privacy Policy"`: `fontSize: 32`, `fontWeight: 1000`, `color: WHITE`, `marginBottom: 8`
- Subtitle `"Last updated: March 2026"`: `fontSize: 13`, `color: WARM_WHITE`, `opacity: 0.5`, `marginBottom: 40`
- Section headings: `fontSize: 16`, `fontWeight: 1000`, `color: ORANGE`, `marginTop: 36`, `marginBottom: 10`
- Body text: `fontSize: 15`, `lineHeight: 1.75`, `color: WARM_WHITE`, `opacity: 0.85`
- Divider between sections: `height: 1`, `background: "rgba(255,255,255,0.07)"`, `margin: "32px 0"`
- Email links: `color: ORANGE`, `fontWeight: 900`

### Content

Render the following sections exactly as written. Use a heading component for orange headings and a paragraph component for body text.

---

**Page title:** Privacy Policy
**Subtitle:** Last updated: March 2026

---

**Section 1 heading:** Overview

**Body:**
EasyPadelScore is a mobile-first padel tournament management app. We are committed to being transparent about how we handle your data. This policy explains what information we collect, how we use it, and your rights regarding that information.

---

**Section 2 heading:** What We Collect

**Body:**
When you use EasyPadelScore, we collect the following information:

- **Player names** — entered voluntarily when joining a session. These are stored against the session in our database.
- **Session codes** — 4-character codes used to identify and join tournament sessions.
- **Device identifiers** — a randomly generated ID stored in your browser's local storage. This is used to associate your device with a session. It is not linked to any personal account.
- **Bug reports** — if you submit a bug report, we collect the page URL, session code, and any description you choose to provide.

We do not collect email addresses, phone numbers, passwords, or payment information at this time.

---

**Section 3 heading:** How We Use Your Data

**Body:**
The information we collect is used solely to operate the app:

- Player names and session data are used to run tournaments and display scores.
- Device identifiers are used to restore your session if you close and reopen the app.
- Bug reports are used to identify and fix issues with the app.

We do not use your data for advertising, profiling, or any purpose beyond operating EasyPadelScore.

---

**Section 4 heading:** Data Storage

**Body:**
Session data is stored in a PostgreSQL database hosted on Railway (railway.app), a cloud infrastructure provider based in the United States. Data is retained for as long as the session is active. We do not currently have an automated deletion schedule, but sessions that are no longer active will be purged periodically.

Device identifiers are stored in your browser's local storage and are not transmitted to our servers beyond session association.

---

**Section 5 heading:** Data Sharing

**Body:**
We do not sell, rent, or share your data with third parties for any commercial purpose. Data is shared only with the infrastructure providers necessary to operate the service (Railway for hosting and database). These providers have their own privacy policies and security practices.

---

**Section 6 heading:** Your Rights

**Body:**
You have the right to request access to, correction of, or deletion of any personal data we hold about you. Since EasyPadelScore does not require account creation, the primary personal data we hold is your player name as entered during a session.

To request deletion of your data, please contact us at the email address below and include the session code your name was associated with. We will action all requests within 14 days.

---

**Section 7 heading:** Cookies and Tracking

**Body:**
EasyPadelScore does not use cookies or any third-party tracking or analytics tools. We do not run advertising. The only browser storage we use is local storage for session continuity on your device.

---

**Section 8 heading:** Children's Privacy

**Body:**
EasyPadelScore is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.

---

**Section 9 heading:** Changes to This Policy

**Body:**
We may update this privacy policy from time to time. Changes will be reflected by the updated date at the top of this page. Continued use of EasyPadelScore after any changes constitutes acceptance of the revised policy.

---

**Section 10 heading:** Contact

**Body:**
If you have any questions about this privacy policy or wish to exercise your data rights, please contact us at:

Render the email as a clickable mailto link: davidbellsa@gmail.com

---

### Footer
Below the last section, add a small footer line:
- Text: `"© 2026 EasyPadelScore. All rights reserved."`
- Style: `fontSize: 12`, `opacity: 0.35`, `marginTop: 48`, `textAlign: "center"`

---

## Rules
- Inline CSSProperties only — no Tailwind, no CSS modules
- Server component — no `"use client"` directive
- Full file replacement — no partial diffs
- Do not touch any other files
- Do not touch anything under `app/americano/` (System 1 — legacy)
