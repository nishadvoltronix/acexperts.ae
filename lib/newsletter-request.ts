import { createFormGuard, formResponse, validEmail } from "./form-security.ts";
import { createFormDelivery } from "./form-delivery.ts";
import { createSubmissionState, type SubmissionOptions } from "./form-submissions.ts";
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION } from "./newsletter-consent.ts";
import { configuredPrivacyNotice } from "./privacy-notice.ts";

export const MAX_NEWSLETTER_BODY_BYTES = 4 * 1024;

function parseSignup(body: unknown): { email: string; noticeVersion: string | null } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const fields = body as Record<string, unknown>;
  if (Object.keys(fields).some((key) => !["email", "consent", "website", "consentVersion", "noticeVersion"].includes(key))) return null;
  if (fields.consent !== true || typeof fields.email !== "string" || fields.email.length > 254) return null;
  if (fields.consentVersion !== NEWSLETTER_CONSENT_VERSION) return null;
  if (fields.noticeVersion !== null && (typeof fields.noticeVersion !== "string" || fields.noticeVersion.length > 80)) return null;
  if (Object.hasOwn(fields, "website") && fields.website !== "") return null;
  if (/[\u0000-\u001f\u007f]/.test(fields.email)) return null;
  const email = fields.email.trim().toLowerCase();
  return validEmail(email) ? { email, noticeVersion: fields.noticeVersion as string | null } : null;
}

export function createNewsletterHandler(now: () => number = Date.now, options: SubmissionOptions = {}) {
  const env = options.env ?? process.env;
  const state = createSubmissionState(options);
  const guard = createFormGuard(MAX_NEWSLETTER_BODY_BYTES, 10, now, state.rateLimiter("newsletter", 10));
  const delivery = createFormDelivery(options);
  return async (request: Request): Promise<Response> => {
    const input = await guard(request);
    if ("error" in input) return input.error;
    const signup = parseSignup(input.body);
    if (!signup) return formResponse(400, "Enter a valid email address, agree to receive the newsletter and reload the page if it has changed.");
    const { email } = signup;
    const notice = configuredPrivacyNotice(env);
    if (notice && signup.noticeVersion !== notice.version) return formResponse(400, "The privacy notice has changed. Reload this page and review it before subscribing.");
    const retention = env.NEWSLETTER_CONSENT_RETENTION_DAYS;
    const retentionDays = retention && /^[1-9]\d{0,3}$/.test(retention) && Number(retention) <= 3650 ? Number(retention) : null;
    const result = delivery.configured("newsletter") && notice && retentionDays
      ? await state.submit("newsletter", { email }, () => delivery.newsletter(email), {
        emailHash: state.emailHash(email), wording: NEWSLETTER_CONSENT_TEXT, wordingVersion: NEWSLETTER_CONSENT_VERSION,
        noticeUrl: notice.url, noticeVersion: notice.version, origin: request.headers.get("origin")!,
        listId: Number(env.BREVO_NEWSLETTER_LIST_ID), templateId: Number(env.BREVO_NEWSLETTER_DOI_TEMPLATE_ID), retentionDays,
      })
      : { status: "unconfigured" };
    if (result.status === "accepted") return formResponse(200, "Your confirmation request has been accepted. Check your inbox and confirm your email to subscribe.");
    if (result.status === "unconfigured") return formResponse(503, "Online newsletter signup is not available yet. Your email has not been sent or saved. Please try again later.");
    if (result.status === "unavailable") return formResponse(503, "Newsletter signup is temporarily unavailable. Please try again later.");
    if (result.status === "pending") return formResponse(409, "This confirmation request is already being processed. Check your inbox before trying again later.");
    if (result.status === "rejected") return formResponse(502, "We could not start your subscription. Check for an earlier confirmation email or try again later.");
    return formResponse(result.status === "timeout" ? 504 : 502, "We could not confirm your signup request. Check your inbox before trying again later.");
  };
}

export const handleNewsletterRequest = createNewsletterHandler();
