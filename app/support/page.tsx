import React from "react";
import Link from "next/link";

const BLACK = "#000000";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

const st = {
  page: { minHeight: "100vh", background: BLACK, color: WHITE, padding: 24 } as React.CSSProperties,
  col: { maxWidth: 720, margin: "0 auto", paddingBottom: 60 } as React.CSSProperties,
  back: { color: ORANGE, fontWeight: 900, fontSize: 14, textDecoration: "none", display: "inline-block", marginBottom: 32, marginTop: 16 } as React.CSSProperties,
  title: { fontSize: 32, fontWeight: 1000, color: WHITE, marginBottom: 8 } as React.CSSProperties,
  subtitle: { fontSize: 15, color: WARM_WHITE, opacity: 0.55, marginBottom: 40 } as React.CSSProperties,
  heading: { fontSize: 16, fontWeight: 1000, color: ORANGE, marginTop: 36, marginBottom: 10 } as React.CSSProperties,
  body: { fontSize: 15, lineHeight: 1.75, color: WARM_WHITE, opacity: 0.85 } as React.CSSProperties,
  divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "32px 0" } as React.CSSProperties,
  link: { color: ORANGE, fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
  footer: { fontSize: 12, opacity: 0.35, marginTop: 48, textAlign: "center" as const } as React.CSSProperties,
};

export default function SupportPage() {
  return (
    <div style={st.page}>
      <div style={st.col}>

        <Link href="/" style={st.back}>← Home</Link>

        <div style={st.title}>Support</div>
        <div style={st.subtitle}>We&apos;re here to help.</div>

        {/* Section 1 */}
        <div style={st.heading}>Contact Us</div>
        <div style={st.body}>
          <p style={{ margin: "0 0 12px" }}>For any questions, issues, or feedback, please email us directly at:</p>
          <p style={{ margin: "0 0 12px" }}>
            <a href="mailto:davidbellsa@gmail.com" style={st.link}>davidbellsa@gmail.com</a>
          </p>
          <p style={{ margin: 0 }}>We aim to respond to all enquiries within 48 hours.</p>
        </div>

        <div style={st.divider} />

        {/* Section 2 */}
        <div style={st.heading}>Getting Started</div>
        <div style={st.body}>
          <p style={{ margin: "0 0 12px" }}>EasyPadelScore is a mobile-first padel tournament scoring app. Here&apos;s how it works:</p>
          <ul style={{ margin: 0, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong>Organisers</strong> create a session and share the session link or code with players.</li>
            <li><strong>Players</strong> join by visiting easypadelscore.com and entering the session code — no app download required.</li>
            <li>Scores are submitted in real time and the leaderboard updates automatically after every match.</li>
            <li>An Apple Watch interface is available for organisers who prefer wrist-based scoring.</li>
          </ul>
        </div>

        <div style={st.divider} />

        {/* Section 3 */}
        <div style={st.heading}>Accounts &amp; Sign In</div>
        <div style={st.body}>
          <p style={{ margin: "0 0 12px" }}>EasyPadelScore uses a one-time password (OTP) sign-in. When you enter your email address and tap &quot;Send code&quot;, a 6-digit code is sent to your inbox. Enter the code to sign in — no password required.</p>
          <p style={{ margin: "0 0 12px" }}>If you don&apos;t receive the code:</p>
          <ul style={{ margin: 0, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the correct email address</li>
            <li>Wait 60 seconds before requesting a new code</li>
            <li>Contact us at the email above if the issue persists</li>
          </ul>
        </div>

        <div style={st.divider} />

        {/* Section 4 */}
        <div style={st.heading}>Session Formats</div>
        <div style={st.body}>
          <p style={{ margin: "0 0 12px" }}>EasyPadelScore supports the following Americano formats:</p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong>Mixed Americano</strong> — partners rotate each round; players are paired dynamically</li>
            <li><strong>Team Americano</strong> — fixed pairs compete across rotating opponents</li>
          </ul>
          <p style={{ margin: 0 }}>Sessions support multiple courts and auto-assign matches as rounds progress.</p>
        </div>

        <div style={st.divider} />

        {/* Section 5 */}
        <div style={st.heading}>Apple Watch</div>
        <div style={st.body}>
          <p style={{ margin: "0 0 12px" }}>The Apple Watch interface is available to all account holders. To use it:</p>
          <ol style={{ margin: "0 0 12px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Open EasyPadelScore on your iPhone and sign in</li>
            <li>Navigate to your active session</li>
            <li>Tap the Watch icon to open the Watch scoring view</li>
            <li>On your Apple Watch, open the EasyPadelScore app and enter your session code</li>
          </ol>
          <p style={{ margin: 0 }}>The Watch app connects directly to the session — no iPhone app needs to be open during scoring.</p>
        </div>

        <div style={st.divider} />

        {/* Section 6 */}
        <div style={st.heading}>Pricing</div>
        <div style={st.body}>
          <p style={{ margin: "0 0 12px" }}>Joining a session is always free — no account required. Creating and managing sessions requires a paid plan:</p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong>Bajada</strong> — once-off payment, create one session at a time</li>
            <li><strong>Bandeja</strong> — monthly or annual subscription, one active session at a time</li>
            <li><strong>Vibora</strong> — monthly or annual subscription, unlimited concurrent sessions</li>
          </ul>
          <p style={{ margin: 0 }}>Plan details and pricing are shown during sign-up.</p>
        </div>

        <div style={st.divider} />

        {/* Section 7 */}
        <div style={st.heading}>Privacy</div>
        <div style={st.body}>
          <p style={{ margin: "0 0 12px" }}>We take your privacy seriously. EasyPadelScore does not use advertising, tracking, or third-party analytics. For full details, see our privacy policy:</p>
          <p style={{ margin: 0 }}>
            <Link href="/privacy" style={st.link}>Privacy Policy</Link>
          </p>
        </div>

        <div style={st.divider} />

        {/* Section 8 */}
        <div style={st.heading}>Reporting a Bug</div>
        <div style={st.body}>
          <p style={{ margin: "0 0 12px" }}>Found something that isn&apos;t working? You can report a bug directly in the app using the &quot;🐛 Report a bug&quot; link at the bottom of any page, or email us at:</p>
          <p style={{ margin: "0 0 12px" }}>
            <a href="mailto:davidbellsa@gmail.com" style={st.link}>davidbellsa@gmail.com</a>
          </p>
          <p style={{ margin: 0 }}>Please include the session code (if applicable), the device and OS version, and a description of what happened.</p>
        </div>

        <div style={st.footer}>© 2026 EasyPadelScore. All rights reserved.</div>

      </div>
    </div>
  );
}
