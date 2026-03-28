import Link from "next/link";

const BLACK = "#000000";
const NAVY = "#0D1B2A";
const WHITE = "#FFFFFF";
const ORANGE = "#FF6B00";
const WARM_WHITE = "#F5F5F5";

function Heading({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontSize: 16,
        fontWeight: 1000,
        color: ORANGE,
        marginTop: 36,
        marginBottom: 10,
      }}
    >
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 15,
        lineHeight: 1.75,
        color: WARM_WHITE,
        opacity: 0.85,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: "rgba(255,255,255,0.07)",
        margin: "32px 0",
      }}
    />
  );
}

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: BLACK,
        color: WHITE,
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 60 }}>
        <Link
          href="/"
          style={{
            color: ORANGE,
            fontWeight: 900,
            fontSize: 14,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 32,
            marginTop: 16,
          }}
        >
          ← Home
        </Link>

        <h1
          style={{
            fontSize: 32,
            fontWeight: 1000,
            color: WHITE,
            marginBottom: 8,
            margin: 0,
          }}
        >
          Privacy Policy
        </h1>
        <p
          style={{
            fontSize: 13,
            color: WARM_WHITE,
            opacity: 0.5,
            marginBottom: 40,
            marginTop: 8,
          }}
        >
          Last updated: March 2026
        </p>

        <Heading>Overview</Heading>
        <Body>
          EasyPadelScore is a mobile-first padel tournament management app. We are committed to being
          transparent about how we handle your data. This policy explains what information we collect,
          how we use it, and your rights regarding that information.
        </Body>

        <Divider />

        <Heading>What We Collect</Heading>
        <Body>
          When you use EasyPadelScore, we collect the following information:
        </Body>
        <ul
          style={{
            fontSize: 15,
            lineHeight: 1.75,
            color: WARM_WHITE,
            opacity: 0.85,
            paddingLeft: 24,
            marginTop: 12,
          }}
        >
          <li><strong>Player names</strong> — entered voluntarily when joining a session. These are stored against the session in our database.</li>
          <li><strong>Session codes</strong> — 4-character codes used to identify and join tournament sessions.</li>
          <li><strong>Device identifiers</strong> — a randomly generated ID stored in your browser&apos;s local storage. This is used to associate your device with a session. It is not linked to any personal account.</li>
          <li><strong>Bug reports</strong> — if you submit a bug report, we collect the page URL, session code, and any description you choose to provide.</li>
        </ul>
        <Body>We do not collect email addresses, phone numbers, passwords, or payment information at this time.</Body>

        <Divider />

        <Heading>How We Use Your Data</Heading>
        <Body>The information we collect is used solely to operate the app:</Body>
        <ul
          style={{
            fontSize: 15,
            lineHeight: 1.75,
            color: WARM_WHITE,
            opacity: 0.85,
            paddingLeft: 24,
            marginTop: 12,
          }}
        >
          <li>Player names and session data are used to run tournaments and display scores.</li>
          <li>Device identifiers are used to restore your session if you close and reopen the app.</li>
          <li>Bug reports are used to identify and fix issues with the app.</li>
        </ul>
        <Body>We do not use your data for advertising, profiling, or any purpose beyond operating EasyPadelScore.</Body>

        <Divider />

        <Heading>Data Storage</Heading>
        <Body>
          Session data is stored in a PostgreSQL database hosted on Railway (railway.app), a cloud
          infrastructure provider based in the United States. Data is retained for as long as the
          session is active. We do not currently have an automated deletion schedule, but sessions
          that are no longer active will be purged periodically.
        </Body>
        <br />
        <Body>
          Device identifiers are stored in your browser&apos;s local storage and are not transmitted
          to our servers beyond session association.
        </Body>

        <Divider />

        <Heading>Data Sharing</Heading>
        <Body>
          We do not sell, rent, or share your data with third parties for any commercial purpose.
          Data is shared only with the infrastructure providers necessary to operate the service
          (Railway for hosting and database). These providers have their own privacy policies and
          security practices.
        </Body>

        <Divider />

        <Heading>Your Rights</Heading>
        <Body>
          You have the right to request access to, correction of, or deletion of any personal data
          we hold about you. Since EasyPadelScore does not require account creation, the primary
          personal data we hold is your player name as entered during a session.
        </Body>
        <br />
        <Body>
          To request deletion of your data, please contact us at the email address below and include
          the session code your name was associated with. We will action all requests within 14 days.
        </Body>

        <Divider />

        <Heading>Cookies and Tracking</Heading>
        <Body>
          EasyPadelScore does not use cookies or any third-party tracking or analytics tools. We do
          not run advertising. The only browser storage we use is local storage for session
          continuity on your device.
        </Body>

        <Divider />

        <Heading>Children&apos;s Privacy</Heading>
        <Body>
          EasyPadelScore is not directed at children under the age of 13. We do not knowingly
          collect personal information from children. If you believe a child has provided us with
          personal information, please contact us and we will delete it promptly.
        </Body>

        <Divider />

        <Heading>Changes to This Policy</Heading>
        <Body>
          We may update this privacy policy from time to time. Changes will be reflected by the
          updated date at the top of this page. Continued use of EasyPadelScore after any changes
          constitutes acceptance of the revised policy.
        </Body>

        <Divider />

        <Heading>Contact</Heading>
        <Body>
          If you have any questions about this privacy policy or wish to exercise your data rights,
          please contact us at:{" "}
          <a
            href="mailto:davidbellsa@gmail.com"
            style={{ color: ORANGE, fontWeight: 900 }}
          >
            davidbellsa@gmail.com
          </a>
        </Body>

        <div
          style={{
            fontSize: 12,
            opacity: 0.35,
            marginTop: 48,
            textAlign: "center",
          }}
        >
          © 2026 EasyPadelScore. All rights reserved.
        </div>
      </div>
    </div>
  );
}
