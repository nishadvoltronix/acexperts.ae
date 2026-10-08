'use client';

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { QualityImage as Image } from './QualityImage';
import { Icon, SectionHeading } from './ui';
import styles from './Testimonials.module.css';

export interface Testimonial { quote: string; name: string; role: string; image: string; }

export function Testimonials({ items }: { items: Testimonial[] }) {
  const [carousel, setCarousel] = useState({ active: 0, direction: 'next', interacted: false });
  const gesture = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const instructionsId = useId();

  if (!items.length) return null;

  const { active, direction, interacted } = carousel;
  const visible = Array.from({ length: Math.min(3, items.length) }, (_, offset) => items[(active + offset) % items.length]);

  function move(step: number) {
    setCarousel(current => ({
      active: (current.active + step + items.length) % items.length,
      direction: step > 0 ? 'next' : 'previous',
      interacted: true,
    }));
  }

  function select(index: number) {
    setCarousel(current => current.active === index ? current : {
      active: index,
      direction: index > current.active ? 'next' : 'previous',
      interacted: true,
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
    <section className="home-testimonials container" aria-label="Client testimonials" aria-roledescription="carousel" aria-describedby={instructionsId} tabIndex={0} onKeyDown={handleKeyDown}>
      <SectionHeading eyebrow="What our clients say">Trusted by <span>Our Clients</span></SectionHeading>
      <p className="sr-only" id={instructionsId}>Use the previous and next buttons, left and right arrow keys, or swipe to browse testimonials.</p>
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
      <p className="sr-only" role="status" aria-atomic="true">{interacted ? `${items[active].name}, testimonial ${active + 1} of ${items.length}.` : ''}</p>
    </section>
  );
}
