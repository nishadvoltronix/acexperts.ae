import { handleNewsletterRequest } from "@/lib/newsletter-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleNewsletterRequest(request);
}
