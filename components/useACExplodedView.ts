"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const getMotion = () => window.matchMedia(motionQuery).matches;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
type Mode = "assembled" | "exploded" | "custom" | "loop";
type Interaction = "idle" | "scroll";

/** One animation clock drives both the geometry and the native slider. */
export function useACExplodedView() {
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const output = useRef<HTMLOutputElement>(null);
  const runtime = useRef({ level: 1, target: 0, x: 0, y: 0, width: 0, height: 0, frame: 0, timer: 0, loopEnabled: true, looping: false, visible: false, interaction: "idle" as Interaction });
  const gesture = useRef<{ id: number; x: number; y: number; rotated: boolean } | null>(null);
  const [mode, setMode] = useState<Mode>("exploded");
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotion, serverReady);

  const paint = useCallback((level: number) => {
    const state = runtime.current;
    state.level = clamp(level, 0, 1);
    const percent = Math.round(state.level * 100);
    viewport.current?.style.setProperty("--ac-explode", String(state.level));
    // Reserve the entire scene throughout the animation, without changing layout.
    if (stage.current && state.width) {
      const scale = Math.min(state.width / 1130, state.height / 650, 1.35);
      stage.current.style.setProperty("--ac-scale", String(scale));
    }
    if (slider.current) {
      slider.current.value = String(percent);
      slider.current.setAttribute("aria-valuetext", `${percent}% separated`);
    }
    if (output.current) output.current.value = `${percent}%`;
  }, []);

  const cancel = useCallback(() => {
    const state = runtime.current;
    cancelAnimationFrame(state.frame);
    clearTimeout(state.timer);
    state.frame = 0;
    state.timer = 0;
  }, []);

  const stop = useCallback(() => {
    cancel();
    const state = runtime.current;
    state.loopEnabled = false;
    state.looping = false;
    state.interaction = "idle";
    setMode(state.level === 0 ? "assembled" : state.level === 1 ? "exploded" : "custom");
  }, [cancel]);

  const animate = useCallback(function animateTo(target: number, duration: number) {
    cancel();
    const state = runtime.current;
    state.target = target;
    if (getMotion()) {
      paint(target);
      return;
    }
    const from = state.level;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      paint(from + (target - from) * eased);
      if (progress < 1) state.frame = requestAnimationFrame(tick);
      else {
        state.frame = 0;
        if (state.looping && state.visible && !document.hidden) {
          state.timer = window.setTimeout(() => {
            if (state.looping && state.visible && !document.hidden && !getMotion()) animateTo(target === 1 ? 0 : 1, 1800);
          }, 1400);
        }
      }
    }
    state.frame = requestAnimationFrame(tick);
  }, [cancel, paint]);

  const setLevel = useCallback((value: number, smooth = false) => {
    stop();
    const target = clamp(value, 0, 1);
    setMode(target === 0 ? "assembled" : target === 1 ? "exploded" : "custom");
    if (smooth && !getMotion()) animate(target, 850);
    else paint(target);
  }, [animate, paint, stop]);

  const startLoop = useCallback(() => {
    const state = runtime.current;
    if (!state.loopEnabled || state.looping || state.interaction !== "idle" || getMotion() || document.hidden || !state.visible) return;
    state.looping = true;
    setMode("loop");
    // Resume the same direction after leaving the viewport or hiding the tab.
    const target = state.level === 1 ? 0 : state.level === 0 ? 1 : state.target;
    animate(target, Math.max(200, Math.abs(target - state.level) * 1800));
  }, [animate]);

  const settleInteraction = useCallback(() => {
    const state = runtime.current;
    clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state.timer = 0;
      state.interaction = "idle";
      startLoop();
    }, 800);
  }, [startLoop]);

  const toggleLoop = useCallback(() => {
    if (runtime.current.loopEnabled && mode === "loop") {
      stop();
      return;
    }
    runtime.current.loopEnabled = true;
    runtime.current.interaction = "idle";
    runtime.current.target = runtime.current.level >= 0.999 ? 0 : 1;
    startLoop();
  }, [mode, startLoop, stop]);

  const onPointerEnter = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || getMotion()) return;
    const state = runtime.current;
    if (!state.visible || document.hidden || state.level === 1) return;
    // Open on entry, then continue the normal cycle even while the pointer stays
    // over the model. A manually paused viewer still opens just once.
    state.interaction = "idle";
    state.looping = state.loopEnabled;
    setMode(state.looping ? "loop" : "exploded");
    animate(1, 650);
  }, [animate]);

  const rotate = useCallback((x: number, y: number) => {
    const state = runtime.current;
    state.x = clamp(x, -8, 8);
    state.y = clamp(y, -10, 10);
    viewport.current?.style.setProperty("--ac-rotate-x", `${state.x}deg`);
    viewport.current?.style.setProperty("--ac-rotate-y", `${state.y}deg`);
    paint(state.level);
  }, [paint]);

  const resetView = useCallback(() => {
    stop();
    rotate(0, 0);
  }, [rotate, stop]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const { x, y } = runtime.current;
    if (event.key === "ArrowLeft") rotate(x, y - 2);
    else if (event.key === "ArrowRight") rotate(x, y + 2);
    else if (event.key === "ArrowUp") rotate(x - 2, y);
    else if (event.key === "ArrowDown") rotate(x + 2, y);
    else if (event.key === "Home") rotate(0, 0);
    else return;
    event.preventDefault();
    stop();
  }, [rotate, stop]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rotated: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === "mouse") event.currentTarget.focus({ preventScroll: true });
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    const touch = event.pointerType !== "mouse";
    // Leave vertical swipes to native page scrolling; touch rotates horizontally only.
    if (!current.rotated && touch && (Math.abs(dx) < 6 || Math.abs(dy) > Math.abs(dx))) return;
    if (!current.rotated) stop();
    current.rotated = true;
    rotate(runtime.current.x - (touch ? 0 : dy * 0.06), runtime.current.y + dx * 0.08);
    current.x = event.clientX;
    current.y = event.clientY;
  }, [rotate, stop]);

  const onPointerEnd = useCallback(() => { gesture.current = null; }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const state = runtime.current;
    const media = window.matchMedia(motionQuery);
    let previousScrollY = window.scrollY;
    let scrollFrame = 0;
    function updateVisibility() {
      const rect = element!.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      state.visible = visibleHeight >= Math.min(rect.height, window.innerHeight) * 0.15;
    }
    function measure() {
      runtime.current.width = Math.max(1, element!.clientWidth - 32);
      runtime.current.height = Math.max(1, element!.clientHeight - 32);
      paint(runtime.current.level);
    }
    measure();
    function reconcilePlayback() {
      if (state.visible && !document.hidden && !media.matches) {
        startLoop();
      } else if (state.frame || state.timer || state.looping || document.hidden || media.matches) {
        // Environmental pauses retain autoplay; only a manual action disables it.
        cancel();
        state.looping = false;
        state.interaction = "idle";
        setMode(state.level === 0 ? "assembled" : state.level === 1 ? "exploded" : "custom");
      }
    }
    function refreshViewport() {
      measure();
      updateVisibility();
      reconcilePlayback();
    }
    function onEnvironmentChange() {
      previousScrollY = window.scrollY;
      updateVisibility();
      reconcilePlayback();
    }
    function onScroll() {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const delta = window.scrollY - previousScrollY;
        previousScrollY = window.scrollY;
        updateVisibility();
        if (!state.visible || document.hidden || media.matches) {
          reconcilePlayback();
          return;
        }
        if (Math.abs(delta) < 0.5 || gesture.current) return;
        // Direct distance mapping follows the user's scrolling speed, without
        // capturing wheel/touch events or adding artificial page scrolling.
        cancel();
        state.looping = false;
        state.interaction = "scroll";
        paint(state.level + delta / Math.max(260, window.innerHeight * 0.65));
        state.target = delta > 0 ? 1 : 0;
        setMode(state.loopEnabled ? "loop" : state.level === 0 ? "assembled" : state.level === 1 ? "exploded" : "custom");
        settleInteraction();
      });
    }
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refreshViewport);
    resize?.observe(element);
    window.addEventListener("resize", refreshViewport, { passive: true });
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(() => {
      updateVisibility();
      reconcilePlayback();
    }, { threshold: [0, 0.15] });
    observer?.observe(element);
    // Initialize from the current layout too: restored scroll positions and
    // first entry must work without waiting for a second observer crossing.
    const initialFrame = requestAnimationFrame(onEnvironmentChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    media.addEventListener("change", onEnvironmentChange);
    document.addEventListener("visibilitychange", onEnvironmentChange);
    return () => {
      cancel();
      cancelAnimationFrame(initialFrame);
      cancelAnimationFrame(scrollFrame);
      state.looping = false;
      state.visible = false;
      state.interaction = "idle";
      gesture.current = null;
      observer?.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", refreshViewport);
      window.removeEventListener("scroll", onScroll);
      media.removeEventListener("change", onEnvironmentChange);
      document.removeEventListener("visibilitychange", onEnvironmentChange);
    };
  }, [cancel, paint, settleInteraction, startLoop]);

  return { viewport, stage, slider, output, ready, reducedMotion, mode, setLevel, toggleLoop, resetView, stop, onKeyDown, onPointerEnter, onPointerDown, onPointerMove, onPointerEnd };
}
