import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./ACExplodedModel.module.css";

// Padded, non-overlapping bounds in the original 1536 ? 1024 transparent atlas.
// All six layers share one downloaded image and the same photographic camera angle.
const parts = [
  { name: "chassis", crop: [1024, 537, 497, 449] },
  { name: "blower", crop: [17, 576, 514, 358] },
  { name: "evaporator", crop: [1018, 78, 508, 415] },
  { name: "filter", crop: [539, 83, 432, 390] },
  { name: "pcb", crop: [596, 559, 287, 397] },
  { name: "front", crop: [16, 63, 499, 424] },
];

/** Photographic layers, animated by the viewer's shared separation value. */
export function ACExplodedModel() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.shadow} />
      <div className={styles.guides}><i /><i /><i /></div>
      {parts.map(({ name, crop: [left, top, width, height] }) => (
        <div key={name} className={styles.part + " " + styles[name]} data-ac-part={name}>
          <div className={styles.crop} style={{ aspectRatio: width + " / " + height }}>
            <Image
              src="/images/ac-exploded/parts-photoreal.png"
              alt=""
              width={1536}
              height={1024}
              sizes="1536px"
              quality={90}
              draggable={false}
              className={styles.atlas}
              style={{
                width: (1536 / width * 100) + "%",
                height: (1024 / height * 100) + "%",
                left: (-left / width * 100) + "%",
                top: (-top / height * 100) + "%",
              } as CSSProperties}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
