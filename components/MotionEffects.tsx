"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Progressive enhancement for server-rendered data-reveal / data-count-value markers. */
export function MotionEffects() {
  const pathname = usePathname();
  const progress = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 767px)");
    const header = document.querySelector<HTMLElement>(".site-header");
    const registered = new Set<HTMLElement>();
    const animations = new Map<HTMLElement, Animation>();
    const counters = new Map<HTMLElement, { value: number; suffix: string; start: number }>();
    let counterFrame = 0;
    let scrollFrame = 0;
    let scrollRange = 1;
    let scrolled = false;

    function finish(element: HTMLElement) {
      animations.get(element)?.cancel();
      animations.delete(element);
      element.dataset.motionState = "visible";
      if (element.dataset.countValue) {
        element.textContent = element.dataset.countValue;
        counters.delete(element);
      }
    }

    function tickCounters(now: number) {
      counters.forEach((counter, element) => {
        const elapsed = Math.min(1, (now - counter.start) / (compact.matches ? 900 : 1300));
        const value = Math.round(counter.value * (1 - Math.pow(1 - elapsed, 3)));
        element.textContent = `${value}${counter.suffix}`;
        if (elapsed === 1) finish(element);
      });
      counterFrame = counters.size ? requestAnimationFrame(tickCounters) : 0;
    }

    function reveal(element: HTMLElement, animate = true) {
      observer?.unobserve(element);
      if (element.dataset.motionState === "visible") return;
      element.dataset.motionState = "visible";
      if (!animate || reducedMotion.matches) {
        finish(element);
        return;
      }

      const count = element.dataset.countValue?.match(/^(\d+)([+%]?)$/);
      if (count) {
        counters.set(element, { value: Number(count[1]), suffix: count[2], start: performance.now() });
        element.textContent = `0${count[2]}`;
        if (!counterFrame) counterFrame = requestAnimationFrame(tickCounters);
      }

      if (element.hasAttribute("data-reveal")) {
        const direction = element.dataset.reveal;
        const translate = compact.matches ? "0 12px" : direction === "left" ? "-20px 0" : direction === "right" ? "20px 0" : "0 25px";
        const delay = Math.min(Number(element.dataset.revealDelay) || 0, compact.matches ? 120 : 300);
        // Individual translate leaves existing hover transforms independent of entrance motion.
        const animation = element.animate(
          [{ opacity: 0, translate }, { opacity: 1, translate: "0 0" }],
          { duration: compact.matches ? 420 : 620, delay, easing: ease, fill: "backwards" },
        );
        animations.set(element, animation);
        animation.onfinish = () => animations.delete(element);
      }
    }

    const observer = typeof IntersectionObserver === "undefined" || !Element.prototype.animate ? null : new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        // Tall content still reveals when a useful portion of the viewport is occupied.
        const visibleEnough = entry.intersectionRatio >= 0.18 || entry.intersectionRect.height >= window.innerHeight * 0.18;
        if (entry.isIntersecting && visibleEnough) reveal(entry.target as HTMLElement);
      }),
      { threshold: [0, 0.18], rootMargin: "0px 0px -16px 0px" },
    );

    function register(root: ParentNode) {
      const elements = [...root.querySelectorAll<HTMLElement>("[data-reveal], [data-count-value]")];
      if (root instanceof HTMLElement && root.matches("[data-reveal], [data-count-value]")) elements.unshift(root);
      // Read geometry together before setting pending states; never hide initial viewport content.
      const fresh = elements.filter((element) => !registered.has(element)).map((element) => ({
        element,
        top: element.getBoundingClientRect().top,
        concealed: Boolean(element.closest("[hidden], details:not([open])")),
      }));
      fresh.forEach(({ element, top, concealed }) => {
        registered.add(element);
        if (!observer || reducedMotion.matches || concealed || top < window.innerHeight || element.dataset.motionState === "visible") {
          finish(element);
        } else {
          element.dataset.motionState = "pending";
          observer.observe(element);
        }
      });
    }

    function showAll() {
      observer?.disconnect();
      registered.forEach(finish);
      cancelAnimationFrame(counterFrame);
      counterFrame = 0;
    }

    function onPreferenceChange() {
      if (reducedMotion.matches) showAll();
    }

    function onFocus(event: FocusEvent) {
      if (!(event.target instanceof HTMLElement)) return;
      let element: HTMLElement | null = event.target;
      while (element && element !== main) {
        if (registered.has(element)) {
          observer?.unobserve(element);
          finish(element);
        }
        element = element.parentElement;
      }
    }

    function updateScroll() {
      scrollFrame = 0;
      const offset = Math.max(0, window.scrollY);
      if (progress.current) progress.current.style.transform = `scaleX(${Math.min(1, offset / scrollRange)})`;
      const nextScrolled = offset > 24;
      if (nextScrolled !== scrolled) {
        scrolled = nextScrolled;
        header?.toggleAttribute("data-scrolled", scrolled);
        document.body.toggleAttribute("data-scrolled", scrolled);
      }
    }

    function onScroll() {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
    }

    function measureScroll() {
      scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      onScroll();
    }

    register(main);
    // Also handles content streamed by Next.js and cards inserted by existing filters.
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) register(node);
      }));
    });
    mutations.observe(main, { childList: true, subtree: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureScroll);
    resize?.observe(document.body);
    measureScroll();
    main.addEventListener("focusin", onFocus);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measureScroll, { passive: true });
    window.addEventListener("beforeprint", showAll);
    reducedMotion.addEventListener("change", onPreferenceChange);

    return () => {
      mutations.disconnect();
      resize?.disconnect();
      showAll();
      // Leave static content visible, and let Strict Mode remounts register it afresh.
      registered.forEach((element) => delete element.dataset.motionState);
      cancelAnimationFrame(scrollFrame);
      main.removeEventListener("focusin", onFocus);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measureScroll);
      window.removeEventListener("beforeprint", showAll);
      reducedMotion.removeEventListener("change", onPreferenceChange);
      header?.removeAttribute("data-scrolled");
      document.body.removeAttribute("data-scrolled");
    };
  }, [pathname]);

  return <div ref={progress} className="scroll-progress" aria-hidden="true" />;
}
