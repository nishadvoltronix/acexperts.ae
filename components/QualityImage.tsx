import Image, { type ImageProps } from "next/image";
import type { CSSProperties } from "react";
import imageQuality from "@/data/image-quality.json";
import { uniformImageSource } from "@/lib/uniform-images";

type Replacement = { localPath: string; width: number; height: number; padded?: boolean };
type QualityImageProps = ImageProps & { useSourceDimensions?: boolean };
const replacements: Record<string, Replacement> = imageQuality;
const preparedReplacements: Record<string, string> = {
  "/images/quality/ac-installation1-hq.png": "/images/quality/ac-installation1-hq.webp",
  "/images/quality/professional-ac-repair-1-hq.png": "/images/quality/professional-ac-repair-1-hq.webp",
  "/images/quality/professional-ac-repair-dubai-hq.png": "/images/quality/professional-ac-repair-dubai-hq.webp",
};

/** Upgrade image pixels while retaining the original element's sizing and alt text. */
export function QualityImage({ src, alt, quality = 75, className = "", style, width, height, unoptimized, useSourceDimensions = false, ...props }: QualityImageProps) {
  const replacement = typeof src === "string" ? replacements[src] : undefined;
  const preparedSource = (replacement && preparedReplacements[replacement.localPath]) || replacement?.localPath || src;
  const resolvedSource = typeof preparedSource === "string" ? uniformImageSource(preparedSource) : preparedSource;
  // These local JPEG/WebP files are compact and ready to serve without request-time encoding.
  const preparedImage = typeof resolvedSource === "string" && /\.(?:jpe?g|webp)$/i.test(resolvedSource);
  const imageStyle = replacement ? {
    '--image-native-ratio': `${width}/${height}`,
    ...style,
  } as CSSProperties : style;
  // CSS-sized galleries use the upgraded file's intrinsic dimensions, while the
  // original layout ratio above remains available to the existing crop rules.
  const sourceDimensions = useSourceDimensions ? replacement : undefined;
  return <Image {...props} src={resolvedSource} alt={alt} width={sourceDimensions?.width ?? width} height={sourceDimensions?.height ?? height} quality={quality} unoptimized={unoptimized || preparedImage} className={`${className}${replacement ? ' quality-image' : ''}${replacement?.padded ? ' quality-image-padded' : ''}`} style={imageStyle} />;
}
