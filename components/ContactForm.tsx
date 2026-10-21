"use client";

import { useEffect, useRef } from "react";

const formOrigin = "https://forms.zohopublic.com";
const formKey = "-_F4cEostcoaZhL2qx8mAUiQiXG49dhtpAN5rrzPXNU";
const formUrl = `${formOrigin}/voltronixswitchgearllc/form/AcRepaircontactus/formperma/${formKey}?zf_rszfm=1`;

export function ContactForm({ privacyNoticeUrl }: { privacyNoticeUrl?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;

    // Zoho reports content height when fields or the viewport change.
    const resizeForm = (event: MessageEvent) => {
      if (event.origin !== formOrigin || event.source !== iframe.contentWindow || typeof event.data !== "string") return;
      const parts = event.data.split("|");
      if (parts[0] !== formKey || parts.length < 2 || parts.length > 3 ||
          (parts.length === 3 && parts[2] !== "scroll") || !/^\d+(?:\.\d+)?$/.test(parts[1])) return;
      const height = Number(parts[1]);
      if (!Number.isFinite(height) || height <= 0 || height > 20000) return;
      iframe.style.height = `${Math.ceil(height) + 20}px`;
    };

    window.addEventListener("message", resizeForm);
    return () => window.removeEventListener("message", resizeForm);
  }, []);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe || /[?&]referrername=/.test(iframe.src)) return;

    // Run Zoho's supplied referrer logic after hydration, without an inline script.
    let referrer = window.location.href;
    try {
      referrer = window.self !== window.top
        ? window.top?.location.href || referrer
        : /^https?:\/\/[\w.-]+\.[a-zA-Z]{2,}/i.test(referrer) ? referrer : "";
    } catch {
      // A cross-origin parent is inaccessible; retain this page's URL.
    }
    if (!referrer) return;
    if (referrer.length > 1800) {
      const queryIndex = referrer.indexOf("?");
      if (queryIndex > -1) referrer = referrer.substring(0, queryIndex);
      referrer = referrer.substring(0, 1800);
    }
    iframe.src += (iframe.src.indexOf("?") > 0 ? "&" : "?") + "referrername=" + encodeURIComponent(referrer);
  }, []);

  return (
    <section className="contact-form-section" aria-labelledby="enquiry-title">
      <h2 id="enquiry-title">Send an enquiry</h2>
      <p>Tell us about your air conditioning needs.</p>
      <iframe
        ref={frame}
        id="ziframe_850132"
        title="AcRepair contact us"
        aria-label="AcRepair contact us"
        frameBorder="0"
        style={{ height: "1100px", width: "99%", border: "none", display: "block" }}
        src={formUrl}
      />
      {privacyNoticeUrl && <p><a href={privacyNoticeUrl}>Privacy notice</a></p>}
      <noscript>
        <p>Enable JavaScript to send this form, or <a href="tel:+97148240002">call +971 4 824 0002</a> or <a href="mailto:info@voltronix.ae">email info@voltronix.ae</a>.</p>
      </noscript>
    </section>
  );
}
