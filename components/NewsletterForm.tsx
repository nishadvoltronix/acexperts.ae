"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "./ui";
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION } from "@/lib/newsletter-consent";
import type { PrivacyNotice } from "@/lib/privacy-notice";

export function NewsletterForm({ privacyNotice }: { privacyNotice?: PrivacyNotice | null }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/newsletter/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), consent: data.get("consent") === "on", website: data.get("website"),
          consentVersion: NEWSLETTER_CONSENT_VERSION, noticeVersion: privacyNotice?.version ?? null }),
        signal: AbortSignal.timeout(15_000),
      });
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("message" in result) || typeof result.message !== "string") throw new Error("Invalid response");
      setMessage(result.message);
      if (response.status === 200) form.reset();
    } catch {
      setMessage("We could not confirm your signup request. Check your inbox before trying again later.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit} aria-busy={busy}>
      <label htmlFor="newsletter-email" className="sr-only">Your email address</label>
      <div className="newsletter-input-wrap">
        <input id="newsletter-email" name="email" type="email" autoComplete="email" placeholder="Enter your email" required maxLength={254} aria-describedby="newsletter-status" />
        <button type="submit" className="newsletter-submit" aria-label={busy ? "Submitting newsletter request" : "Subscribe to newsletter"} disabled={busy}>
          <Icon name="send" size={17} />
        </button>
      </div>
      <div className="form-honeypot" aria-hidden="true">
        <label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" maxLength={200} /></label>
      </div>
      <label htmlFor="newsletter-consent" className="newsletter-consent">
        <input id="newsletter-consent" name="consent" type="checkbox" required />
        <span>{NEWSLETTER_CONSENT_TEXT} <Link href={privacyNotice?.url ?? "/contact-us/"}>{privacyNotice ? "Privacy notice" : "Contact us about your data"}</Link>.</span>
      </label>
      <p id="newsletter-status" className="newsletter-status" role="status" aria-live="polite" aria-atomic="true">{message}</p>
    </form>
  );
}
