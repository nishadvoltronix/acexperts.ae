"use client";

import { useState } from "react";

const widgetCode = "siq6c7caf10ab5558239b53ad29eb5d9801ab28f7cdd7b035124a54dee0b79f78f5e53880139d0b43526df2e43b1a0a42e3";

type SalesIQ = {
  widgetcode: string;
  values: Record<string, unknown>;
  ready: () => void;
  floatbutton?: {
    position: (position: string) => void;
    visible: (visibility: string) => void;
  };
  floatwindow?: { visible: (visibility: string) => void };
};

declare global {
  interface Window {
    $zoho?: { salesiq?: SalesIQ };
  }
}

export function FloatingChatbot() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function openChat() {
    const existing = window.$zoho?.salesiq;
    if (existing?.floatwindow) {
      existing.floatwindow.visible("show");
      return;
    }
    if (loading) return;

    setLoading(true);
    setError(false);
    const salesiq: SalesIQ = {
      widgetcode: widgetCode,
      values: {},
      ready() {
        salesiq.floatbutton?.position("bottomright");
        salesiq.floatbutton?.visible("hide");
        salesiq.floatwindow?.visible("show");
        setLoading(false);
      },
    };
    window.$zoho = { ...window.$zoho, salesiq };

    const script = document.createElement("script");
    script.id = "zsiqscript";
    script.src = "https://salesiq.zohopublic.com/widget";
    script.async = true;
    script.onerror = () => {
      script.remove();
      window.$zoho = undefined;
      setLoading(false);
      setError(true);
    };
    document.head.appendChild(script);
  }

  return (
    <button
      type="button"
      className="floating-chatbot"
      onClick={openChat}
      aria-label={loading ? "Opening live chat" : "Open live chat"}
      title={error ? "Chat could not load. Try again." : "Chat with Voltronix"}
      aria-busy={loading}
    >
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M6 7.5h20v15H13l-6 4v-4H6V7.5Z" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" />
        <path d="M11 13h10M11 17h7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      </svg>
    </button>
  );
}
