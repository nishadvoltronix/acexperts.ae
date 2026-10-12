'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { QualityImage as Image } from './QualityImage';
import { Icon, SectionHeading } from './ui';
import styles from './Testimonials.module.css';

export interface Testimonial { quote: string; name: string; role: string; image: string; }

const AUTOPLAY_INTERVAL = 7000;

export function Testimonials({ items }: { items: Testimonial[] }) {
  const [carousel, setCarousel] = useState({ active: 0, direction: 'next', interacted: false, announcement: '' });
  const [paused, setPaused] = useState(false);
  const section = useRef<HTMLElement>(null);
  const gesture = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const instructionsId = useId();

  useEffect(() => {
    const element = section.current;
    if (!element || items.length < 2 || paused) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hovered = window.matchMedia('(hover: hover)').matches && element.matches(':hover');
    let focused = element.contains(document.activeElement);
    let inView = false;

    function schedule() {
      clearTimeout(timer);
      if (!inView || hovered || focused || document.hidden || reducedMotion.matches) return;
      timer = setTimeout(() => {
        setCarousel(current => ({
          ...current,
          active: (current.active + 1) % items.length,
          direction: 'next',
          interacted: true,
        }));
      }, AUTOPLAY_INTERVAL);
    }

    function pointerEnter(event: globalThis.PointerEvent) {
      if (event.pointerType === 'touch') return;
      hovered = true;
      schedule();
    }

    function pointerLeave() {
      hovered = false;
      schedule();
    }

    function focusIn() {
      focused = true;
      schedule();
    }

    function focusOut(event: FocusEvent) {
      focused = event.relatedTarget instanceof Node && element!.contains(event.relatedTarget);
      schedule();
    }

    // Keep the same offscreen protection if IntersectionObserver is unavailable.
    function updateVisibility() {
      const rect = element!.getBoundingClientRect();
      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      inView = rect.height > 0 && visibleHeight / rect.height >= 0.35 && rect.right > 0 && rect.left < window.innerWidth;
      schedule();
    }

    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        schedule();
      }, { threshold: [0, 0.35] })
      : null;

    element.addEventListener('pointerenter', pointerEnter);
    element.addEventListener('pointerleave', pointerLeave);
    element.addEventListener('focusin', focusIn);
    element.addEventListener('focusout', focusOut);
    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener('change', schedule);
    if (observer) observer.observe(element);
    else {
      window.addEventListener('scroll', updateVisibility, { passive: true });
      window.addEventListener('resize', updateVisibility);
      updateVisibility();
    }

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      element.removeEventListener('pointerenter', pointerEnter);
      element.removeEventListener('pointerleave', pointerLeave);
      element.removeEventListener('focusin', focusIn);
      element.removeEventListener('focusout', focusOut);
      document.removeEventListener('visibilitychange', schedule);
      reducedMotion.removeEventListener('change', schedule);
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, [carousel.active, items.length, paused]);

  if (!items.length) return null;

  const { active, direction, interacted } = carousel;
  const visible = Array.from({ length: Math.min(3, items.length) }, (_, offset) => items[(active + offset) % items.length]);

  function move(step: number) {
    setCarousel(current => {
      const next = (current.active + step + items.length) % items.length;
      return {
        active: next,
        direction: step > 0 ? 'next' : 'previous',
        interacted: true,
        announcement: `${items[next].name}, testimonial ${next + 1} of ${items.length}.`,
      };
    });
  }

  function select(index: number) {
    setCarousel(current => current.active === index ? current : {
      active: index,
      direction: index > current.active ? 'next' : 'previous',
      interacted: true,
      announcement: `${items[index].name}, testimonial ${index + 1} of ${items.length}.`,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft') move(-1);
    else if (event.key === 'ArrowRight') move(1);
    else if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(items.length - 1);
    else return;
    event.preventDefault();
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    gesture.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) >= 45 && Math.abs(x) > Math.abs(y) * 1.5) move(x < 0 ? 1 : -1);
  }

  return (
    <section ref={section} className="home-testimonials container" aria-label="Client testimonials" aria-roledescription="carousel" aria-describedby={instructionsId} tabIndex={0} onKeyDown={handleKeyDown}>
      <SectionHeading eyebrow="What our clients say">Trusted by <span>Our Clients</span></SectionHeading>
      <p className="sr-only" id={instructionsId}>Testimonials advance every seven seconds. Rotation pauses while you hover over or focus this section and respects reduced-motion preferences. Use the pause button, previous and next buttons, left and right arrow keys, or swipe to browse testimonials.</p>
      <div className="testimonials-track" data-reveal="up">
        <button type="button" className="slider-arrow previous" aria-label="Previous testimonials" onClick={() => move(-1)}><Icon name="arrow" size={16} /></button>
        <div className={`testimonials-grid ${styles.grid}`} data-direction={direction} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { gesture.current = null; }}>
          {visible.map((item, index) => (
            <article key={`${active}-${index}`} className={`testimonial-card testimonial-position-${index} ${interacted ? styles.entering : ''}`}>
              <span className="quote-mark" aria-hidden="true">“</span>
              <blockquote>{item.quote}</blockquote>
              <div className="testimonial-person"><Image src={item.image} alt="" width={44} height={44} sizes="72px" /><div><strong>{item.name}</strong><p>{item.role}</p></div></div>
            </article>
          ))}
        </div>
        <button type="button" className="slider-arrow next" aria-label="Next testimonials" onClick={() => move(1)}><Icon name="arrow" size={16} /></button>
      </div>
      <div className="slider-dots" role="group" aria-label="Choose testimonial">
        {items.map((item, index) => <button type="button" key={item.name} aria-label={`Show ${item.name}'s testimonial`} aria-pressed={active === index} onClick={() => select(index)} />)}
      </div>
      {items.length > 1 && (
        <button type="button" className={styles.playback} aria-label={paused ? 'Play automatic testimonial rotation' : 'Pause automatic testimonial rotation'} onClick={() => setPaused(current => !current)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            {paused ? <path d="M3 1.5v11L12 7z" /> : <path d="M3 2h3v10H3zm5 0h3v10H8z" />}
          </svg>
          {paused ? 'Play slideshow' : 'Pause slideshow'}
        </button>
      )}
      <p className="sr-only" role="status" aria-atomic="true">{carousel.announcement}</p>
    </section>
  );
}
