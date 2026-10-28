import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="page-width empty-state">
      <h1>A little off the itinerary.</h1>
      <p>That page could not be found.</p>
      <Link className="button" href="/">
        Back to EventGenie
      </Link>
    </main>
  );
}
