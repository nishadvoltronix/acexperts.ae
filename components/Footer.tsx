import Link from "next/link";
import { services, site } from "@/lib/site";
import { BrandLogo, Icon } from "./ui";
import { NewsletterForm } from "./NewsletterForm";
import { CompanyLinks, SocialLinks } from "./CompanyLinks";
import { configuredPrivacyNotice } from "@/lib/privacy-notice";

const quickLinks = [
  { title: "Home", route: "/" },
  { title: "About Us", route: "/about/" },
  { title: "Why Us", route: "/#why-us" },
  { title: "Blogs", route: "/blog/" },
  { title: "Contact Us", route: "/contact-us/" },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid container">
        <div className="footer-brand">
          <Link href="/" aria-label="Voltronix home" className="footer-logo-link">
            <BrandLogo />
          </Link>
          <p>
            Voltronix provides AC repair, installation and maintenance services
            in Dubai &amp; UAE.
          </p>
          <SocialLinks />
        </div>
        <div className="footer-links">
          <h2>Quick Links</h2>
          <ul>
            {quickLinks.map((item) => (
              <li key={item.route}><Link href={item.route}>{item.title}</Link></li>
            ))}
          </ul>
        </div>
        <div className="footer-services">
          <h2><Link href="/services/">Our Services</Link></h2>
          <ul>
            {services.map((service) => (
              <li key={service.route}><Link href={service.route}>{service.title}</Link></li>
            ))}
            <li><Link href="/projects/">Our Projects</Link></li>
            <li><Link href="/products/">Products</Link></li>
          </ul>
        </div>
        <div className="footer-contact">
          <h2>Contact Us</h2>
          <ul className="footer-contact-list">
            <li><Icon name="phone" size={17} /><a href={site.phoneHref}>{site.phone}</a></li>
            <li><Icon name="email" size={17} /><a href={`mailto:${site.email}`}>{site.email}</a></li>
            <li><Icon name="pin" size={17} /><span>Dubai, UAE</span></li>
            <li><Icon name="clock" size={17} /><span>24/7 Customer Support</span></li>
          </ul>
          <details className="footer-details">
            <summary>Address &amp; business hours</summary>
            <address><strong>VOLTRONIX</strong><br />{site.address}</address>
            <p>Mobile: <a href="tel:+971502420957">{site.mobile}</a></p>
            <p><a href={site.whatsapp}>Contact Voltronix on WhatsApp</a></p>
            <p>{site.hours}</p>
          </details>
        </div>
        <div className="footer-newsletter">
          <h2>Newsletter</h2>
          <p>Subscribe to get updates &amp; offers.</p>
          <NewsletterForm privacyNotice={configuredPrivacyNotice()} />
        </div>
      </div>
      <section className="footer-group container" aria-labelledby="footer-group-title">
        <div>
          <h2 id="footer-group-title">Part of Voltronix Group</h2>
          <p>
            Our team of specialists from varying disciplines will guarantee the
            provision of integrated solutions to finish your task by drawing on
            their experience from the collection of our completed projects.
          </p>
        </div>
        <CompanyLinks label="Footer group companies" />
      </section>
      <div className="footer-bottom container">
        <p>© 2026 Voltronix Contracting LLC. All Rights Reserved.</p>
        <div className="footer-bottom-links">
          <Link href="/faq/">FAQs</Link>
          <span aria-hidden="true">|</span>
          <Link href="/contact-us/">Contact Us</Link>
        </div>
      </div>
    </footer>
  );
}
