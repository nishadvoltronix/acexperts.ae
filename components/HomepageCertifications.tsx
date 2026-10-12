import Image from "next/image";
import { Container, SectionHeading } from "./ui";

// The site owner confirmed all four credentials on 12 October 2026.
const certifications = [
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
];

export function HomepageCertifications() {
  return (
    <section className="home-certifications home-completion-section" id="home-certifications" aria-label="Certifications">
      <Container>
        <SectionHeading>Certifications</SectionHeading>
        <div className="certification-grid">
          {certifications.map(({ name, logo, description }) => (
            <article className="certification-card" key={name}>
              <div className="certification-logo">
                <Image src={logo} alt={`${name} logo`} fill sizes="160px" />
              </div>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
