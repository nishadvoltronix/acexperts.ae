import { createFormGuard, formResponse, validEmail } from "./form-security.ts";
import { createFormDelivery, type Enquiry } from "./form-delivery.ts";
import { createSubmissionState, type SubmissionOptions } from "./form-submissions.ts";

export const MAX_CONTACT_BODY_BYTES = 48 * 1024;
const services = new Set(["Installation", "Replacements", "Upgrades", "Repairs", "Solutions", "Duct Cleaning", "HVAC Services", "Other"]);
const fieldLimits = { firstName: 100, lastName: 100, email: 254, company: 200, phone: 30, mobile: 30, service: 20, otherService: 200, message: 5000, website: 200 } as const;
const requiredFields = ["firstName", "email", "mobile", "service", "message"];

function parseEnquiry(body: unknown): Enquiry | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const fields = body as Record<string, unknown>;
  for (const [name, value] of Object.entries(fields)) {
    if (!Object.hasOwn(fieldLimits, name) || typeof value !== "string" || value.length > fieldLimits[name as keyof typeof fieldLimits]) return null;
    const invalidControls = name === "message" ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
    if (invalidControls.test(value)) return null;
  }
  if (!requiredFields.every((name) => typeof fields[name] === "string" && fields[name].trim())) return null;
  if (fields.website) return null; // Hidden spam trap; never report a fake success.
  if (!validEmail((fields.email as string).trim())) return null;
  for (const name of ["mobile", "phone"]) {
    const number = (fields[name] as string | undefined)?.trim();
    if (!number) continue;
    const digits = number.replace(/\D/g, "").length;
    if (!/^\+?[0-9 ().-]+$/.test(number) || digits < 7 || digits > 15) return null;
  }
  if (!services.has(fields.service as string)) return null;
  if (fields.service === "Other") {
    if (typeof fields.otherService !== "string" || !fields.otherService.trim()) return null;
  } else if (Object.hasOwn(fields, "otherService")) return null;
  const normalized = (key: string) => (fields[key] as string | undefined)?.trim() || "";
  return {
    firstName: normalized("firstName"), lastName: normalized("lastName"),
    email: normalized("email").toLowerCase(), company: normalized("company"),
    phone: normalized("phone"), mobile: normalized("mobile"), service: normalized("service"),
    otherService: normalized("otherService"), message: normalized("message").replace(/\r\n/g, "\n"),
  };
}

export function createContactHandler(now: () => number = Date.now, options: SubmissionOptions = {}) {
  const state = createSubmissionState(options);
  const guard = createFormGuard(MAX_CONTACT_BODY_BYTES, 30, now, state.rateLimiter("contact", 30));
  const delivery = createFormDelivery(options);
  return async (request: Request): Promise<Response> => {
    const input = await guard(request);
    if ("error" in input) return input.error;
    const enquiry = parseEnquiry(input.body);
    if (!enquiry) return formResponse(400, "Please complete the required fields and enter a valid email address.");
    const result = delivery.configured("contact")
      ? await state.submit("contact", enquiry, (requestId) => delivery.contact(enquiry, requestId))
      : { status: "unconfigured" };
    if (result.status === "accepted") return formResponse(200, "Thank you. Your enquiry has been accepted for delivery to our team.");
    if (result.status === "unconfigured") return formResponse(503, "Online enquiries are not available yet. Your message has not been sent. Please call +971 4 824 0002 or email info@voltronix.ae.");
    if (result.status === "unavailable") return formResponse(503, "Online enquiries are temporarily unavailable. Please call +971 4 824 0002 or try again later.");
    if (result.status === "pending") return formResponse(409, "This enquiry is already being processed. Please contact our team before submitting it again.");
    if (result.status === "rejected") return formResponse(502, "Your message could not be sent. Please try again later, call +971 4 824 0002 or email info@voltronix.ae.");
    return formResponse(result.status === "timeout" ? 504 : 502, "We could not confirm delivery of your enquiry. Please call +971 4 824 0002 or email info@voltronix.ae before sending it again.");
  };
}

export const handleContactRequest = createContactHandler();
