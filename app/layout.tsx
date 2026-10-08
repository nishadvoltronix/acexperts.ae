import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { site } from "@/lib/site";
import "./globals.css";
const roboto = localFont({
  src: "../public/fonts/roboto-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-roboto",
});
export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  title: { default: site.name, template: "%s | Voltronix AC Experts" },
  icons: {
    icon: { url: site.icon, type: "image/svg+xml" },
  },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Reading request headers opts pages into dynamic rendering for fresh CSP nonces.
  const nonce = (await headers()).get("x-nonce") || undefined;
  const organization = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": site.origin + "/#organization",
        name: site.name,
        alternateName: "Ac experts",
        url: site.origin,
        logo: site.origin + site.logo,
        telephone: site.phone,
        email: site.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Shed 06, Aber Warehouse, Dubai Investment Park 02",
          addressLocality: "Dubai",
          postalCode: "414345",
          addressCountry: "AE",
        },
        sameAs: [
          "https://www.facebook.com/voltronixuae",
          "https://x.com/nstsllc",
          "https://www.instagram.com/vtnxllc",
          "https://www.linkedin.com/company/voltronix-uae/",
        ],
      },
      {
        "@type": "WebSite",
        "@id": site.origin + "/#website",
        url: site.origin,
        name: "Ac experts",
        publisher: { "@id": site.origin + "/#organization" },
        inLanguage: "en-US",
      },
    ],
  };
  return (
    <html lang="en">
      <body className={roboto.variable}>
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organization).replaceAll("<", "\\u003c"),
          }}
        />
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
