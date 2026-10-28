import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "../features/decisions/studio.css";
import "../features/intelligence/intelligence.css";

export const metadata: Metadata = {
  title: "EventGenie — Make room for the celebration",
  description:
    "Thoughtful AI event plans, exact budgets, and a little less overwhelm. Made for celebrations in India.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="EventGenie home">
            <span className="brand-symbol" aria-hidden="true">
              ✳
            </span>{" "}
            eventgenie<span className="brand-dot">.</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/#how-it-works" className="nav-about">
              How it works
            </Link>
            <Link href="/plans">My plans</Link>
            <Link href="/plan" className="button button-small">
              Plan an event <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <Link className="brand" href="/">
            eventgenie.
          </Link>
          <p>A little planning. A lot to celebrate.</p>
          <Link href="/privacy">Privacy & local storage</Link>
        </footer>
      </body>
    </html>
  );
}
