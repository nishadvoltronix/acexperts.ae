import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZOHO_CONTACT_ORIGIN } from "@/lib/zoho-contact";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(32).toString("base64");
  const development = process.env.NODE_ENV === "development";
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `script-src-elem 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://*.zohopublic.com https://*.zohocdn.com https://*.zohostatic.com https://talk2maries.com`,
    "script-src-attr 'none'",
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-elem 'self' 'unsafe-inline' https://*.zohocdn.com https://*.zohostatic.com https://talk2maries.com",
    // React and next/image use style attributes for image sizes and artwork crops.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com https://www.google.ae https://*.zohopublic.com https://*.zohocdn.com https://*.zohostatic.com https://talk2maries.com",
    "font-src 'self' https://*.zohocdn.com https://*.zohostatic.com",
    // Destinations used by the published GTM container's GA and Zoho PageSense tags.
    `connect-src 'self' ${ZOHO_CONTACT_ORIGIN} https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com https://www.google.ae https://stats.g.doubleclick.net https://pagesense-collect.zoho.com https://pagesense-hb-collect.zoho.com https://*.zohopublic.com https://*.zohocdn.com https://*.zohostatic.com https://talk2maries.com${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "object-src 'none'",
    "frame-src https://*.zohopublic.com https://www.googletagmanager.com https://www.google.com/maps/embed https://talk2maries.com",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    `form-action 'self' ${ZOHO_CONTACT_ORIGIN}`,
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  // Always replace client-supplied nonce/CSP values before Next.js renders scripts.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  // Never share HTML bearing a per-request nonce through browser or CDN caches.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|images(?:/|$)|fonts(?:/|$)|favicon.ico$|robots.txt$|sitemap.xml$).*)",
  ],
};
