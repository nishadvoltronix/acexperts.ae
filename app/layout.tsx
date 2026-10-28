import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { FloatingChatbot } from "@/components/FloatingChatbot";
import { Footer } from "@/components/Footer";
import { MotionEffects } from "@/components/MotionEffects";
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
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        {/* Keep Google's bootstrap in the initial head and propagate the CSP nonce. */}
        {/* eslint-disable-next-line @next/next/next-script-for-ga -- Required head placement before hydration. */}
        <script
          id="google-tag-manager"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;var n=d.querySelector('[nonce]');
n&&j.setAttribute('nonce',n.nonce||n.getAttribute('nonce'));f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-K9HW63CV');`,
          }}
        />
      </head>
      <body className={roboto.variable}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-K9HW63CV"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
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
        <MotionEffects />
        <main id="main-content">{children}</main>
        <Footer />
        <FloatingWhatsApp />
        <FloatingChatbot nonce={nonce} />
      </body>
    </html>
  );
}
