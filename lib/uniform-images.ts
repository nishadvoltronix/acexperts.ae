import imageQuality from "@/data/image-quality.json";

// Keep original media intact; use the same reviewed shirt edit wherever a photo appears.
const uniforms: Record<string, string> = {
  "/images/design/hero-voltronix-optimized.webp": "/images/uniforms/hero-voltronix-grey-red-logo.webp",
  "/images/design/cta-voltronix.png": "/images/uniforms/cta-voltronix-grey.webp",
  "/images/hero/worker-acexperts01-2600a61d.webp": "/images/uniforms/worker-grey.webp",
  "/images/hero/worker-acexperts-ae408d58.webp": "/images/uniforms/worker-grey.webp",
  "/images/quality/worker-acexperts03-original.webp": "/images/uniforms/worker-ac-grey.webp",
  "/images/quality/ac-repair-team-hq.png": "/images/uniforms/ac-repair-team-grey.webp",
  "/images/quality/ac-repair-mechanic-hq.png": "/images/uniforms/ac-repair-mechanic-grey.webp",
  "/images/quality/ac-maintenance-repair-hq.png": "/images/uniforms/ac-maintenance-repair-grey.webp",
};
const qualityImages: Record<string, { localPath: string }> = imageQuality;

export function uniformImageSource(src: string): string {
  return uniforms[src] || uniforms[qualityImages[src]?.localPath] || src;
}
