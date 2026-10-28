import Link from "next/link";
export default function PrivacyPage() {
  return (
    <main id="main" className="page-width prose-page">
      <p className="eyebrow">YOUR CELEBRATION. YOUR INFORMATION.</p>
      <h1>Privacy, in plain language.</h1>
      <h2>Saved in this browser</h2>
      <p>
        EventGenie stores plans, checklist progress and wizard drafts in
        IndexedDB on your current browser. They do not automatically sync across
        devices. Clearing browser data, using a private session, or changing
        browsers may remove access to them. You can delete individual plans from
        My plans.
      </p>
      <h2>When you generate with AI</h2>
      <p>
        Necessary event requirements, including any notes you enter, are sent
        through our server to Google’s Gemini API. Avoid entering guest lists,
        phone numbers, addresses or other unnecessary sensitive personal
        information. The API key stays on the server and is never part of the
        model prompt.
      </p>
      <p>
        Google’s free-tier terms allow submitted content to be used to improve
        its products. Review{" "}
        <a href="https://ai.google.dev/gemini-api/terms">
          Google’s Gemini API terms
        </a>{" "}
        before sharing sensitive information.
      </p>
      <h2>Planning decisions and backups</h2>
      <p>
        Manual vendor quotes, optional vendor contacts, paid-amount records,
        scenarios and event-day schedules stay in this browser. Targeted AI
        operations exclude event titles, vendor names and contacts, guest lists,
        existing invitation text and private notes. They send only necessary
        event/category figures, an applicable time window and the preferences
        you explicitly enter. Do not enter names or other sensitive information
        in AI preferences.
      </p>
      <p>
        JSON backups contain only the selected event and its owned decisions,
        and may include private contacts or notes. Import files are validated
        locally and are never uploaded. Restoring creates a separate event
        instead of replacing your current plan. Protect downloaded backups,
        calendars and printed copies.
      </p>
      <h2>No hidden sharing</h2>
      <p>
        EventGenie keeps up to 20 reversible local changes and five saved
        answers per event. History does not duplicate AI caches or
        conversations. The assistant, task and contingency requests exclude
        private task titles, vendor contacts and full records. Only relevant
        category/date/status facts and your bounded question or preferences go
        to Google. Invitation messages, verified venue/time and RSVP details
        stay local; optional AI generates generic opening and closing prose.
        Native sharing opens only when you select Share, and Copy and Download
        remain available. Backups omit history, conversations and disposable AI
        caches.
      </p>
      <p>
        EventGenie has no accounts, cloud database, analytics, invitation
        delivery or public plan sharing. Personalised results are reused only
        from this browser. Demo plans are clearly labelled and do not call
        Google.
      </p>
      <h2>Planning estimates</h2>
      <p>
        Budget allocations are estimates, not vendor quotes. Supplier checklists
        contain categories, not verified businesses. Confirm prices,
        permissions, dietary arrangements and accessibility with your suppliers.
      </p>
      <Link className="button" href="/plan">
        Back to planning
      </Link>
    </main>
  );
}
