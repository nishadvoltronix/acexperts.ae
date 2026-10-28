"use client";

import { useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    Talk2MariesWidget?: { open: () => void };
  }
}

export function FloatingChatbot({ nonce }: { nonce?: string }) {
  const autoOpened = useRef(false);

  function openAssistant() {
    if (autoOpened.current || !window.Talk2MariesWidget) return;
    const open = () => {
      if (autoOpened.current || !window.Talk2MariesWidget) return;
      autoOpened.current = true;
      window.Talk2MariesWidget.open();
    };
    // The widget focuses its panel when opened. Wait for its fixed-position
    // styles so that focus cannot scroll the page to the unstyled panel.
    const stylesheet = document.getElementById("talk2maries-widget")?.shadowRoot
      ?.querySelector<HTMLLinkElement>('link[rel="stylesheet"]');
    if (stylesheet && !stylesheet.sheet) {
      stylesheet.addEventListener("load", open, { once: true });
    } else {
      open();
    }
  }

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
        data-label="Talk to Maries"
        data-gap="14"
        data-bottom-offset="96"
        data-side-offset="20"
        data-whatsapp-selector="#maries-widget-anchor"
        onReady={openAssistant}
      />
    </>
  );
}
