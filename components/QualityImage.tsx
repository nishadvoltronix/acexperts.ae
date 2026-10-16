import Image, { type ImageProps } from "next/image";
import type { CSSProperties } from "react";
import imageQuality from "@/data/image-quality.json";

type Replacement = { localPath: string; width: number; height: number; padded?: boolean };
const replacements: Record<string, Replacement> = imageQuality;
const preparedReplacements: Record<string, string> = {
  "/images/quality/ac-installation1-hq.png": "/images/quality/ac-installation1-hq.webp",
  "/images/quality/professional-ac-repair-1-hq.png": "/images/quality/professional-ac-repair-1-hq.webp",
  "/images/quality/professional-ac-repair-dubai-hq.png": "/images/quality/professional-ac-repair-dubai-hq.webp",
};

/** Upgrade image pixels while retaining the original element's sizing and alt text. */
export function QualityImage({ src, alt, quality = 75, className = "", style, width, height, unoptimized, ...props }: ImageProps) {
  const replacement = typeof src === "string" ? replacements[src] : undefined;
  const resolvedSource = (replacement && preparedReplacements[replacement.localPath]) || replacement?.localPath || src;
  // These local JPEG/WebP files are compact and ready to serve without request-time encoding.
  const preparedImage = typeof resolvedSource === "string" && /\.(?:jpe?g|webp)$/i.test(resolvedSource);
  const imageStyle = replacement ? {
    '--image-native-ratio': `${width}/${height}`,
    ...style,
  } as CSSProperties : style;
  return <Image {...props} src={resolvedSource} alt={alt} width={width} height={height} quality={quality} unoptimized={unoptimized || preparedImage} className={`${className}${replacement ? ' quality-image' : ''}${replacement?.padded ? ' quality-image-padded' : ''}`} style={imageStyle} />;
}
