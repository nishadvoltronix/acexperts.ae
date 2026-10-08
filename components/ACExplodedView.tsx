"use client";

import { memo, useId } from "react";
import { ACExplodedModel } from "./ACExplodedModel";
import { useACExplodedView } from "./useACExplodedView";
import styles from "./ACExplodedView.module.css";

const Model = memo(ACExplodedModel);
const parts = ["Front casing & air deflector", "Washable air filter", "Evaporator coil", "Cross-flow blower fan", "PCB control module", "Back chassis"];

export function ACExplodedView() {
  const id = useId();
  const { viewport, stage, slider, output, ready, reducedMotion, mode, setLevel, toggleLoop, resetView, stop, onKeyDown, onPointerEnter, onPointerDown, onPointerMove, onPointerEnd } = useACExplodedView();
  return (
    <section className={styles.viewer} aria-labelledby={`${id}-title`} data-ac-viewer>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>Explore the components</span>
        <h2 id={`${id}-title`}>Inside a split AC</h2>
        <p>Explore the engineering behind your comfort, one component at a time.</p>
      </div>
      <div
        ref={viewport}
        className={styles.viewport}
        tabIndex={ready ? 0 : -1}
        role="group"
        aria-label="Inspect the air conditioner components"
        aria-describedby={`${id}-rotation`}
        onKeyDown={onKeyDown}
        onPointerEnter={onPointerEnter}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        data-ac-viewport
      >
        <div ref={stage} className={styles.stage} aria-hidden="true"><Model /></div>
      </div>
      <div className={styles.rotationHelp}>
        <p id={`${id}-rotation`}>Scroll to separate the parts. Hover to open, or drag to tilt.<span className="sr-only"> You can also use the slider, or focus the model and use the arrow keys. Press Home to reset the view. Swipe vertically to scroll the page.</span></p>
        <button type="button" onClick={resetView} disabled={!ready}>Reset view</button>
      </div>
      <div className={styles.controls}>
        <div className={styles.buttons} role="group" aria-label="AC assembly controls">
          <button type="button" disabled={!ready} aria-pressed={mode === "assembled"} onClick={() => setLevel(0, true)}>Normal <span>(Assembled)</span></button>
          <button type="button" disabled={!ready} aria-pressed={mode === "exploded"} onClick={() => setLevel(1, true)}>Explode <span>(Separate)</span></button>
          <button type="button" disabled={!ready || reducedMotion} aria-pressed={mode === "loop"} onClick={toggleLoop} aria-label={mode === "loop" ? "Stop auto loop animation" : "Start auto loop animation"}>{mode === "loop" ? "Stop loop" : "Auto loop"}<span>Animation</span></button>
        </div>
        <div className={styles.sliderLabel}>
          <label htmlFor={`${id}-level`}>Explode level</label>
          <output ref={output} htmlFor={`${id}-level`} aria-live="off">100%</output>
        </div>
        <input ref={slider} id={`${id}-level`} type="range" min="0" max="100" step="1" defaultValue="100" aria-valuetext="100% separated" disabled={!ready} onFocus={stop} onChange={(event) => setLevel(Number(event.target.value) / 100)} />
        {reducedMotion && <p className={styles.motionNote}>Reduced motion is on. Use Normal, Explode, or the slider to inspect each view.</p>}
        <noscript><p className={styles.motionNote}>Enable JavaScript to use the interactive controls.</p></noscript>
      </div>
      <ol className={styles.legend} aria-label="AC components">
        {parts.map((part, index) => <li key={part}><span aria-hidden="true">{index + 1}</span>{part}</li>)}
      </ol>
    </section>
  );
}
