// This module is imported only by the contact route. It never stores or logs enquiries.
export const MAX_CONTACT_BODY_BYTES = 48 * 1024;
const BODY_TIMEOUT_MS = 5000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;

const trustedOrigins = new Set([
  "https://acexperts.ae",
  "https://www.acexperts.ae",
]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const services = new Set([
  "Installation",
  "Replacements",
  "Upgrades",
  "Repairs",
  "Solutions",
  "Other",
]);
const fieldLimits = {
  firstName: 100,
  lastName: 100,
  email: 254,
  company: 200,
  phone: 30,
  mobile: 30,
  service: 20,
  otherService: 200,
  message: 5000,
} as const;
const requiredFields = ["firstName", "email", "mobile", "service", "message"];

function response(status: number, message: string, headers: Record<string, string> = {}) {
  return Response.json(
    { message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      },
    },
  );
}

function trustedRequestOrigin(request: Request): boolean {
  // Neither Host nor forwarded headers establish trust. The explicit production
  // origins are fixed; loopback requests must match their actual request URL.
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return false;
  }
  if (trustedOrigins.has(origin)) return true;
  try {
    const url = new URL(request.url);
    return (
      loopbackHosts.has(url.hostname) &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      origin === url.origin
    );
  } catch {
    return false;
  }
}

function validEnquiry(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const fields = body as Record<string, unknown>;
  for (const [name, value] of Object.entries(fields)) {
    if (
      !Object.hasOwn(fieldLimits, name) ||
      typeof value !== "string" ||
      value.length > fieldLimits[name as keyof typeof fieldLimits]
    ) {
      return false;
    }
    // Names and addresses are plain text; only the message permits line breaks.
    const invalidControls = name === "message"
      ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
      : /[\u0000-\u001f\u007f]/;
    if (invalidControls.test(value)) return false;
  }
  if (!requiredFields.every((name) => typeof fields[name] === "string" && fields[name].trim())) {
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((fields.email as string).trim())) return false;
  for (const name of ["mobile", "phone"]) {
    const number = (fields[name] as string | undefined)?.trim();
    if (!number) continue;
    const digits = number.replace(/\D/g, "").length;
    if (!/^\+?[0-9 ().-]+$/.test(number) || digits < 7 || digits > 15) return false;
  }
  if (!services.has(fields.service as string)) return false;
  if (fields.service === "Other") {
    return typeof fields.otherService === "string" && fields.otherService.trim().length > 0;
  }
  return !Object.hasOwn(fields, "otherService");
}

class InvalidBody extends Error {
  status: number;

  constructor(status: number) {
    super("Invalid request body");
    this.status = status;
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) throw new InvalidBody(400);
    if (Number(length) > MAX_CONTACT_BODY_BYTES) throw new InvalidBody(413);
  }
  if (!request.body) throw new InvalidBody(400);
  const reader = request.body.getReader();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let complete = false;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new InvalidBody(408)), BODY_TIMEOUT_MS);
  });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) {
        complete = true;
        break;
      }
      size += value.byteLength;
      // Enforce the actual streamed size even when Content-Length is absent or false.
      if (size > MAX_CONTACT_BODY_BYTES) throw new InvalidBody(413);
      if (value.byteLength > 0) chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally {
    clearTimeout(timeout);
    // Cancellation must not let a stalled client prolong this response.
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createContactHandler(now: () => number = Date.now) {
  // Conservative process-wide cap: IP headers are not trusted without a known
  // ingress proxy. Multi-instance deployments also need a shared/edge limiter;
  // this local limit resets on process restart and applies to all visitors.
  let windowStart = now();
  let attempts = 0;

  return async function contactRequest(request: Request): Promise<Response> {
    const currentTime = now();
    if (currentTime - windowStart >= RATE_WINDOW_MS || currentTime < windowStart) {
      windowStart = currentTime;
      attempts = 0;
    }
    if (attempts >= RATE_LIMIT) {
      return response(429, "Too many requests. Please try again later.", {
        "Retry-After": String(Math.max(1, Math.ceil((windowStart + RATE_WINDOW_MS - currentTime) / 1000))),
      });
    }
    attempts++;

    if (!trustedRequestOrigin(request)) {
      return response(403, "Unable to process this request.");
    }
    const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    const encoding = request.headers.get("content-encoding");
    if (mediaType !== "application/json" || (encoding && encoding.toLowerCase() !== "identity")) {
      return response(415, "Unable to process this request.");
    }

    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch (error) {
      return response(error instanceof InvalidBody ? error.status : 400, "Unable to process this request.");
    }
    if (!validEnquiry(body)) {
      return response(400, "Please complete the required fields and enter a valid email address.");
    }
    // Public form: authentication is intentionally not required. Connect a
    // server-side mail/CRM adapter before enabling delivery. Do not return or log
    // submitted values; all responses are fixed strings and enquiries are unsent.
    return response(
      503,
      "Online enquiries are not available yet. Your message has not been sent. Please call +971 4 824 0002 or email info@voltronix.ae.",
    );
  };
}

export const handleContactRequest = createContactHandler();
