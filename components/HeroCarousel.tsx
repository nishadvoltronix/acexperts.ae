"use client";
import { useState, type ReactNode } from "react";
export function HeroCarousel({ children }: { children: ReactNode[] }) {
  const [active, setActive] = useState(0);
  return (
    <section
      className="hero-carousel"
      aria-label="AC services"
      aria-roledescription="carousel"
    >
      {children.map((child, index) => (
        <div
          key={index}
          hidden={active !== index}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${children.length}`}
        >
          {child}
        </div>
      ))}
      {children.length > 1 && (
        <div className="hero-controls">
          <button
            aria-label="Previous slide"
            onClick={() =>
              setActive((active + children.length - 1) % children.length)
            }
          >
            ←
          </button>
          <span aria-live="polite">
            {active + 1} / {children.length}
          </span>
          <button
            aria-label="Next slide"
            onClick={() => setActive((active + 1) % children.length)}
          >
            →
          </button>
        </div>
      )}
    </section>
  );
}
