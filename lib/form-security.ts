// Server-side request protections shared by the public form routes.
const BODY_TIMEOUT_MS = 5000;
const RATE_WINDOW_MS = 60_000;
const trustedOrigins = new Set(["https://acexperts.ae", "https://www.acexperts.ae"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function formResponse(status: number, message: string, headers: Record<string, string> = {}) {
  return Response.json({ message }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && !/[\u0000-\u001f\u007f]/.test(value);
}

function trustedRequestOrigin(request: Request): boolean {
  // Host and forwarding headers do not establish trust.
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  if (trustedOrigins.has(origin)) return true;
  try {
    const url = new URL(request.url);
    const originUrl = new URL(origin);
    // Next may normalize a locally bound 127.0.0.1 request to localhost. Treat
    // explicit loopback aliases as equivalent only at the same scheme and port.
    // Comparing the serialized origin also rejects paths, credentials and aliases
    // such as numeric/hexadecimal IP spellings supplied in the Origin header.
    if (
      loopbackHosts.has(url.hostname) && loopbackHosts.has(originUrl.hostname) &&
      ["http:", "https:"].includes(url.protocol) && originUrl.protocol === url.protocol &&
      originUrl.port === url.port && originUrl.origin === origin &&
      !url.username && !url.password
    ) return true;
    // Explicit HTTPS origins only: no wildcard, path, credentials or trailing slash.
    return (process.env.FORM_ALLOWED_ORIGINS || "").split(",").some((item) => {
      const allowed = item.trim();
      if (allowed !== origin) return false;
      const parsed = new URL(allowed);
      return parsed.protocol === "https:" && parsed.origin === allowed;
    });
  } catch {
    return false;
  }
}

class InvalidBody extends Error {
  status: number;
  constructor(status: number) {
    super("Invalid request body");
    this.status = status;
  }
}

async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) throw new InvalidBody(400);
    if (Number(length) > maxBytes) throw new InvalidBody(413);
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
      if (done) { complete = true; break; }
      size += value.byteLength;
      if (size > maxBytes) throw new InvalidBody(413);
      if (value.byteLength > 0) chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally {
    clearTimeout(timeout);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createFormGuard(maxBytes: number, rateLimit: number, now: () => number = Date.now,
  sharedLimit?: () => Promise<{ allowed: boolean; retryAfter: number }>) {
  // Secondary local bound, including malformed traffic. Enabled delivery also
  // requires an atomic shared database budget; IP headers never establish trust.
  let windowStart = now();
  let attempts = 0;
  return async (request: Request): Promise<{ body: unknown } | { error: Response }> => {
    const currentTime = now();
    if (currentTime - windowStart >= RATE_WINDOW_MS || currentTime < windowStart) {
      windowStart = currentTime;
      attempts = 0;
    }
    if (attempts >= rateLimit) {
      return { error: formResponse(429, "Too many requests. Please try again later.", {
        "Retry-After": String(Math.max(1, Math.ceil((windowStart + RATE_WINDOW_MS - currentTime) / 1000))),
      }) };
    }
    attempts++;
    if (request.method !== "POST") return { error: formResponse(405, "Unable to process this request.", { Allow: "POST" }) };
    if (!trustedRequestOrigin(request)) return { error: formResponse(403, "Unable to process this request.") };
    const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    const encoding = request.headers.get("content-encoding");
    if (mediaType !== "application/json" || (encoding && encoding.toLowerCase() !== "identity")) {
      return { error: formResponse(415, "Unable to process this request.") };
    }
    if (sharedLimit) {
      try {
        const rate = await sharedLimit();
        if (!rate.allowed) return { error: formResponse(429, "Too many requests. Please try again later.", { "Retry-After": String(rate.retryAfter) }) };
      } catch {
        return { error: formResponse(503, "Online submissions are temporarily unavailable. Please try again later.") };
      }
    }
    try {
      return { body: await readBoundedJson(request, maxBytes) };
    } catch (error) {
      return { error: formResponse(error instanceof InvalidBody ? error.status : 400, "Unable to process this request.") };
    }
  };
}
