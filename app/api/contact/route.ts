import { handleContactRequest } from "@/lib/contact-request";

export async function POST(request: Request) {
  return handleContactRequest(request);
}
