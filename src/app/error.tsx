"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="page-width empty-state">
      <h1>Let’s take a moment.</h1>
      <p role="alert">
        This page could not be opened. Your saved plans remain in this browser.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <Link className="text-link" href="/plans">
        Open My plans
      </Link>
    </main>
  );
}
