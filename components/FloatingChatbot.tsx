import Script from "next/script";

export function FloatingChatbot({ nonce }: { nonce?: string }) {
  return (
    <>
      {/* v1 anchors to WhatsApp even on the opposite side. Give it a fixed
          right-side reference so both its launcher and panel stay on the right. */}
      <span id="maries-widget-anchor" aria-hidden="true" />
      <Script
        id="talk2maries-script"
        src="https://talk2maries.com/widget/v1/voice-widget.js?v=1.0.1"
        nonce={nonce}
        strategy="afterInteractive"
        data-site-id="ac-experts"
        data-position="bottom-right"
        data-label="talk2maries"
        data-gap="14"
        data-bottom-offset="96"
        data-side-offset="20"
        data-whatsapp-selector="#maries-widget-anchor"
      />
    </>
  );
}
