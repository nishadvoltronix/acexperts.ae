export type ZohoContactResponse =
  | { kind: "success"; message: string }
  | { kind: "redirect"; url: string }
  | { kind: "error"; message: string }
  | { kind: "unconfirmed" };

const REJECTION_MESSAGE =
  "Zoho did not accept this enquiry. Please check your details and try again.";
const VERIFICATION_MESSAGE =
  "Zoho could not verify this enquiry. Please try again or contact us by phone.";
const REDIRECT_ORIGINS = [
  "https://acexperts.ae",
  "https://www.acexperts.ae",
  "https://crm.zoho.com",
  "https://crm.zohopublic.com",
];

function isTrue(value: unknown) {
  return value === true || value === "true";
}

function isFalse(value: unknown) {
  return value === false || value === "false";
}

function safeRedirect(value: unknown, siteOrigin: string): string | undefined {
  if (typeof value !== "string" || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    return undefined;
  }

  try {
    // A relative target from the provider must not resolve against an unrelated page.
    const target = new URL(value);
    if (target.protocol !== "https:" || target.username || target.password) return undefined;

    const allowedOrigins = new Set(REDIRECT_ORIGINS);
    try {
      const site = new URL(siteOrigin);
      if (site.protocol === "https:") allowedOrigins.add(site.origin);
    } catch {
      // An invalid caller origin cannot broaden the fixed provider/site allowlist.
    }

    return allowedOrigins.has(target.origin) ? target.href : undefined;
  } catch {
    return undefined;
  }
}

/** Interpret Zoho's exported webform protocol. Messages must be rendered as text. */
export function parseZohoContactResponse(data: unknown, siteOrigin: string): ZohoContactResponse {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { kind: "unconfirmed" };

  const response = data as Record<string, unknown>;
  const action = response.actionsubmit;

  // Rejections take precedence even if the payload also contains a success action.
  if (isTrue(response.invalidCaptcha) || action === "captcha_error") {
    return { kind: "error", message: VERIFICATION_MESSAGE };
  }
  if (isFalse(response.success) || action === "error_msg") {
    return { kind: "error", message: REJECTION_MESSAGE };
  }

  if (action === "Splash Message" && typeof response.actionvalue === "string") {
    const message = response.actionvalue.trim().slice(0, 2000);
    if (message) return { kind: "success", message };
  }

  const confirmedRedirect =
    ((action === "redirect_url" || action === "parent_redirect") && isTrue(response.success)) ||
    action === "thankyou_page";
  if (confirmedRedirect) {
    const url = safeRedirect(response.redirectUrl, siteOrigin);
    if (url) return { kind: "redirect", url };
  }

  return { kind: "unconfirmed" };
}
