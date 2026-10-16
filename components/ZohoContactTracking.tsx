"use client";

import { useEffect } from "react";
import Script from "next/script";
import {
  ZOHO_CONTACT_ANALYTICS_URL,
  ZOHO_CONTACT_FORM_ID,
  ZOHO_CONTACT_FORM_KEY,
  ZOHO_CONTACT_FORM_NAME,
} from "@/lib/zoho-contact";

type TrackingForm = Record<string, unknown> & { name: string };
type ZohoTracker = {
  wfa_submit?: (event: Event) => void;
  wfa_post_submit?: (event: Event) => void;
  formInfo?: TrackingForm[];
  wfa_track_form?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    _wfa_fstprtcken?: Record<string, boolean>;
    _wfa_track?: ZohoTracker;
  }
}

function initializeTracking() {
  window._wfa_fstprtcken ??= {};
  window._wfa_fstprtcken[ZOHO_CONTACT_FORM_KEY] = true;
  // next/script is cached across client navigation; register a remounted form.
  try {
    const form = document.getElementById(ZOHO_CONTACT_FORM_ID);
    const tracker = window._wfa_track;
    const info = tracker?.formInfo?.find((entry) => entry.name === ZOHO_CONTACT_FORM_NAME);
    if (!form || form.hasAttribute("wfa_instance_id") || !info) return;
    tracker?.wfa_track_form?.(
      info.id_en, info.varid_en, info.name, info.input_eme, info.pgLU_cnsg,
      info.eo_un, info.type, info.wf_vi_url, info.wf_st_url, info.wf_aband_url,
      info.consent_type, info.cookie_configuration, info.webform_id,
    );
  } catch {
    // Analytics availability must not prevent an enquiry.
  }
}

export function trackZohoSubmission(event: Event, accepted = false) {
  try {
    const tracker = window._wfa_track;
    if (accepted) tracker?.wfa_post_submit?.(event);
    else tracker?.wfa_submit?.(event);
  } catch {
    // The CRM submission remains independent of tracking.
  }
}

export function ZohoContactTracking() {
  useEffect(initializeTracking, []);
  return (
    <Script
      id="wf_anal"
      src={ZOHO_CONTACT_ANALYTICS_URL}
      strategy="lazyOnload"
      onReady={initializeTracking}
    />
  );
}
