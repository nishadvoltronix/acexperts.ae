// Imported by server route handlers only. Credentials never enter client props.
import { validEmail } from "./form-security.ts";

export type Enquiry = {
  firstName: string; lastName: string; email: string; company: string;
  phone: string; mobile: string; service: string; otherService: string; message: string;
};
export type DeliveryResult = { status: "accepted" | "unconfigured" | "rejected" | "uncertain" | "timeout" };
export type DeliveryOptions = { env?: Record<string, string | undefined>; fetch?: typeof fetch; timeoutMs?: number };

const API_BASE = "https://api.brevo.com/v3";
const emailSetting = (value: string | undefined) => value && validEmail(value.trim()) ? value.trim() : null;
const positiveInteger = (value: string | undefined) => value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const safeKey = (value: string | undefined) => value && /^[\x21-\x7e]+$/.test(value) ? value : null;

function redirectSetting(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

async function send(path: string, apiKey: string, payload: object, options: DeliveryOptions, requireMessageId: boolean): Promise<DeliveryResult> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const deadline = new Promise<DeliveryResult>((resolve) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve({ status: "timeout" });
    }, options.timeoutMs ?? 8000);
  });
  const operation = async (): Promise<DeliveryResult> => {
    try {
      const result = await (options.fetch ?? fetch)(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload), signal: controller.signal, redirect: "error", cache: "no-store",
      });
      // Provider errors/timeouts may happen after acceptance: never auto-retry or expose provider text.
      if (result.status !== 201) {
        void result.body?.cancel().catch(() => {});
        // Timeouts/conflicts may describe an operation already accepted upstream.
        // Keep them blocked for reconciliation instead of allowing a later resend.
        const definiteRejection = result.status >= 400 && result.status < 500 && ![408, 409].includes(result.status);
        return { status: definiteRejection ? "rejected" : "uncertain" };
      }
      if (!requireMessageId) {
        void result.body?.cancel().catch(() => {});
        return { status: "accepted" };
      }
      const receipt: unknown = await result.json();
      if (!receipt || typeof receipt !== "object" || !("messageId" in receipt) ||
          typeof receipt.messageId !== "string" || !receipt.messageId.trim()) return { status: "uncertain" };
      return { status: "accepted" };
    } catch { return { status: timedOut ? "timeout" : "uncertain" }; }
  };
  try { return await Promise.race([operation(), deadline]); }
  finally { clearTimeout(timeout); }
}

export function createFormDelivery(options: DeliveryOptions = {}) {
  const environment = () => options.env ?? process.env;
  const contactSettings = () => {
    const env = environment();
    const apiKey = safeKey(env.BREVO_API_KEY);
    const sender = emailSetting(env.CONTACT_FROM_EMAIL);
    const recipient = emailSetting(env.CONTACT_TO_EMAIL);
    return apiKey && sender && recipient ? { apiKey, sender, recipient } : null;
  };
  const newsletterSettings = () => {
    const env = environment();
    const apiKey = safeKey(env.BREVO_API_KEY);
    const listId = positiveInteger(env.BREVO_NEWSLETTER_LIST_ID);
    const templateId = positiveInteger(env.BREVO_NEWSLETTER_DOI_TEMPLATE_ID);
    const redirectionUrl = redirectSetting(env.BREVO_NEWSLETTER_REDIRECT_URL);
    return apiKey && listId && templateId && redirectionUrl ? { apiKey, listId, templateId, redirectionUrl } : null;
  };
  return {
    configured(channel: "contact" | "newsletter") { return Boolean(channel === "contact" ? contactSettings() : newsletterSettings()); },
    async contact(enquiry: Enquiry, requestId: string): Promise<DeliveryResult> {
      const settings = contactSettings();
      if (!settings) return { status: "unconfigured" };
      const { apiKey, sender, recipient } = settings;
      const lines = [
        "New AC Experts website enquiry", "",
        `First name: ${enquiry.firstName}`, `Last name: ${enquiry.lastName}`,
        `Email: ${enquiry.email}`, `Company: ${enquiry.company}`,
        `Phone: ${enquiry.phone}`, `Mobile: ${enquiry.mobile}`,
        `Service: ${enquiry.service}`, ...(enquiry.otherService ? [`Other service: ${enquiry.otherService}`] : []),
        "", "Message:", enquiry.message,
      ];
      const textContent = lines.join("\n");
      return send("/smtp/email", apiKey, {
        sender: { email: sender, name: "AC Experts website" }, to: [{ email: recipient }],
        replyTo: { email: enquiry.email }, subject: `AC Experts enquiry: ${enquiry.service}`,
        textContent, htmlContent: `<pre>${escapeHtml(textContent)}</pre>`,
        headers: { idempotencyKey: requestId }, tags: ["website-enquiry"],
      }, options, true);
    },
    async newsletter(email: string): Promise<DeliveryResult> {
      const settings = newsletterSettings();
      if (!settings) return { status: "unconfigured" };
      const { apiKey, listId, templateId, redirectionUrl } = settings;
      // Starts double opt-in; never clears unsubscribe flags or bypasses confirmation.
      return send("/contacts/doubleOptinConfirmation", apiKey, {
        email, includeListIds: [listId], templateId, redirectionUrl, contactPixelTrackingConsent: false,
      }, options, false);
    },
  };
}
