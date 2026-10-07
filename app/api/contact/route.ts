import { NextResponse } from "next/server";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    !["firstName", "email", "mobile", "service", "message"].every(
      (key) => typeof body[key] === "string" && body[key].trim(),
    ) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
    Object.values(body).some(
      (value) => typeof value !== "string" || value.length > 5000,
    )
  ) {
    return NextResponse.json(
      {
        message:
          "Please complete the required fields and enter a valid email address.",
      },
      { status: 400 },
    );
  }
  // Integration boundary: connect a server-side mail/CRM adapter before enabling delivery.
  // No enquiry data is stored, logged or forwarded while delivery is unavailable.
  return NextResponse.json(
    {
      message:
        "Online enquiries are not available yet. Your message has not been sent. Please call +971 4 824 0002 or email info@voltronix.ae.",
    },
    { status: 503 },
  );
}
