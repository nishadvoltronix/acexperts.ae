"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const widgetUrl = "https://salesiq.zohopublic.com/widget?wc=siq6c7caf10ab5558239b53ad29eb5d9801ab28f7cdd7b035124a54dee0b79f78f5e53880139d0b43526df2e43b1a0a42e3";
const buttonSelector = ".zsiq_floatmain,#zsiq_float";
const panelSelector = ".zls-sptwndw,#zsiq_chat_wrap";
const zohoElements = `${buttonSelector},${panelSelector},#siqiframe,#siq_chatwindow`;

export function ZohoChatbot({ nonce }: { nonce?: string }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const anchor = document.getElementById("maries-widget-anchor");
    if (!anchor) return;

    const mobile = window.matchMedia("(max-width: 1024px)");
    const observed = new Set<Element>();
    let pending = 0;
    let readingPosition = { left: window.scrollX, top: window.scrollY };

    function schedule() {
      if (!pending) pending = window.requestAnimationFrame(layout);
    }

    const resize = new ResizeObserver(schedule);

    function visibleRect(selector: string) {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 ||
        element.checkVisibility && !element.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) return null;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight &&
        rect.right > 0 && rect.left < innerWidth ? rect : null;
    }

    function setOffset(property: string, value: number | null) {
      if (value === null) {
        anchor!.style.removeProperty(property);
      } else {
        const pixels = `${Math.round(value)}px`;
        if (anchor!.style.getPropertyValue(property) !== pixels) anchor!.style.setProperty(property, pixels);
      }
    }

    function layout() {
      pending = 0;
      const targets = new Set(document.querySelectorAll(zohoElements));
      for (const element of observed) {
        if (!targets.has(element)) { resize.unobserve(element); observed.delete(element); }
      }
      for (const element of targets) {
        if (!observed.has(element)) { resize.observe(element); observed.add(element); }
      }

      if (mobile.matches) {
        // SalesIQ can lock the body while open; release it when its mobile UI is hidden.
        if (document.body.classList.contains("zsiq_fixedlayout")) {
          document.body.classList.remove("zsiq_fixedlayout");
          window.scrollTo({ ...readingPosition, behavior: "instant" });
        }
        setOffset("right", null);
        setOffset("bottom", null);
        return;
      }

      const button = visibleRect(buttonSelector);
      const panel = visibleRect(panelSelector);
      let right = button ? innerWidth - button.left - (button.width + 58) / 2 : null;
      if (panel && panel.width > 220) {
        // Move Maries beside the open Zoho window so both assistants stay reachable.
        right = Math.min(innerWidth - 66, Math.max(right ?? 20, innerWidth - panel.left + 14));
      }
      setOffset("right", right);
      setOffset("bottom", button ? innerHeight - button.top - 58 : null);
    }

    const mutation = new MutationObserver((records) => {
      if (records.some((record) => record.type === "attributes"
        ? record.target === document.body || record.target instanceof Element && record.target.matches(zohoElements)
        : [...record.addedNodes, ...record.removedNodes].some((node) =>
          node instanceof Element && (node.matches(zohoElements) || node.querySelector(zohoElements))))) schedule();
    });
    mutation.observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"],
    });

    function rememberPosition() {
      if (!document.body.classList.contains("zsiq_fixedlayout")) readingPosition = { left: window.scrollX, top: window.scrollY };
    }

    window.addEventListener("scroll", rememberPosition, { passive: true });
    window.addEventListener("resize", schedule);
    mobile.addEventListener("change", schedule);
    layout();
    return () => {
      window.cancelAnimationFrame(pending);
      mutation.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", rememberPosition);
      window.removeEventListener("resize", schedule);
      mobile.removeEventListener("change", schedule);
      setOffset("right", null);
      setOffset("bottom", null);
    };
  }, []);

  return (
    <>
      <Script id="zoho-salesiq-init" nonce={nonce} strategy="afterInteractive" onReady={() => setInitialized(true)}>
        {`
          document.documentElement.dataset.zohoChatRequested = "false";
          window.$zoho = window.$zoho || {};
          window.$zoho.salesiq = window.$zoho.salesiq || {
            ready: function () {
              var chat = window.$zoho.salesiq;
              var requested = false;
              chat.chatbutton.click(function () {
                requested = true;
                document.documentElement.dataset.zohoChatRequested = "true";
              });
              chat.floatwindow.open(function () {
                // Allow Zoho to finish rendering its accessible launcher before collapsing.
                if (!requested) setTimeout(function () {
                  if (!requested) chat.floatwindow.visible("hide");
                }, 100);
              });
              chat.floatbutton.position("bottomright");
              chat.floatbutton.visible("show");
              chat.floatwindow.visible("hide");
            }
          };
          window.$zoho.salesiq.nonce = document.currentScript.nonce;
        `}
      </Script>
      {initialized && <Script id="zsiqscript" src={widgetUrl} nonce={nonce} strategy="afterInteractive" />}
    </>
  );
}
