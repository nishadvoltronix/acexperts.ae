import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export function Container({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) { return <div id={id} className={`container ${className}`}>{children}</div>; }
export function Button({ children, href, secondary = false, className = "", arrow = true }: { children: ReactNode; href: string; secondary?: boolean; className?: string; arrow?: boolean }) { return <Link href={href} className={`button ${secondary ? "button-secondary" : ""} ${className}`}>{children}{arrow && <Icon name="arrow" size={18} />}</Link>; }
export function SectionHeading({ eyebrow, children, className = "" }: { eyebrow?: string; children: ReactNode; className?: string }) { return <div className={`section-heading ${className}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{children}</h2><span className="heading-rule" aria-hidden="true"><i /></span></div>; }

export type IconName = "phone" | "shield" | "bolt" | "thumb" | "clock" | "arrow" | "snow" | "wrench" | "drop" | "gear" | "users" | "award" | "heart" | "price" | "email" | "pin" | "send" | "check" | "menu" | "close" | "star" | "cpu";
const paths: Record<IconName, ReactNode> = {
  phone: <path d="M7 3 4 4c-2 5 1 10 5 14 3 3 7 4 10 2l2-3-5-3-2 2c-3-1-5-3-6-6l2-2-3-5Z" />,
  shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 11 3 3 5-5"/></>,
  bolt: <path d="m13 2-8 12h6l-1 8 9-13h-7l1-7Z" />,
  thumb: <><path d="M8 10 12 3c3 0 2 5 2 6h5c2 0 2 2 1 5l-2 6H8V10Z"/><path d="M3 10h5v10H3z"/></>,
  clock: <><circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2M9 2h6M12 2v3M4 5 2 7"/></>,
  arrow: <path d="m9 5 7 7-7 7" />,
  snow: <><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M17 19l-1-4 4-1M4 14l4 1-1 4M17 5l-1 4 4 1"/></>,
  wrench: <path d="M21 3c-2-1-5-1-7 1s-2 4-1 6L3 19l2 2 9-10c2 1 4 1 6-1s2-4 1-6l-4 4-2-2 4-4Z" />,
  drop: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13ZM8 15c0 2 1 3 3 3" />,
  gear: <><path d="m9 3 1-2h4l1 2 3 2 2 1 2 4-2 2v3l-1 3-4 2-1 2h-4l-1-2-3-2-2-1-2-4 2-2V8l1-3 4-2Z"/><circle cx="12" cy="12" r="4"/></>,
  users: <><circle cx="12" cy="5" r="3"/><path d="M7 21v-5a5 5 0 0 1 10 0v5H7ZM5 10a3 3 0 0 0-3 3v6h3M19 10a3 3 0 0 1 3 3v6h-3"/></>,
  award: <><path d="m12 2 3 2 4 1v4l2 3-2 3v4l-4 1-3 2-3-2-4-1v-4l-2-3 2-3V5l4-1 3-2Z"/><path d="m8 12 3 3 5-6"/></>,
  heart: <path d="M12 21 3 12C-3 4 6-1 12 6c6-7 15-2 9 6l-9 9Z" />,
  price: <><path d="M7 8V6a5 5 0 0 1 10 0v2M5 8h14l2 13H3L5 8Z"/><path d="M14 12h-3a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-3M12 10v12"/></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
  send: <><path d="m3 3 18 9-18 9 3-9-3-9Z"/><path d="M6 12h15"/></>,
  check: <path d="m5 12 4 4L19 6" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="m5 5 14 14M5 19 14-14" />,
  star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" />,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/><rect x="10" y="10" width="4" height="4"/></>,
};
export function Icon({ name, size = 24, className = "" }: { name: IconName; size?: number; className?: string }) { return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>; }
export function ACIcon({ type }: { type: "repair" | "installation" | "maintenance" | "cleaning" }) { return <div className={`ac-icon ac-icon-${type}`} aria-hidden="true"><svg viewBox="0 0 80 64" fill="none"><rect x="9" y="9" width="61" height="28" rx="5"/><path d="M10 28h59M20 32h36M56 16h5M20 43c-7 6 7 8 0 14M32 43c-7 6 7 8 0 14M44 43c-7 6 7 8 0 14"/></svg>{type !== "repair" && <Icon name={type === "installation" ? "wrench" : type === "maintenance" ? "gear" : "drop"} size={36} />}</div>; }

export const referenceCrops = { logo: [32, 11, 105, 32], hero: [348, 55, 357, 343], cta: [433, 1265, 239, 179], skyline: [133, 800, 572, 78], portrait1: [78, 1196, 28, 29], portrait2: [272, 1196, 28, 29], portrait3: [467, 1196, 28, 29], brandSamsung: [225, 1032, 65, 15], brandPanasonic: [505, 1032, 65, 15] } as const;
const restoredArt: Partial<Record<keyof typeof referenceCrops, {src: string; width: number; height: number; cropHeight?: number; inset?: [number, number, number, number]; sizes: string}>> = {
  logo: {src: '/images/design/ac-experts-logo-hq.png', width: 2169, height: 725, cropHeight: 2169 * 32 / 105, sizes: '210px'},
  hero: {src: '/images/design/hero-hq-clean.png', width: 1278, height: 1230, sizes: '(max-width: 767px) 100vw, (max-width: 1440px) 50.64vw, 730px'},
  cta: {src: '/images/design/cta-hq-v2.png', width: 1448, height: 1086, sizes: '(max-width: 767px) 100vw, 500px'},
  skyline: {src: '/images/design/skyline-hq.png', width: 2172, height: 724, cropHeight: 2172 * 78 / 572, sizes: '1181px'},
  brandSamsung: {src: '/images/design/samsung-hq.png', width: 2172, height: 724, inset: [151.4, 126, 1897.3, 455], sizes: '150px'},
  brandPanasonic: {src: '/images/design/panasonic-hq.png', width: 2172, height: 724, inset: [211.9, 140.1, 1778.5, 444.4], sizes: '160px'},
};
/** Keep the original artwork viewports; enhanced photography uses the same bounds. */
export function ReferenceArt({ crop, alt = "", className = "", priority = false, children }: { crop: keyof typeof referenceCrops; alt?: string; className?: string; priority?: boolean; children?: ReactNode }) {
  const [x,y,w,h] = referenceCrops[crop];
  const restored = restoredArt[crop];
  const inset = restored?.inset;
  const imageHeight = restored ? restored.height / (inset?.[3] || restored.cropHeight || restored.height) * 100 : 1600 / h * 100;
  const style = { aspectRatio: `${w}/${h}`, '--art-width': restored ? `${inset ? restored.width / inset[2] * 100 : 100}%` : `${705 / w * 100}%`, '--art-height': `${imageHeight}%`, '--art-left': inset ? `${-inset[0] / inset[2] * 100}%` : restored ? '0%' : `${-x / w * 100}%`, '--art-top': inset ? `${-inset[1] / inset[3] * 100}%` : restored ? `${(100 - imageHeight) / 2}%` : `${-y / h * 100}%` } as CSSProperties;
  return <span className={`reference-art reference-${crop} ${className}`} style={style}><Image src={restored?.src || "/images/design/homepage-reference.jpeg"} alt={alt} width={restored?.width || 705} height={restored?.height || 1600} sizes={restored?.sizes} quality={90} priority={priority} unoptimized={!restored} draggable={false} />{children}</span>;
}
export function BrandLogo() { return <ReferenceArt crop="logo" alt="AC Experts — Expertise You Can Trust" className="brand-logo" priority />; }
