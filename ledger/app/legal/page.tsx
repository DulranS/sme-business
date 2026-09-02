// ---------------------------------------------------------------------------
// Standalone, public, no-auth page (see components/AppShell.tsx —
// isStandalonePage). Static starting-point template, not a form or an
// editor: editing "legally binding text with live state" is exactly the
// kind of scope this app doesn't need. Edit the copy directly in this
// file per deployment/customer (swap [BUSINESS NAME], [CONTACT EMAIL],
// [JURISDICTION], [YOUR COUNTRY]) and redeploy.
//
// IMPORTANT — this is a plain-language starting draft, not legal advice,
// and was not written or reviewed by a lawyer. It exists to close the gap
// between "storing other people's financial and business data" and
// "having said anything at all to that person about it" — not to be a
// final, jurisdiction-correct legal document. Have an actual lawyer
// review and adapt this before relying on it, especially around: which
// country's/state's law governs, data-breach notification obligations,
// and any sector-specific rules that apply to your customers (e.g.
// payroll/employee data in the Employees feature).
// ---------------------------------------------------------------------------

export const metadata = {
  title: "Privacy Policy & Terms — Ledger",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-ink text-fg px-4 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto space-y-12">
        <div>
          <h1 className="text-xl font-display font-medium mb-1">Privacy Policy &amp; Terms of Service</h1>
          <p className="text-sm text-muted">
            For [BUSINESS NAME]. Last updated: [DATE]. Contact: [CONTACT EMAIL].
          </p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-fg/90">
          <h2 className="text-base font-medium">Privacy Policy</h2>

          <p>
            This application (&quot;the App&quot;) is used by [BUSINESS NAME] (&quot;we&quot;, &quot;us&quot;) to record and
            manage business data, including sales, purchases, expenses, customer and supplier
            records, and — if used — employee and payroll information.
          </p>

          <p>
            <strong>What we store.</strong> Data entered into the App by our team (owners,
            managers, and staff), including but not limited to: transaction records, customer and
            supplier names and contact details, product and pricing information, and, where the
            Employees/Time features are used, staff names and hours worked.
          </p>

          <p>
            <strong>Where it&apos;s stored.</strong> Data is stored with our hosting provider (Google
            Firebase) and is not shared with, or sold to, any third party except: (a) the AI
            provider used by the App&apos;s optional Assistant/OCR features, solely to process the
            specific request being made and not for any other purpose, and (b) as required by law.
          </p>

          <p>
            <strong>Who can see it.</strong> Access inside the App is restricted to team members
            we&apos;ve explicitly invited, each limited to the level of access (owner / manager /
            staff) we&apos;ve assigned them.
          </p>

          <p>
            <strong>How long we keep it.</strong> For as long as we use the App to run the
            business, plus [RETENTION PERIOD] after account closure, unless a longer period is
            required by law (e.g. tax record-keeping).
          </p>

          <p>
            <strong>Your rights.</strong> If you are a customer, supplier, or employee whose
            information appears in this system and you&apos;d like to see, correct, or ask us to
            delete it, contact us at [CONTACT EMAIL].
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-fg/90">
          <h2 className="text-base font-medium">Terms of Service (internal use)</h2>

          <p>
            This App is provided for internal use by [BUSINESS NAME] and its invited team
            members only. It is not a public product and no member of the public may create an
            account through it.
          </p>

          <p>
            <strong>No warranty.</strong> The App is provided &quot;as is&quot;. Figures it calculates
            (margins, forecasts, reorder points, anomaly flags, and anything produced by the AI
            Assistant) are decision-support estimates, not audited financial statements or
            professional advice, and should be checked before being relied on for tax, legal, or
            major financial decisions.
          </p>

          <p>
            <strong>Backups.</strong> The App provides an on-demand full data export
            (Import/Export → Download full backup). We are responsible for taking and safely
            storing our own backups; [PROVIDER/DEVELOPER NAME] is not responsible for data loss
            from a backup that was never taken.
          </p>

          <p>
            <strong>Acceptable use.</strong> Team members may only enter data they&apos;re authorized
            to hold, and may not use the App to store data unrelated to [BUSINESS NAME]&apos;s
            operations.
          </p>
        </section>

        <p className="text-xs text-muted border-t border-line pt-6">
          Template starting point — not legal advice, not reviewed by a lawyer. Replace every
          [BRACKETED] field and have this reviewed by someone qualified in your jurisdiction
          before relying on it.
        </p>
      </div>
    </main>
  );
}
