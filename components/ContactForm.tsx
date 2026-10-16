"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  ZOHO_CONTACT_ACTION,
  ZOHO_CONTACT_FIELDS,
  ZOHO_CONTACT_FORM_ID,
  ZOHO_CONTACT_FORM_NAME,
} from "@/lib/zoho-contact";
import { parseZohoContactResponse } from "@/lib/zoho-contact-response";
import { ZohoContactTracking, trackZohoSubmission } from "./ZohoContactTracking";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const unconfirmedMessage =
  "We could not confirm delivery of your enquiry. Please call +971 4 824 0002 or email info@voltronix.ae before sending it again.";

export function ContactForm({ privacyNoticeUrl }: { privacyNoticeUrl?: string }) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || submitting.current) return;
    const form = event.currentTarget;
    // Zoho's exported mandatory check also rejects whitespace-only answers.
    for (const field of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[required]")) {
      if (!field.value.trim()) {
        field.setCustomValidity("Please complete this field.");
        field.reportValidity();
        return;
      }
    }
    if (!form.reportValidity()) return;
    const nativeEvent = event.nativeEvent;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      trackZohoSubmission(nativeEvent);
      const data = new FormData(form);
      if (new URLSearchParams(window.location.search).get("service") === "smarturl") {
        data.set("service", "smarturl");
      }
      const response = await fetch(ZOHO_CONTACT_ACTION, {
        method: "POST",
        body: data,
        cache: "no-cache",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Unconfirmed CRM response");
      }
      const result = parseZohoContactResponse(await response.json(), window.location.origin);
      if (result.kind === "success") {
        trackZohoSubmission(nativeEvent, true);
        // The exported reset control is named "reset", which shadows form.reset.
        HTMLFormElement.prototype.reset.call(form);
        setMessage(result.message);
      } else if (result.kind === "redirect") {
        trackZohoSubmission(nativeEvent, true);
        // Preserve the enquiry if navigation is interrupted.
        window.location.assign(result.url);
      } else {
        setMessage(result.kind === "error" ? result.message : unconfirmedMessage);
      }
    } catch {
      setMessage(unconfirmedMessage);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="contact-form-section crmWebToEntityForm" aria-labelledby="enquiry-title">
      <h2 id="enquiry-title">Send an enquiry</h2>
      <p>Tell us about your air conditioning needs.</p>
      <form
        id={ZOHO_CONTACT_FORM_ID}
        name={ZOHO_CONTACT_FORM_NAME}
        className="contact-form"
        action={ZOHO_CONTACT_ACTION}
        method="POST"
        encType="multipart/form-data"
        acceptCharset="UTF-8"
        aria-busy={busy}
        onSubmit={submit}
        onInput={(event) => {
          const field = event.target;
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
            field.setCustomValidity("");
          }
        }}
        onReset={() => setMessage("")}
      >
        {Object.entries(ZOHO_CONTACT_FIELDS).map(([name, value]) => (
          <input key={name} type="hidden" name={name} defaultValue={value} />
        ))}
        <div className="form-honeypot" aria-hidden="true">
          <label>Leave this field empty<input name="aG9uZXlwb3Q" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        </div>
        <label className="full-width">
          Department <span aria-hidden="true">*</span>
          <select id="LEADCF2" name="LEADCF2" defaultValue="" required>
            <option value="" disabled>Select a department</option>
            <option value="VOLTRONIX CONTRACTING LLC">VOLTRONIX CONTRACTING LLC</option>
            <option value="VOLTRONIX SWITCHGEAR LLC">VOLTRONIX SWITCHGEAR LLC</option>
          </select>
        </label>
        <label>
          First Name <span aria-hidden="true">*</span>
          <input id="First_Name" name="First Name" autoComplete="given-name" maxLength={40} required />
        </label>
        <label>
          Last Name <span aria-hidden="true">*</span>
          <input id="Last_Name" name="Last Name" autoComplete="family-name" maxLength={80} required />
        </label>
        <label>
          Email ID <span aria-hidden="true">*</span>
          <input id="Email" type="email" name="Email" autoComplete="email" placeholder="you@company.com" maxLength={100} required />
        </label>
        <label>
          Company Name
          <input id="Company" name="Company" autoComplete="organization" maxLength={200} />
        </label>
        <label>
          Mobile Number <span aria-hidden="true">*</span>
          <input id="Mobile" type="tel" name="Mobile" autoComplete="tel" placeholder="+971 50 000 0000" maxLength={30} required />
        </label>
        <label>
          Project Name <span aria-hidden="true">*</span>
          <input id="LEADCF9" name="LEADCF9" maxLength={255} required />
        </label>
        <label className="full-width">
          Project Details / Service Required <span aria-hidden="true">*</span>
          <textarea id="LEADCF12" name="LEADCF12" rows={6} placeholder="Tell us which service you need, your location and preferred timeline." required />
        </label>
        <div className="full-width">
          {privacyNoticeUrl && <p><a href={privacyNoticeUrl}>Privacy notice</a></p>}
          <div className="contact-form-actions">
            <button id="formsubmit" className="button formsubmit" type="submit" disabled={!ready || busy}>
              {busy ? "Sending…" : "Send enquiry"}
            </button>
            <button className="button button-secondary" type="reset" name="reset" disabled={!ready || busy}>Reset</button>
          </div>
          <p className="form-status" role="status" aria-live="polite" aria-atomic="true">{message}</p>
          <noscript>
            <p>Enable JavaScript to send this form, or <a href="tel:+97148240002">call +971 4 824 0002</a> or <a href="mailto:info@voltronix.ae">email info@voltronix.ae</a>.</p>
          </noscript>
        </div>
      </form>
      <ZohoContactTracking />
    </section>
  );
}
