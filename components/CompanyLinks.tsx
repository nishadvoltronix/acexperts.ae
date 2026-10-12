import Link from "next/link";

/** Company destinations restored from the original site's header and footer. */
export function CompanyLinks({ label = "Voltronix Group companies" }: { label?: string }) {
  return (
    <nav className="company-links" aria-label={label}>
      <a href="https://voltronix.ae">Contracting</a>
      <a href="https://dewaapprovals.ae">DEWA Approvals</a>
      <Link href="/" className="company-current">AC Experts</Link>
      <a href="https://switchgear.ae">Switchgear</a>
    </nav>
  );
}

export function SocialLinks({ label = "Social media" }: { label?: string }) {
  return (
    <nav className="social-links" aria-label={label}>
      <a href="https://www.facebook.com/voltronixuae" aria-label="Voltronix on Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 21v-8h3l.5-4H14V7c0-1 .4-2 2-2h2V1.5C17 1.2 16 1 15 1c-3 0-5 2-5 5v3H7v4h3v8h4Z" /></svg>
      </a>
      <a href="https://www.instagram.com/vtnxllc" aria-label="Voltronix on Instagram">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg>
      </a>
      <a href="https://www.linkedin.com/company/voltronix-uae/" aria-label="Voltronix on LinkedIn">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 8h4v13H4V8Zm2-7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm5 7h4v2c1-2 6-3 7 2v9h-4v-8c0-3-3-3-3 0v8h-4V8Z" /></svg>
      </a>
      <a href="https://x.com/nstsllc" aria-label="Voltronix on X">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 3 13 18h4L8 3H4Zm0 18L20 3" /></svg>
      </a>
    </nav>
  );
}
