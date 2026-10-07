"use client";

import { useState, type FormEvent } from "react";
import { site } from "@/lib/site";
import { Icon } from "./ui";

export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit}>
      <label htmlFor="newsletter-email" className="sr-only">Your email address</label>
      <div className="newsletter-input-wrap">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          required
          aria-describedby={submitted ? "newsletter-status" : undefined}
        />
        <button type="submit" className="newsletter-submit" aria-label="Subscribe to newsletter">
          <Icon name="send" size={17} />
        </button>
      </div>
      <p id="newsletter-status" className="newsletter-status" role="status">
        {submitted && <>
          Online newsletter signup is not available yet. Your email has not been
          sent or saved. Contact <a href={`mailto:${site.email}`}>{site.email}</a> for updates.
        </>}
      </p>
    </form>
  );
}
