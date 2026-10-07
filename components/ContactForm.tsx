"use client";
import { useState, type FormEvent } from "react";
export function ContactForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [service, setService] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/contact/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json();
      setMessage(result.message);
      if (response.ok) form.reset();
    } catch {
      setMessage(
        "Your message could not be sent. Please call +971 4 824 0002 or email info@voltronix.ae.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="contact-form-section" aria-labelledby="enquiry-title">
      <h2 id="enquiry-title">Send an enquiry</h2>
      <p>Tell us about your air conditioning needs.</p>
      <form onSubmit={submit} className="contact-form">
        <label>
          First Name <span aria-hidden="true">*</span>
          <input
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={100}
          />
        </label>
        <label>
          Last Name
          <input name="lastName" autoComplete="family-name" maxLength={100} />
        </label>
        <label>
          Email ID <span aria-hidden="true">*</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          Company Name
          <input name="company" autoComplete="organization" maxLength={200} />
        </label>
        <label>
          Phone Number
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+971"
            maxLength={30}
          />
        </label>
        <label>
          Mobile Number <span aria-hidden="true">*</span>
          <input
            name="mobile"
            type="tel"
            required
            placeholder="+971"
            maxLength={30}
          />
        </label>
        <label className="full-width">
          Services Looking for? <span aria-hidden="true">*</span>
          <select
            name="service"
            required
            value={service}
            onChange={(event) => setService(event.target.value)}
          >
            <option value="" disabled>
              Select a service
            </option>
            {[
              "Installation",
              "Replacements",
              "Upgrades",
              "Repairs",
              "Solutions",
              "Other",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {service === "Other" && (
          <label className="full-width">
            Please specify the service <span aria-hidden="true">*</span>
            <input name="otherService" required maxLength={200} />
          </label>
        )}
        <label className="full-width">
          Message <span aria-hidden="true">*</span>
          <textarea name="message" required rows={6} maxLength={5000} />
        </label>
        <div className="full-width">
          <button className="button" disabled={busy} type="submit">
            {busy ? "Sending…" : "Submit"}
          </button>
          <p className="form-status" role="status">
            {message}
          </p>
        </div>
      </form>
    </section>
  );
}
