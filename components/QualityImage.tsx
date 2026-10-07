import Image, { type ImageProps } from "next/image";
import type { CSSProperties } from "react";
import imageQuality from "@/data/image-quality.json";

type Replacement = { localPath: string; width: number; height: number; padded?: boolean };
const replacements: Record<string, Replacement> = imageQuality;

/** Upgrade image pixels while retaining the original element's sizing and alt text. */
export function QualityImage({ src, alt, quality = 90, className = "", style, width, height, unoptimized, ...props }: ImageProps) {
  const replacement = typeof src === "string" ? replacements[src] : undefined;
  const resolvedSource = replacement?.localPath || src;
  // Migrated JPEG originals are already compact; bypass codec stalls and retain all pixels.
  const originalJpeg = typeof resolvedSource === 'string' && /\.jpe?g$/i.test(resolvedSource);
  const imageStyle = replacement ? {
    '--image-native-ratio': `${width}/${height}`,
    ...style,
  } as CSSProperties : style;
  return <Image {...props} src={resolvedSource} alt={alt} width={width} height={height} quality={quality} unoptimized={unoptimized || originalJpeg} className={`${className}${replacement ? ' quality-image' : ''}${replacement?.padded ? ' quality-image-padded' : ''}`} style={imageStyle} />;
}
