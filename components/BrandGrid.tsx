import Image from "next/image";
import styles from "./BrandGrid.module.css";

const brands = [
  { name: "Daikin", src: "/images/brands/daikin.svg" },
  { name: "Mitsubishi Electric", src: "/images/brands/mitsubishi-electric.svg" },
  { name: "Panasonic", src: "/images/brands/panasonic.svg" },
  { name: "Samsung Electronics", src: "/images/brands/samsung.svg" },
  { name: "Midea Group", src: "/images/brands/midea-group.svg" },
  { name: "Shenling", src: "/images/brands/shenling.svg" },
  { name: "LG Electronics", src: "/images/brands/lg-electronics.svg" },
  { name: "Carrier", src: "/images/brands/carrier.png" },
  { name: "Johnson Controls", src: "/images/brands/johnson-controls.png" },
  { name: "Trane", src: "/images/brands/trane.png" },
  { name: "Enerquip Thermal Solutions", src: "/images/brands/enerquip.png" },
  { name: "Danfoss", src: "/images/brands/danfoss.svg" },
  { name: "Hisaka", src: "/images/brands/hisaka.png" },
  { name: "IHI", src: "/images/brands/ihi.svg" },
  { name: "Kelvion", src: "/images/brands/kelvion.gif" },
  { name: "Mersen", src: "/images/brands/mersen.svg" },
  { name: "Modine", src: "/images/brands/modine.svg" },
  { name: "Xylem", src: "/images/brands/xylem.svg" },
];

export function BrandGrid() {
  return (
    <ul className={styles.grid} aria-label="Brands we service" role="list">
      {brands.map((brand, index) => (
        <li className={styles.card} key={brand.name} data-reveal="up" data-reveal-delay={(index % 6) * 45}>
          <Image
            src={brand.src}
            alt={brand.name}
            width={240}
            height={96}
            sizes="(max-width: 767px) 40vw, (max-width: 1023px) 27vw, 180px"
            quality={90}
            className={styles.logo}
          />
        </li>
      ))}
    </ul>
  );
}
