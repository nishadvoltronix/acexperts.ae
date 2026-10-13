import Image from "next/image";
import { Container, SectionHeading } from "./ui";

// The site owner confirmed these credentials in October 2026. No ISO standard number was provided.
const certifications: { name: string; logo: string; logoAlt?: string; description: string }[] = [
  {
    name: "NADCA",
    logo: "/images/certifications/nadca.svg",
    description: "Certified for top-quality air duct cleaning and healthier indoor air.",
  },
  {
    name: "ISIAQ",
    logo: "/images/certifications/isiaq.png",
    description: "Certified for expertise in indoor air quality and promoting healthier indoor spaces.",
  },
  {
    name: "ISSA",
    logo: "/images/certifications/issa.png",
    description: "Certified for top cleaning and hygiene standards by ISSA.",
  },
  {
    name: "IAQA",
    logo: "/images/certifications/iaqa.png",
    description: "Certified to improve indoor air quality for a safer environment.",
  },
  {
    name: "ISO Certified",
    logo: "/images/certifications/iso-certified.svg",
    logoAlt: "ISO Certified badge",
    description: "Committed to consistent quality across our AC services.",
  },
];

export function HomepageCertifications() {
  const cards = (duplicate: boolean) => certifications.map(({ name, logo, logoAlt, description }) => (
    <article className="certification-card" key={name}>
      <div className="certification-logo">
        <Image src={logo} alt={duplicate ? "" : logoAlt ?? `${name} logo`} fill sizes="160px" loading="eager" />
      </div>
      <h3>{name}</h3>
      <p>{description}</p>
    </article>
  ));

  return (
    <section className="home-certifications home-completion-section" id="home-certifications" aria-label="Certifications">
      <Container>
        <SectionHeading>Certifications</SectionHeading>
        <div className="certification-slider">
          <div className="certification-track">
            <div className="certification-set">{cards(false)}</div>
            <div className="certification-set" aria-hidden="true">{cards(true)}</div>
          </div>
        </div>
      </Container>
    </section>
  );
}
